import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-buklod-client, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: any) => new Response(JSON.stringify(body), { status, headers: cors });
const safe = (value: any, max = 4000) => String(value ?? "").trim().slice(0, max);
const objectValue = (value: any) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const reportScopeType = (value: any) => ["ORGANIZATION", "CLUSTER"].includes(safe(value, 40).toUpperCase());

function manilaWeekKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = get("weekday");
  const index: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const localNoonUtc = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
  localNoonUtc.setUTCDate(localNoonUtc.getUTCDate() - (index[weekday] ?? 0));
  return `${localNoonUtc.getUTCFullYear()}-${String(localNoonUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(localNoonUtc.getUTCDate()).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !serviceKey || !anonKey) return reply(500, { ok: false, error: "server_configuration_missing" });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { ok: false, error: "not_authenticated" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return reply(401, { ok: false, error: "invalid_session" });
  const uid = user.id;

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let body: any = {};
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: "invalid_json" }); }
  const action = safe(body.action, 80) || "bootstrap";

  const getMemberships = async () => {
    const { data: memberships, error } = await caller
      .from("buklod_scope_memberships")
      .select("scope_id,membership_status")
      .eq("user_id", uid)
      .eq("membership_status", "ACTIVE");
    if (error) throw error;
    const ids = (memberships ?? []).map((row: any) => row.scope_id).filter(Boolean);
    if (!ids.length) return [];
    const { data: scopes, error: scopesError } = await caller
      .from("buklod_scopes")
      .select("id,name,scope_type,parent_scope_id,organization_id,status")
      .in("id", ids)
      .in("scope_type", ["ORGANIZATION", "CLUSTER"]);
    if (scopesError) throw scopesError;
    const out: any[] = [];
    for (const scope of scopes ?? []) {
      const { data: isAdmin } = await caller.rpc("buklod_is_scope_admin", { _scope_id: scope.id });
      out.push({ ...scope, is_admin: isAdmin === true });
    }
    return out;
  };

  try {
    if (action === "bootstrap") {
      const [{ data: profile }, scopes] = await Promise.all([
        caller.from("profiles").select("id,full_name,username,avatar_url,role").eq("id", uid).maybeSingle(),
        getMemberships(),
      ]);
      return reply(200, {
        ok: true,
        user: { id: uid, email: user.email },
        profile,
        scopes,
        receiver_enabled: scopes.some((scope: any) => scope.is_admin),
        reporting_scope_types: ["ORGANIZATION", "CLUSTER"],
      });
    }

    const scopeId = safe(body.scope_id, 80);
    if (!scopeId) return reply(400, { ok: false, error: "scope_required" });
    const scopes = await getMemberships();
    const scope = scopes.find((item: any) => item.id === scopeId);
    if (!scope || !reportScopeType(scope.scope_type)) return reply(403, { ok: false, error: "report_scope_not_allowed" });

    const loadBundle = async (assignment: any) => {
      const [{ data: definition, error: definitionError }, { data: period, error: periodError }] = await Promise.all([
        admin.from("buklod_report_definitions").select("*").eq("id", assignment.report_definition_id).maybeSingle(),
        admin.from("buklod_report_periods").select("*").eq("id", assignment.report_period_id).maybeSingle(),
      ]);
      if (definitionError) throw definitionError;
      if (periodError) throw periodError;
      if (!definition || !period) throw new Error("report_assignment_context_incomplete");
      if (definition.scope_id !== scopeId || period.scope_id !== scopeId) throw new Error("report_scope_mismatch");
      return { definition, period, assignment };
    };

    const isMzbLineage = async () => {
      const candidates = new Set<string>();
      if (scope.scope_type === "ORGANIZATION") {
        candidates.add(scope.id);
        if (scope.parent_scope_id) candidates.add(scope.parent_scope_id);
      } else if (scope.scope_type === "CLUSTER") {
        if (scope.organization_id) candidates.add(scope.organization_id);
        if (scope.parent_scope_id) candidates.add(scope.parent_scope_id);
      }
      for (const candidate of candidates) {
        const { data, error } = await caller.rpc("buklod_is_mzb_organization_scope_v1", { p_scope_id: candidate });
        if (!error && data === true) return true;
      }
      return false;
    };

    const ensureAssignment = async (preferredAssignmentId?: string | null) => {
      const requested = safe(preferredAssignmentId, 80);
      if (requested) {
        const { data: requestedAssignment, error: requestedError } = await admin
          .from("buklod_report_assignments")
          .select("*")
          .eq("id", requested)
          .eq("scope_id", scopeId)
          .eq("assignee_user_id", uid)
          .maybeSingle();
        if (requestedError) throw requestedError;
        if (requestedAssignment) return await loadBundle(requestedAssignment);
        throw new Error("assignment_not_allowed");
      }

      const { data: publishedAssignment, error: publishedError } = await admin
        .from("buklod_report_assignments")
        .select("*")
        .eq("scope_id", scopeId)
        .eq("assignee_user_id", uid)
        .neq("assignment_status", "SUBMITTED")
        .contains("metadata", { source: "BUKLOD_REPORT_REAL_DEADLINE_R1" })
        .order("deadline_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (publishedError) throw publishedError;
      if (publishedAssignment) return await loadBundle(publishedAssignment);

      // Legacy compatibility only: preserve already-created MZB Quick Weekly drafts.
      // Never create a definition, period, or assignment here.
      if (await isMzbLineage()) {
        const { data: legacyDefinition, error: legacyDefinitionError } = await admin
          .from("buklod_report_definitions")
          .select("*")
          .eq("scope_id", scopeId)
          .eq("code", "QUICK_WEEKLY_REPORT")
          .eq("status", "ACTIVE")
          .maybeSingle();
        if (legacyDefinitionError) throw legacyDefinitionError;
        if (legacyDefinition && objectValue(legacyDefinition.content_requirements).schema === "BUKLOD_QUICK_WEEKLY_V1") {
          const { data: legacyPeriod, error: legacyPeriodError } = await admin
            .from("buklod_report_periods")
            .select("*")
            .eq("report_definition_id", legacyDefinition.id)
            .eq("period_key", manilaWeekKey())
            .maybeSingle();
          if (legacyPeriodError) throw legacyPeriodError;
          if (legacyPeriod) {
            const { data: legacyAssignment, error: legacyAssignmentError } = await admin
              .from("buklod_report_assignments")
              .select("*")
              .eq("report_definition_id", legacyDefinition.id)
              .eq("report_period_id", legacyPeriod.id)
              .eq("assignee_user_id", uid)
              .maybeSingle();
            if (legacyAssignmentError) throw legacyAssignmentError;
            if (legacyAssignment) return { definition: legacyDefinition, period: legacyPeriod, assignment: legacyAssignment };
          }
        }
      }

      throw new Error("no_report_assignment");
    };

    const readReminder = async (assignment: any) => {
      const { data: canonical, error } = await admin.from("buklod_report_reminders")
        .select("id,status,acknowledgement,comment,completed_at,created_at")
        .eq("assignment_id", assignment.id)
        .eq("assigned_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (canonical) {
        return {
          id: canonical.id,
          status: canonical.status === "DONE" ? "DONE" : "ACTIVE",
          response: canonical.acknowledgement ?? null,
          comments: canonical.comment ? [{ text: canonical.comment, by: uid, at: canonical.created_at }] : [],
          completed_at: canonical.completed_at ?? null,
        };
      }
      const metadata = objectValue(assignment.metadata);
      const reminder = objectValue(metadata.reminder);
      return {
        id: null,
        status: safe(reminder.status, 20) || (assignment.assignment_status === "SUBMITTED" ? "DONE" : "ACTIVE"),
        response: safe(reminder.response, 80) || null,
        comments: Array.isArray(reminder.comments) ? reminder.comments.slice(-20) : [],
        completed_at: reminder.completed_at ?? null,
      };
    };

    if (action === "bootstrap_scope") {
      const { definition, period, assignment } = await ensureAssignment(body.assignment_id);
      const { data: submission, error: submissionError } = await admin
        .from("buklod_report_submissions")
        .select("id,submission_status,review_status,content,submitted_at,current_version_no,metadata")
        .eq("assignment_id", assignment.id)
        .maybeSingle();
      if (submissionError) throw submissionError;
      const reminder = await readReminder(assignment);
      const requirements = objectValue(definition.content_requirements);
      return reply(200, {
        ok: true,
        context: {
          scope_id: scopeId,
          scope_name: scope.name,
          scope_type: scope.scope_type,
          report_definition_id: definition.id,
          report_code: definition.code,
          report_title: definition.title,
          report_description: definition.description ?? null,
          report_instructions: definition.instructions ?? null,
          form_mode: definition.form_mode ?? "FLEXIBLE",
          form_schema: safe(requirements.schema, 120) || "BUKLOD_DYNAMIC_FORM_V1",
          content_requirements: requirements,
          report_period_id: period.id,
          report_assignment_id: assignment.id,
          period_title: period.title,
          period_key: period.period_key,
          opens_at: period.opens_at,
          deadline_at: assignment.deadline_at,
          closes_at: period.closes_at,
          assignment_status: assignment.assignment_status,
          submission_id: submission?.id ?? null,
          submission_status: submission?.submission_status ?? null,
          content: objectValue(submission?.content),
          reminder,
        },
      });
    }

    if (action === "save_weekly" || action === "save_report") {
      const assignmentId = safe(body.assignment_id, 80);
      const { definition, period, assignment } = await ensureAssignment(assignmentId || null);
      const content = objectValue(body.content);
      if (!Object.keys(content).length) return reply(400, { ok: false, error: "content_required" });
      const submit = body.submit === true;
      const { data: result, error } = await caller.rpc("buklod_report_submission_save_v1", {
        p_assignment_id: assignment.id,
        p_content: content,
        p_submit: submit,
        p_idempotency_key: safe(body.idempotency_key, 180) || null,
      });
      if (error) throw error;
      return reply(200, {
        ok: true,
        result: {
          ...objectValue(result),
          scope_id: scopeId,
          report_definition_id: definition.id,
          report_period_id: period.id,
          report_assignment_id: assignment.id,
        },
      });
    }

    if (action === "reminder_action") {
      const { assignment } = await ensureAssignment(body.assignment_id);
      if (assignment.assignment_status === "SUBMITTED") {
        return reply(200, { ok: true, reminder: { status: "DONE", completed_at: assignment.updated_at } });
      }
      const kind = safe(body.kind, 40).toUpperCase();
      const value = safe(body.value, 800);
      if (!["ACK", "COMMENT", "DONE"].includes(kind)) return reply(400, { ok: false, error: "invalid_reminder_action" });
      const metadata = objectValue(assignment.metadata);
      const previous = objectValue(metadata.reminder);
      const comments = Array.isArray(previous.comments) ? [...previous.comments] : [];
      const now = new Date().toISOString();
      const next: any = { ...previous, status: previous.status || "ACTIVE" };
      if (kind === "ACK") {
        if (!value) return reply(400, { ok: false, error: "response_required" });
        next.response = value.slice(0, 80);
        next.responded_at = now;
      } else if (kind === "COMMENT") {
        if (!value) return reply(400, { ok: false, error: "comment_required" });
        comments.push({ text: value.slice(0, 800), by: uid, at: now });
        next.comments = comments.slice(-20);
      } else {
        next.status = "DONE";
        next.completed_at = now;
        next.completion_source = "MANUAL";
      }
      const updated = await admin.from("buklod_report_assignments")
        .update({ metadata: { ...metadata, reminder: next }, updated_at: now })
        .eq("id", assignment.id).select("metadata").single();
      if (updated.error) throw updated.error;
      if (kind === "DONE") {
        const reminderUpdate = await admin.from("buklod_report_reminders")
          .update({ status: "DONE", completed_at: now, updated_at: now })
          .eq("assignment_id", assignment.id)
          .eq("assigned_user_id", uid)
          .eq("status", "ACTIVE");
        if (reminderUpdate.error) throw reminderUpdate.error;
      } else if (kind === "COMMENT" && value) {
        const reminderUpdate = await admin.from("buklod_report_reminders")
          .update({ comment: value.slice(0, 800), updated_at: now })
          .eq("assignment_id", assignment.id)
          .eq("assigned_user_id", uid)
          .eq("status", "ACTIVE");
        if (reminderUpdate.error) throw reminderUpdate.error;
      }
      return reply(200, { ok: true, reminder: next });
    }

    if (action === "my_reports") {
      const { data, error } = await admin.from("buklod_report_submissions")
        .select("id,scope_id,submission_status,review_status,content,submitted_at,created_at,updated_at,current_version_no")
        .eq("submitter_user_id", uid).eq("scope_id", scopeId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return reply(200, { ok: true, reports: data ?? [] });
    }

    if (action === "receiver_reports") {
      if (!scope.is_admin) return reply(403, { ok: false, error: "receiver_not_allowed" });
      const { data, error } = await admin.from("buklod_report_submissions")
        .select("id,submitter_user_id,submission_status,review_status,content,submitted_at,created_at,updated_at")
        .eq("scope_id", scopeId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((row: any) => row.submitter_user_id).filter(Boolean))];
      let profiles: any[] = [];
      if (ids.length) {
        const result = await admin.from("profiles").select("id,full_name,username,avatar_url").in("id", ids);
        profiles = result.data ?? [];
      }
      const byId = Object.fromEntries(profiles.map((profile: any) => [profile.id, profile]));
      return reply(200, { ok: true, reports: (data ?? []).map((row: any) => ({ ...row, submitter: byId[row.submitter_user_id] ?? null })) });
    }

    if (action === "review_report") {
      if (!scope.is_admin) return reply(403, { ok: false, error: "receiver_not_allowed" });
      const submissionId = safe(body.submission_id, 80);
      const decision = safe(body.decision, 40).toUpperCase();
      const notes = safe(body.notes, 1800) || null;
      const allowed: Record<string, string> = { APPROVED: "APPROVED", NEEDS_FOLLOW_UP: "NEEDS_REVIEW", FOR_REVIEW: "NEEDS_REVIEW", NEEDS_REVISION: "NEEDS_REVISION", REJECTED: "REJECTED" };
      if (!submissionId || !allowed[decision]) return reply(400, { ok: false, error: "invalid_review" });
      const { data: submission } = await admin.from("buklod_report_submissions").select("id,scope_id").eq("id", submissionId).eq("scope_id", scopeId).maybeSingle();
      if (!submission) return reply(404, { ok: false, error: "submission_not_found" });
      const review = await admin.from("buklod_report_reviews").insert({
        submission_id: submissionId,
        reviewer_user_id: uid,
        decision,
        review_notes: notes,
        findings: {},
        metadata: { source: "BUKLOD_REPORT" },
      }).select().single();
      if (review.error) throw review.error;
      const update = await admin.from("buklod_report_submissions").update({ review_status: allowed[decision], updated_at: new Date().toISOString() }).eq("id", submissionId);
      if (update.error) throw update.error;
      return reply(200, { ok: true, review: review.data });
    }

    return reply(400, { ok: false, error: "unknown_action" });
  } catch (error: any) {
    const message = safe(error?.message || "report_api_failed", 1200);
    console.error("[BUKLOD_REPORT_API]", message);
    if (message === "no_report_assignment") return reply(404, { ok: false, error: message });
    if (message === "assignment_not_allowed" || message === "report_scope_mismatch") return reply(403, { ok: false, error: message });
    return reply(500, { ok: false, error: message });
  }
});
