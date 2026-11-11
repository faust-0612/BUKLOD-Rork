import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { StreamClient } from "npm:@stream-io/node-sdk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-buklod-client, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function callIdFor(scopeId: string, channel: number) {
  return `ptt_${scopeId.replace(/-/g, "")}_ch${String(channel).padStart(2, "0")}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const streamKey = Deno.env.get("STREAM_API_KEY");
  const streamSecret = Deno.env.get("STREAM_API_SECRET");
  if (!supabaseUrl || !anon || !service || !streamKey || !streamSecret) {
    return response({ error: "Caption service is not configured." }, 503);
  }
  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) return response({ error: "Sign-in required." }, 401);
  const authClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return response({ error: "Invalid session." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return response({ error: "Invalid request JSON." }, 400); }
  const scopeId = String(body.scope_id || "");
  const channel = Number(body.channel);
  const action = String(body.action || "");
  const language = body.language === "en" ? "en" : "tl";
  if (!UUID.test(scopeId) || !Number.isInteger(channel) || channel < 1 || channel > 10 ||
      !["start", "stop"].includes(action)) {
    return response({ error: "Valid scope, channel, and action are required." }, 400);
  }
  const admin = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Do not trust the client-supplied channel/scope without checking membership.
  const { data: membership, error: memberError } = await admin.from("buklod_scope_memberships")
    .select("scope_id")
    .eq("scope_id", scopeId).eq("user_id", user.id)
    .eq("membership_status", "ACTIVE").maybeSingle();
  if (memberError) return response({ error: "Cannot verify membership." }, 503);
  if (!membership) return response({ error: "Not a member of this PTT group." }, 403);
  const { data: scope, error: scopeError } = await admin.from("buklod_scopes")
    .select("id").eq("id", scopeId).eq("status", "ACTIVE")
    .in("scope_type", ["ORGANIZATION", "CLUSTER", "LOCAL"]).maybeSingle();
  if (scopeError || !scope) return response({ error: "PTT group is unavailable." }, 403);

  try {
    const stream = new StreamClient(streamKey, streamSecret);
    const call = stream.video.call("buklod_ptt", callIdFor(scopeId, channel));
    // A user must first connect to an existing, authorized PTT call.
    await call.get();
    if (action === "start") {
      // Per-call only. Do not mutate all PTT channels or auto-enable expensive
      // transcription for unrelated groups.
      await call.update({
        settings_override: {
          transcription: {
            mode: "available", closed_caption_mode: "available", language,
            // Short PTT turns finalize quickly without new audio capture.
            speech_segment_config: { max_speech_caption_ms: 5000, silence_duration_ms: 700 },
          },
        },
      });
      try {
        await call.startClosedCaptions({ language });
      } catch (error: any) {
        const message = String(error?.message || "");
        if (!/already (started|running|enabled)|in progress/i.test(message)) throw error;
      }
    } else {
      try {
        await call.stopClosedCaptions();
      } catch (error: any) {
        const message = String(error?.message || "");
        if (!/not (running|started|enabled)|already stopped/i.test(message)) throw error;
      }
    }
    return response({ ok: true, captions_active: action === "start", language });
  } catch (error: any) {
    console.error("buklod-ptt-captions failed", { action, code: error?.code, status: error?.status });
    return response({ error: "Stream captions unavailable. Check the channel configuration or try again." }, 503);
  }
});
