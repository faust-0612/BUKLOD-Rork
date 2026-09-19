import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function cleanUrl(value: string | undefined) {
  return String(value ?? "").trim().replace(/\/$/, "");
}

function safeText(value: unknown, max = 320) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return respond(405, { ok: false, error: "method_not_allowed" });
  }

  const supabaseUrl = cleanUrl(Deno.env.get("SUPABASE_URL"));
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    "";

  if (!supabaseUrl || !serviceKey) {
    return respond(503, {
      ok: false,
      error: "surface_entry_unavailable",
      message: "BUKLOD standalone entry is temporarily unavailable.",
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const target = safeText(body?.target, 32).toLowerCase();
  if (target !== "home" && target !== "kingdom") {
    return respond(400, {
      ok: false,
      error: "invalid_target",
      message: "Unknown BUKLOD standalone target.",
    });
  }

  const targetUrl = cleanUrl(
    target === "home"
      ? Deno.env.get("BUKLOD_HOME_WEB_URL")
      : Deno.env.get("BUKLOD_KINGDOM_WEB_URL"),
  );

  if (!targetUrl) {
    return respond(503, {
      ok: false,
      error: "target_not_configured",
      message: `BUKLOD ${target} standalone URL is not configured.`,
    });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) {
    return respond(401, {
      ok: false,
      error: "main_session_required",
      message: "Valid BUKLOD Main session required.",
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } =
    await admin.auth.getUser(bearer);
  const user = userData?.user ?? null;

  if (userError || !user?.id) {
    return respond(401, {
      ok: false,
      error: "main_session_invalid",
      message: "Your BUKLOD Main session is no longer valid.",
    });
  }

  const email = safeText(user.email, 320).toLowerCase();
  if (!email) {
    return respond(422, {
      ok: false,
      error: "main_email_missing",
      message: "Your BUKLOD Main account has no internal auth email for secure handoff.",
    });
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  const tokenHash = safeText(linkData?.properties?.hashed_token, 1200);
  if (linkError || !tokenHash) {
    console.error("buklod_surface_entry_link_error", {
      target,
      userId: String(user.id),
      message: linkError?.message ?? "missing_hashed_token",
    });

    return respond(503, {
      ok: false,
      error: "handoff_generation_failed",
      message: "BUKLOD verified your Main account but could not create the one-time standalone session.",
    });
  }

  const sessionLaunchUrl =
    `${targetUrl}/?buklod_surface=${encodeURIComponent(target)}&buklod_surface_token_hash=${encodeURIComponent(tokenHash)}`;

  console.log("buklod_surface_entry_success", {
    target,
    userId: String(user.id),
    source: safeText(body?.source, 120) || null,
  });

  return respond(200, {
    ok: true,
    target,
    authority: "buklod_main",
    session_launch_url: sessionLaunchUrl,
    expires_hint_seconds: 300,
  });
});
