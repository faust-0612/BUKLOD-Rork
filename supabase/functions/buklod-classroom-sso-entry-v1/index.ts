import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

/**
 * Classroom one-tap SSO bridge.
 * Called ONLY by signed-in BUKLOD Main with Authorization Bearer, never with
 * credentials placed in the URL. Returns a one-time Supabase email magic-link
 * token hash for URL *fragment* transport; no long-lived access or refresh
 * token is embedded in a link.
 */
const CLASSROOM_URL = "https://buklod-classroom.expo.app/";
const KNOWN_MAIN_WEB_ORIGINS = new Set([
  "https://buklod.expo.app",
  "https://buklod-main.expo.app",
]);

function headers(origin: string | null): Headers {
  const h = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store, private, max-age=0",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  if (origin && KNOWN_MAIN_WEB_ORIGINS.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
  }
  return h;
}
function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const env = (key: string) => (Deno.env.get(key) || "").trim();

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !KNOWN_MAIN_WEB_ORIGINS.has(origin)) {
    return json(403, { ok: false, error: "origin_not_allowed" }, origin);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" }, origin);
  }

  const authorization = req.headers.get("authorization") || "";
  const accessToken = authorization.match(/^Bearer\s+(\S+)$/i)?.[1] || "";
  if (!accessToken || accessToken.length > 8000) {
    return json(401, { ok: false, error: "main_session_required" }, origin);
  }
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 512) {
    return json(413, { ok: false, error: "invalid_request" }, origin);
  }
  let mode: string;
  try {
    const body = await req.json();
    mode = String(body?.mode || "").toUpperCase();
  } catch {
    return json(400, { ok: false, error: "invalid_json" }, origin);
  }
  if (mode !== "STUDENT" && mode !== "FACULTY") {
    return json(400, { ok: false, error: "invalid_classroom_mode" }, origin);
  }

  const url = env("SUPABASE_URL");
  const publishable = env("SUPABASE_PUBLISHABLE_KEY") ||
    "sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS";
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
  if (!url || !serviceKey) {
    return json(503, { ok: false, error: "entry_service_unavailable" }, origin);
  }

  const userClient = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  // Validate the live Supabase Auth session, not email/role data supplied by
  // the browser or claims copied into request JSON.
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  const user = authData?.user;
  if (authError || !uuid(user?.id) || !user?.email) {
    return json(401, { ok: false, error: "main_session_required" }, origin);
  }

  // The same server authority that controls the Profile Classroom door
  // governs Faculty and Student independently (including dual-role users).
  const { data: access, error: accessError } =
    await userClient.rpc("buklod_classroom_launcher_access_v1");
  if (accessError) {
    return json(503, { ok: false, error: "classroom_role_check_unavailable" }, origin);
  }
  const authorized = access?.can_open === true &&
    (mode === "FACULTY" ? access?.is_faculty === true : access?.is_student === true);
  if (!authorized) {
    return json(403, { ok: false, error: "classroom_role_not_authorized" }, origin);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Check that the Auth user still owns the exact verified identity before
  // generating a one-time link. Never mutate profile, enrollment, or roles.
  const { data: adminData, error: adminUserError } =
    await admin.auth.admin.getUserById(user.id);
  const serverUser = adminData?.user;
  if (adminUserError || !serverUser || serverUser.id !== user.id ||
      !serverUser.email || !serverUser.email_confirmed_at ||
      serverUser.email.toLowerCase() !== user.email.toLowerCase() ||
      serverUser.is_anonymous === true) {
    return json(409, { ok: false, error: "verified_email_identity_required" }, origin);
  }

  // Atomic per-user 5-second gate limits duplicate request bursts.
  const { data: claimed, error: claimError } =
    await admin.rpc("buklod_classroom_sso_claim_v1", { p_user_id: user.id });
  if (claimError) {
    console.error("classroom_sso_rate_gate_failure", { code: claimError.code });
    return json(503, { ok: false, error: "entry_temporarily_unavailable" }, origin);
  }
  if (claimed !== true) {
    return json(429, { ok: false, error: "please_retry_shortly", retry_after_seconds: 5 }, origin);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: serverUser.email,
    options: { redirectTo: CLASSROOM_URL },
  });
  const tokenHash = String(link?.properties?.hashed_token || "");
  if (linkError || !/^[A-Za-z0-9_-]{30,512}$/.test(tokenHash)) {
    console.error("classroom_sso_link_failure", { code: linkError?.code || "missing_token" });
    return json(503, { ok: false, error: "entry_temporarily_unavailable" }, origin);
  }

  // The browser MUST clear the fragment before exchanging this single-use
  // token with Supabase Auth.verifyOtp. No access/refresh token travels in URL.
  return json(200, {
    ok: true,
    token_hash: tokenHash,
    type: "email",
    mode,
    user_id: user.id,
    classroom_url: CLASSROOM_URL,
  }, origin);
});
