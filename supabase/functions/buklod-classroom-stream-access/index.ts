import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { StreamClient } from "npm:@stream-io/node-sdk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const streamApiKey = Deno.env.get("STREAM_API_KEY");
    const streamApiSecret = Deno.env.get("STREAM_API_SECRET");
    if (!supabaseUrl || !anonKey || !serviceKey || !streamApiKey || !streamApiSecret) return json({ error: "Required server configuration is missing" }, 500);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    const user = userData.user;
    if (authError || !user) return json({ error: authError?.message || "Invalid user session" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "access");

    const loadSessionAccess = async (sessionId: string) => {
      const { data: session, error: sessionError } = await admin.from("buklod_education_classroom_live_sessions").select("id,classroom_id,created_by,call_id,status,plan_key,hard_stop_at,free_limit_minutes,started_at,attendance_session_id").eq("id", sessionId).maybeSingle();
      if (sessionError || !session) return { error: sessionError?.message || "Live session not found", status: 404 } as const;
      const nowMs = Date.now();
      const stopMs = session.hard_stop_at ? new Date(session.hard_stop_at).getTime() : null;
      if (session.status !== "LIVE" || (stopMs !== null && stopMs <= nowMs)) {
        if (session.status === "LIVE" && stopMs !== null && stopMs <= nowMs) await admin.from("buklod_education_classroom_live_sessions").update({ status: "ENDED", ended_at: new Date().toISOString() }).eq("id", session.id).eq("status", "LIVE");
        return { error: "This live class has ended", status: 409, code: "LIVE_SESSION_ENDED" } as const;
      }
      const { data: classroom } = await admin.from("buklod_education_classrooms").select("id,faculty_user_id,name,status,adaptive_config").eq("id", session.classroom_id).maybeSingle();
      if (!classroom || classroom.status !== "ACTIVE") return { error: "Classroom is unavailable", status: 403 } as const;
      const isFaculty = classroom.faculty_user_id === user.id;
      let isStudent = false;
      if (!isFaculty) {
        const { data: enrollment } = await admin.from("buklod_education_enrollments").select("id").eq("classroom_id", classroom.id).eq("student_user_id", user.id).eq("status", "ACTIVE").maybeSingle();
        isStudent = !!enrollment;
      }
      if (!isFaculty && !isStudent) return { error: "Active classroom membership required", status: 403 } as const;
      return { session, classroom, isFaculty, isStudent, stopMs, nowMs } as const;
    };

    if (action === "leave") {
      const participantId = String(body?.participant_id || "");
      if (!participantId) return json({ error: "participant_id required" }, 400);
      const { data: participant } = await admin.from("buklod_education_classroom_live_participants").select("id,user_id,joined_at,left_at").eq("id", participantId).eq("user_id", user.id).maybeSingle();
      if (!participant) return json({ error: "Participant record not found" }, 404);
      const joined = new Date(participant.joined_at).getTime();
      const left = Date.now();
      const totalSeconds = Math.max(0, Math.round((left - joined) / 1000));
      await admin.from("buklod_education_classroom_live_participants").update({ left_at: new Date(left).toISOString(), total_seconds: totalSeconds }).eq("id", participantId).eq("user_id", user.id).is("left_at", null);
      return json({ ok: true, total_seconds: totalSeconds });
    }

    if (action === "state") {
      const sessionId = String(body?.session_id || "");
      const participantId = String(body?.participant_id || "");
      const access = await loadSessionAccess(sessionId);
      if ("error" in access) return json({ error: access.error, code: (access as any).code }, access.status);
      const { data: state } = await admin.from("buklod_education_classroom_live_state").select("session_id,version,interaction_id,mode,active_user_id,active_user_ids,mute_all,ended,updated_at").eq("session_id", sessionId).maybeSingle();
      let participantActive = true;
      if (participantId) {
        const { data: participant } = await admin.from("buklod_education_classroom_live_participants").select("id,session_id,user_id,left_at").eq("id", participantId).eq("user_id", user.id).maybeSingle();
        participantActive = !!participant && participant.session_id === sessionId && participant.left_at == null;
      }
      const { data: breakout } = access.isFaculty
        ? await admin.from("buklod_education_classroom_breakout_rooms").select("id,name,status,timer_ends_at,call_id").eq("live_session_id", sessionId).eq("status", "OPEN")
        : await admin.from("buklod_education_classroom_breakout_members").select("room_id,buklod_education_classroom_breakout_rooms!inner(id,name,status,timer_ends_at,call_id,live_session_id)").eq("user_id", user.id).eq("buklod_education_classroom_breakout_rooms.live_session_id", sessionId).eq("buklod_education_classroom_breakout_rooms.status", "OPEN");
      return json({ state, participant_active: participantActive, breakout_rooms: breakout ?? [] });
    }

    if (action === "interaction") {
      const sessionId = String(body?.session_id || "");
      const access = await loadSessionAccess(sessionId);
      if ("error" in access) return json({ error: access.error, code: (access as any).code }, access.status);
      if (!access.isFaculty) return json({ error: "Faculty access required" }, 403);
      const type = String(body?.interaction_type || "").toUpperCase();
      const allowed = new Set(["CALL_STUDENT","START_CONVERSATION","START_GROUP","RETURN_TO_LISTENING","MUTE_ALL","CLEAR_MUTE_ALL","NETWORK_POOR","RECONNECTING","CLASS_ENDED"]);
      if (!allowed.has(type)) return json({ error: "Unsupported interaction type" }, 400);
      const targetUserId = body?.target_user_id ? String(body.target_user_id) : null;
      const targetUserIds = Array.isArray(body?.target_user_ids) ? body.target_user_ids.map(String).filter(Boolean).slice(0, 60) : [];
      if ((type === "CALL_STUDENT" || type === "START_CONVERSATION") && !targetUserId) return json({ error: "target_user_id required" }, 400);
      if (targetUserId) {
        const { data: enrollment } = await admin.from("buklod_education_enrollments").select("id").eq("classroom_id", access.classroom.id).eq("student_user_id", targetUserId).eq("status", "ACTIVE").maybeSingle();
        if (!enrollment) return json({ error: "Target is not an active student" }, 400);
      }
      const { data: current } = await admin.from("buklod_education_classroom_live_state").select("version").eq("session_id", sessionId).maybeSingle();
      const version = Number(current?.version || 0) + 1;
      const interactionId = crypto.randomUUID();
      const muteAll = type === "MUTE_ALL" || type === "CLASS_ENDED" ? true : type === "CLEAR_MUTE_ALL" || ["CALL_STUDENT","START_CONVERSATION","START_GROUP"].includes(type) ? false : undefined;
      const ended = type === "CLASS_ENDED";
      const mode = type === "CLASS_ENDED" ? "CLASS_ENDED" : type === "START_GROUP" ? "GROUP_DISCUSSION" : type === "CALL_STUDENT" ? "ACTIVE_RECITATION" : type === "START_CONVERSATION" ? "ACTIVE_CONVERSATION" : type === "NETWORK_POOR" ? "NETWORK_POOR" : type === "RECONNECTING" ? "RECONNECTING" : "LISTENING";
      const activeIds = type === "START_GROUP" ? targetUserIds : targetUserId ? [targetUserId] : [];
      const update: Record<string, unknown> = { version, interaction_id: interactionId, mode, active_user_id: activeIds[0] || null, active_user_ids: activeIds, ended, updated_by: user.id, updated_at: new Date().toISOString() };
      if (muteAll !== undefined) update.mute_all = muteAll;
      const { data: state, error: stateError } = await admin.from("buklod_education_classroom_live_state").upsert({ session_id: sessionId, ...update }, { onConflict: "session_id" }).select("session_id,version,interaction_id,mode,active_user_id,active_user_ids,mute_all,ended,updated_at").single();
      if (stateError) return json({ error: stateError.message }, 500);
      await admin.from("buklod_education_classroom_live_interactions").insert({ id: interactionId, session_id: sessionId, classroom_id: access.classroom.id, version, interaction_type: type, target_user_id: targetUserId, target_user_ids: activeIds, actor_user_id: user.id });
      return json({ event: { sessionId, interactionId, version, type, targetUserId, targetUserIds: activeIds, actorUserId: user.id, sentAt: new Date().toISOString() }, state });
    }

    if (action === "interaction_result") {
      const sessionId = String(body?.session_id || "");
      const interactionId = String(body?.interaction_id || "");
      const access = await loadSessionAccess(sessionId);
      if ("error" in access) return json({ error: access.error }, access.status);
      if (!interactionId) return json({ error: "interaction_id required" }, 400);
      const { data: row } = await admin.from("buklod_education_classroom_live_interactions").select("id,target_user_id,target_user_ids").eq("id", interactionId).eq("session_id", sessionId).maybeSingle();
      if (!row) return json({ error: "Interaction not found" }, 404);
      if (!access.isFaculty && row.target_user_id !== user.id && !(row.target_user_ids || []).includes(user.id)) return json({ error: "Interaction access denied" }, 403);
      const result = String(body?.result || "RESPONDED").toUpperCase().slice(0, 40);
      const evidence = typeof body?.network_evidence === "object" && body.network_evidence ? body.network_evidence : {};
      await admin.from("buklod_education_classroom_live_interactions").update({ result, network_evidence: evidence, completed_at: new Date().toISOString() }).eq("id", interactionId);
      return json({ ok: true });
    }

    if (action === "create_breakouts") {
      const sessionId = String(body?.session_id || "");
      const access = await loadSessionAccess(sessionId);
      if ("error" in access) return json({ error: access.error }, access.status);
      if (!access.isFaculty) return json({ error: "Faculty access required" }, 403);
      const rooms = Array.isArray(body?.rooms) ? body.rooms.slice(0, 12) : [];
      if (!rooms.length) return json({ error: "At least one breakout room is required" }, 400);
      await admin.from("buklod_education_classroom_breakout_rooms").update({ status: "CLOSED", closed_at: new Date().toISOString() }).eq("live_session_id", sessionId).eq("status", "OPEN");
      const created: any[] = [];
      for (let i = 0; i < rooms.length; i++) {
        const source = rooms[i] || {};
        const name = String(source.name || `Room ${i + 1}`).trim().slice(0, 80);
        const callId = `classroom-breakout-${sessionId.replaceAll("-","")}-${crypto.randomUUID().replaceAll("-","")}`;
        const timerMinutes = Math.max(1, Math.min(180, Number(source.timer_minutes || 15)));
        const { data: room, error: roomError } = await admin.from("buklod_education_classroom_breakout_rooms").insert({ live_session_id: sessionId, classroom_id: access.classroom.id, name, call_id: callId, timer_ends_at: new Date(Date.now() + timerMinutes * 60000).toISOString(), created_by: user.id }).select("id,name,call_id,status,timer_ends_at").single();
        if (roomError || !room) return json({ error: roomError?.message || "Could not create breakout room" }, 500);
        const members = Array.isArray(source.user_ids) ? Array.from(new Set(source.user_ids.map(String).filter(Boolean))).slice(0, 60) : [];
        if (members.length) await admin.from("buklod_education_classroom_breakout_members").insert(members.map((uid: string) => ({ room_id: room.id, user_id: uid, assigned_by: user.id })));
        created.push({ ...room, user_ids: members });
      }
      return json({ rooms: created });
    }

    if (action === "close_breakouts") {
      const sessionId = String(body?.session_id || "");
      const access = await loadSessionAccess(sessionId);
      if ("error" in access) return json({ error: access.error }, access.status);
      if (!access.isFaculty) return json({ error: "Faculty access required" }, 403);
      await admin.from("buklod_education_classroom_breakout_rooms").update({ status: "CLOSED", closed_at: new Date().toISOString() }).eq("live_session_id", sessionId).eq("status", "OPEN");
      return json({ ok: true });
    }

    const sessionId = String(body?.session_id || "");
    if (!sessionId) return json({ error: "session_id required" }, 400);
    const access = await loadSessionAccess(sessionId);
    if ("error" in access) return json({ error: access.error, code: (access as any).code }, access.status);

    let selectedCallId = access.session.call_id;
    if (action === "breakout_access") {
      const roomId = String(body?.room_id || "");
      const { data: room } = await admin.from("buklod_education_classroom_breakout_rooms").select("id,call_id,status,timer_ends_at").eq("id", roomId).eq("live_session_id", sessionId).eq("status", "OPEN").maybeSingle();
      if (!room) return json({ error: "Breakout room is unavailable" }, 404);
      if (!access.isFaculty) {
        const { data: member } = await admin.from("buklod_education_classroom_breakout_members").select("room_id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
        if (!member) return json({ error: "You are not assigned to this breakout room" }, 403);
      }
      selectedCallId = room.call_id;
    } else if (action !== "access") {
      return json({ error: "Unsupported action" }, 400);
    }

    const { data: profile } = await admin.from("profiles").select("full_name,first_name,surname,username").eq("id", user.id).maybeSingle();
    const displayName = profile?.full_name || [profile?.first_name, profile?.surname].filter(Boolean).join(" ") || profile?.username || user.email || "BUKLOD Classroom Member";
    const stream = new StreamClient(streamApiKey, streamApiSecret);
    await stream.upsertUsers([{ id: user.id, name: displayName, role: "user" }]);
    const remainingSeconds = access.stopMs === null ? null : Math.max(10, Math.floor((access.stopMs - access.nowMs) / 1000));
    const tokenValidity = remainingSeconds === null ? 12 * 60 * 60 : Math.max(10, Math.min(2 * 60 * 60, remainingSeconds));
    const token = stream.generateUserToken({ user_id: user.id, validity_in_seconds: tokenValidity });

    let participantId: string | null = null;
    if (action === "access") {
      if (access.isStudent) {
        const { data: openRows } = await admin.from("buklod_education_classroom_live_participants").select("id,joined_at").eq("session_id", access.session.id).eq("user_id", user.id).is("left_at", null);
        const takeoverAt = Date.now();
        for (const row of openRows ?? []) {
          const joinedAt = new Date(row.joined_at).getTime();
          const totalSeconds = Number.isFinite(joinedAt) ? Math.max(0, Math.round((takeoverAt - joinedAt) / 1000)) : 0;
          await admin.from("buklod_education_classroom_live_participants").update({ left_at: new Date(takeoverAt).toISOString(), total_seconds: totalSeconds }).eq("id", row.id).is("left_at", null);
        }
      }
      const { data: participant, error: participantError } = await admin.from("buklod_education_classroom_live_participants").insert({ session_id: access.session.id, classroom_id: access.classroom.id, user_id: user.id, participant_role: access.isFaculty ? "FACULTY" : "STUDENT" }).select("id,joined_at").single();
      if (participantError) console.error("participant insert", participantError.message);
      participantId = participant?.id || null;
    }
    const { data: state } = await admin.from("buklod_education_classroom_live_state").select("session_id,version,interaction_id,mode,active_user_id,active_user_ids,mute_all,ended,updated_at").eq("session_id", sessionId).maybeSingle();

    return json({ api_key: streamApiKey, token, user_id: user.id, user_name: displayName, call_type: "default", call_id: selectedCallId, classroom_id: access.classroom.id, classroom_name: access.classroom.name, role: access.isFaculty ? "FACULTY" : "STUDENT", plan_key: access.session.plan_key, hard_stop_at: access.session.hard_stop_at, remaining_seconds: remainingSeconds === null ? null : Math.max(0, remainingSeconds), participant_id: participantId, state, attendance_session_id: access.session.attendance_session_id });
  } catch (error) {
    console.error("buklod-classroom-stream-access", error);
    return json({ error: error instanceof Error ? error.message : "Could not access live classroom" }, 500);
  }
});