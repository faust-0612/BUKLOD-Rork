import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { StreamClient } from "npm:@stream-io/node-sdk";

const CALL_TYPE = "buklod_ptt";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-buklod-client, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function validChannel(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

function callIdFor(scopeId: string, channel: number) {
  return `ptt_${scopeId.replace(/-/g, "")}_ch${String(channel).padStart(2, "0")}`;
}

async function ensurePttCallType(stream: StreamClient) {
  const listed: any = await stream.video.listCallTypes();
  const callTypes = listed?.call_types ?? listed?.callTypes ?? {};
  const existing = callTypes?.[CALL_TYPE];

  const requiredMember = ["join-call", "read-call", "send-audio"];
  const currentUser = Array.isArray(existing?.grants?.user) ? existing.grants.user : [];
  const currentMember = Array.isArray(existing?.grants?.call_member)
    ? existing.grants.call_member
    : [];

  if (!existing) {
    await stream.video.createCallType({
      name: CALL_TYPE,
      grants: {
        user: [],
        call_member: requiredMember,
      },
    });
    return;
  }

  const needsUpdate =
    currentUser.includes("join-call") ||
    requiredMember.some((cap) => !currentMember.includes(cap));

  if (needsUpdate) {
    await stream.video.updateCallType({
      name: CALL_TYPE,
      grants: {
        user: currentUser.filter((cap: string) => cap !== "join-call"),
        call_member: Array.from(new Set([...currentMember, ...requiredMember])),
      },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const streamApiKey = Deno.env.get("STREAM_API_KEY");
    const streamApiSecret = Deno.env.get("STREAM_API_SECRET");

    if (!supabaseUrl || !anonKey || !serviceKey || !streamApiKey || !streamApiSecret) {
      throw new Error("Required server configuration is missing.");
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ error: authError?.message || "Invalid user session" }, 401);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const scopeId = String(body?.scope_id ?? "").trim();
    const channel = validChannel(body?.channel);
    if (!scopeId || !channel) {
      return json({ error: "scope_id and channel 1-10 are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const membership = await admin
      .from("buklod_scope_memberships")
      .select("scope_id,membership_status")
      .eq("scope_id", scopeId)
      .eq("user_id", user.id)
      .eq("membership_status", "ACTIVE")
      .maybeSingle();

    if (membership.error) throw membership.error;
    if (!membership.data) return json({ error: "PTT_SCOPE_NOT_AUTHORIZED" }, 403);

    const scope = await admin
      .from("buklod_scopes")
      .select("id,name,scope_type,status")
      .eq("id", scopeId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (scope.error) throw scope.error;
    if (
      !scope.data ||
      !["ORGANIZATION", "CLUSTER", "LOCAL"].includes(String(scope.data.scope_type))
    ) {
      return json({ error: "PTT_SCOPE_NOT_AUTHORIZED" }, 403);
    }

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "BUKLOD Member";

    const stream = new StreamClient(streamApiKey, streamApiSecret);

    await stream.upsertUsers([
      {
        id: user.id,
        name: displayName,
        role: "user",
      },
    ]);

    await ensurePttCallType(stream);

    const callId = callIdFor(scopeId, channel);
    const call = stream.video.call(CALL_TYPE, callId);

    await call.getOrCreate({
      data: {
        created_by_id: user.id,
        members: [{ user_id: user.id, role: "call_member" }],
        custom: {
          buklod_ptt: true,
          scope_id: scopeId,
          scope_type: scope.data.scope_type,
          logical_channel: channel,
        },
      },
    });

    await call.updateCallMembers({
      update_members: [{ user_id: user.id, role: "call_member" }],
    });

    const token = stream.generateUserToken({
      user_id: user.id,
      validity_in_seconds: 60 * 60,
    });

    return json({
      token,
      api_key: streamApiKey,
      user_id: user.id,
      call_type: CALL_TYPE,
      call_id: callId,
      scope: {
        id: scope.data.id,
        name: scope.data.name,
        scope_type: scope.data.scope_type,
      },
      expires_in: 60 * 60,
    });
  } catch (error) {
    console.error("buklod-ptt-access error", error);
    return json({
      error: error instanceof Error ? error.message : "Could not authorize BUKLOD PTT",
    }, 500);
  }
});
