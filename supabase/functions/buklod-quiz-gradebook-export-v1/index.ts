// TARGET PROJECT: BUKLOD Quiz Dedicated (cjtehbfspgimyhifnjon)
// Cross-project auth: validates the bearer token against BUKLOD Main before any service-role read.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAIN_URL = "https://yhanxndaqbmuzbdqlblu.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getMainUser(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;
  const response = await fetch(`${MAIN_URL}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: MAIN_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? user : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  const mainUser = await getMainUser(req);
  if (!mainUser) return json({ error: "Valid BUKLOD Main session required." }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const action = String(body?.action ?? "catalog").trim().toLowerCase();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Dedicated Quiz service configuration unavailable." }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "catalog") {
    const { data: exams, error } = await admin
      .from("buklod_quiz_exams")
      .select("id,title,status,total_points,updated_at")
      .eq("owner_user_id", mainUser.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) return json({ error: error.message }, 400);

    const examIds = (exams ?? []).map((row: any) => row.id);
    let sections: any[] = [];
    if (examIds.length) {
      const sectionRes = await admin
        .from("buklod_quiz_sections")
        .select("id,exam_id,name,sort_order")
        .in("exam_id", examIds)
        .is("archived_at", null)
        .order("sort_order", { ascending: true });
      if (sectionRes.error) return json({ error: sectionRes.error.message }, 400);
      sections = sectionRes.data ?? [];
    }

    return json({
      user_id: mainUser.id,
      exams: (exams ?? []).map((exam: any) => ({ ...exam, sections: sections.filter((section: any) => section.exam_id === exam.id) })),
    });
  }

  if (action !== "export") return json({ error: "Unsupported action." }, 400);

  const examId = String(body?.exam_id ?? "").trim();
  const sectionId = body?.section_id ? String(body.section_id).trim() : null;
  if (!examId) return json({ error: "exam_id is required." }, 400);

  const { data: exam, error: examError } = await admin
    .from("buklod_quiz_exams")
    .select("id,title,total_points,owner_user_id,archived_at")
    .eq("id", examId)
    .maybeSingle();
  if (examError) return json({ error: examError.message }, 400);
  if (!exam || exam.owner_user_id !== mainUser.id) return json({ error: "Exam not owned by this faculty user." }, 403);

  let sectionName: string | null = null;
  if (sectionId) {
    const { data: section, error: sectionError } = await admin
      .from("buklod_quiz_sections")
      .select("id,name,exam_id,archived_at")
      .eq("id", sectionId)
      .eq("exam_id", examId)
      .maybeSingle();
    if (sectionError) return json({ error: sectionError.message }, 400);
    if (!section || section.archived_at) return json({ error: "Active Quiz section not found for this exam." }, 404);
    sectionName = section.name;
  }

  let query = admin
    .from("buklod_quiz_attempts")
    .select("student_user_id,attempt_no,total_score,max_score,released_at")
    .eq("exam_id", examId)
    .eq("status", "RELEASED")
    .not("released_at", "is", null)
    .order("released_at", { ascending: false })
    .limit(5000);
  if (sectionId) query = query.eq("section_id", sectionId);

  const { data: attempts, error: attemptError } = await query;
  if (attemptError) return json({ error: attemptError.message }, 400);

  return json({
    exam_id: exam.id,
    exam_title: exam.title,
    points_possible: Number(exam.total_points ?? 0),
    section_id: sectionId,
    section_name: sectionName,
    released_rows: attempts ?? [],
    released_count: attempts?.length ?? 0,
    source_system: "BUKLOD_QUIZ_DEDICATED",
  });
});
