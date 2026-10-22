import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAIN_URL = "https://yhanxndaqbmuzbdqlblu.supabase.co";
const MAIN_PUBLISHABLE_KEY = "sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS";
const QUIZ_WEB_URL = "https://buklod-quiz.expo.app";

const mainAuth = createClient(MAIN_URL, MAIN_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function safeText(value: unknown, max = 320) {
  return String(value ?? "").trim().slice(0, max);
}

async function getMainUser(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;

  try {
    /*
     * BUKLOD_MASS_LOGIN_MAIN_QUIZ_R22
     * Verify the Main access token with Supabase getClaims(). With asymmetric
     * signing this uses the project's JWKS (cached by supabase-js) instead of
     * calling Main /auth/v1/user once for every Quiz launch. This removes an
     * avoidable Auth-server request from the mass-login hot path while still
     * cryptographically validating the token before trusting its claims.
     */
    const { data, error } = await mainAuth.auth.getClaims(token);
    const claims = data?.claims as Record<string, unknown> | undefined;

    if (error || !claims) return null;

    const id = safeText(claims.sub, 80);
    const email = safeText(claims.email, 320).toLowerCase();
    const issuer = safeText(claims.iss, 320);
    const rawAudience = claims.aud;
    const audience = Array.isArray(rawAudience)
      ? rawAudience.map((value) => safeText(value, 80))
      : [safeText(rawAudience, 80)];

    if (
      !id ||
      !email ||
      issuer !== `${MAIN_URL}/auth/v1` ||
      !audience.includes("authenticated")
    ) {
      return null;
    }

    const userMetadata: Record<string, unknown> =
      claims.user_metadata &&
      typeof claims.user_metadata === "object" &&
      !Array.isArray(claims.user_metadata)
        ? claims.user_metadata as Record<string, unknown>
        : {};

    return {
      id,
      email,
      user_metadata: userMetadata,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { ok: false, error: "method_not_allowed" });

  const mainUser = await getMainUser(req);
  if (!mainUser) {
    return respond(401, {
      ok: false,
      error: "main_session_required",
      message: "Valid BUKLOD Main session required.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) {
    return respond(503, {
      ok: false,
      error: "quiz_service_unavailable",
      message: "BUKLOD Quiz entry service is temporarily unavailable.",
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: claimed, error: gateError } = await admin.rpc(
    "buklod_quiz_claim_main_entry_v1",
    { p_user_id: mainUser.id },
  );

  if (gateError) {
    console.error("quiz_main_entry_gate_error", { code: gateError.code });
    return respond(503, {
      ok: false,
      error: "entry_temporarily_unavailable",
      message: "Quiz entry is temporarily unavailable. Please try again.",
    });
  }

  if (claimed !== true) {
    return respond(409, {
      ok: false,
      error: "entry_already_in_progress",
      retry_after_ms: 3000,
      message: "Your Quiz entry request is already being processed.",
    });
  }

  const email = safeText(mainUser.email, 320).toLowerCase();
  if (!email) {
    return respond(422, {
      ok: false,
      error: "main_email_missing",
      message: "Your BUKLOD Main account is valid but has no internal auth email.",
    });
  }

  const sourceMeta = mainUser.user_metadata && typeof mainUser.user_metadata === "object"
    ? mainUser.user_metadata
    : {};

  const userMetadata = {
    username: safeText(sourceMeta.username, 120) || null,
    full_name: safeText(sourceMeta.full_name, 220) || null,
    first_name: safeText(sourceMeta.first_name, 120) || null,
    middle_name: safeText(sourceMeta.middle_name, 120) || null,
    surname: safeText(sourceMeta.surname, 120) || null,
    suffix: safeText(sourceMeta.suffix, 50) || null,
    mobile: safeText(sourceMeta.mobile, 50) || null,
    role: safeText(sourceMeta.role, 80) || "member",
    authority: "buklod_main",
  };

  const { data: ensured, error: ensureError } = await admin.rpc(
    "buklod_quiz_ensure_main_shadow_user_v1",
    {
      p_user_id: mainUser.id,
      p_email: email,
      p_user_metadata: userMetadata,
    },
  );

  if (ensureError || !ensured?.ok) {
    console.error("quiz_main_entry_identity_error", {
      code: ensureError?.code ?? ensured?.error ?? "unknown",
    });
    return respond(409, {
      ok: false,
      error: ensured?.error ?? "quiz_identity_unavailable",
      message: "Your Main account is valid, but Quiz identity preparation could not be completed.",
    });
  }

  /*
   * BUKLOD_QUIZ_MAIN_ENTRY_EXISTING_IDENTITY_RECONCILE_R6
   * Existing Quiz shadow users can predate the current Main identity values.
   * Main is the authoritative identity for this bridge, so reconcile the
   * dedicated Quiz Auth email + user metadata before generating a magic link.
   * This fixes per-user handoff failures without touching exam/attempt data.
   */
  const { data: quizUserData, error: quizUserReadError } =
    await admin.auth.admin.getUserById(mainUser.id);

  const quizUser = quizUserData?.user ?? null;
  if (quizUserReadError || !quizUser) {
    console.error("quiz_main_entry_user_read_error", {
      message: quizUserReadError?.message ?? "missing_quiz_user",
    });
    return respond(409, {
      ok: false,
      error: "quiz_identity_unavailable",
      message: "Your Main account was verified, but Quiz could not load its dedicated identity.",
    });
  }

  const quizEmail = safeText(quizUser.email, 320).toLowerCase();
  const quizMetadata =
    quizUser.user_metadata && typeof quizUser.user_metadata === "object"
      ? quizUser.user_metadata
      : {};

  const metadataOutOfSync =
    safeText(quizMetadata.username, 120) !== safeText(userMetadata.username, 120) ||
    safeText(quizMetadata.full_name, 220) !== safeText(userMetadata.full_name, 220) ||
    safeText(quizMetadata.first_name, 120) !== safeText(userMetadata.first_name, 120) ||
    safeText(quizMetadata.middle_name, 120) !== safeText(userMetadata.middle_name, 120) ||
    safeText(quizMetadata.surname, 120) !== safeText(userMetadata.surname, 120) ||
    safeText(quizMetadata.suffix, 50) !== safeText(userMetadata.suffix, 50) ||
    safeText(quizMetadata.mobile, 50) !== safeText(userMetadata.mobile, 50) ||
    safeText(quizMetadata.role, 80) !== safeText(userMetadata.role, 80) ||
    safeText(quizMetadata.authority, 80) !== "buklod_main";

  if (quizEmail !== email || metadataOutOfSync) {
    const { error: quizUserSyncError } =
      await admin.auth.admin.updateUserById(mainUser.id, {
        email,
        email_confirm: true,
        user_metadata: {
          ...quizMetadata,
          ...userMetadata,
          authority: "buklod_main",
        },
      });

    if (quizUserSyncError) {
      console.error("quiz_main_entry_user_sync_error", {
        message: quizUserSyncError.message,
      });
      return respond(409, {
        ok: false,
        error: "quiz_identity_sync_failed",
        message: "Your Main account was verified, but Quiz could not refresh its dedicated sign-in identity.",
      });
    }
  }

  const profileRow = {
    id: mainUser.id,
    email,
    username: userMetadata.username,
    full_name: userMetadata.full_name,
    first_name: userMetadata.first_name,
    middle_name: userMetadata.middle_name,
    surname: userMetadata.surname,
    suffix: userMetadata.suffix,
    mobile: userMetadata.mobile,
    role: userMetadata.role,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(profileRow, { onConflict: "id" });

  if (profileError) {
    console.warn("quiz_main_entry_profile_sync_error", { code: profileError.code });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: QUIZ_WEB_URL },
  });

  const properties = linkData?.properties;
  const actionLink = properties?.action_link;
  if (linkError || !actionLink) {
    console.error("quiz_main_entry_link_error", { message: linkError?.message ?? "missing_action_link" });
    return respond(503, {
      ok: false,
      error: "handoff_generation_failed",
      message: "Your Main account was verified, but the one-time Quiz entry could not be created.",
    });
  }

  console.log("quiz_main_entry_success", {
    userId: String(mainUser.id),
    shadowCreated: ensured?.created === true,
  });

  const tokenHash = safeText(properties?.hashed_token, 1200);
  const sessionLaunchUrl = tokenHash
    ? `${QUIZ_WEB_URL}/?buklod_quiz_token_hash=${encodeURIComponent(tokenHash)}`
    : null;

  return respond(200, {
    ok: true,
    authority: "buklod_main",
    user_id: mainUser.id,
    launch_url: actionLink,
    quiz_url: QUIZ_WEB_URL,
    one_time_code: properties?.email_otp ?? null,
    token_hash: tokenHash || null,
    session_launch_url: sessionLaunchUrl,
    /*
     * BUKLOD_QUIZ_DEVICE_SESSION_HANDOFF_R7
     * The live Quiz bundle includes the token-hash consumer. Prefer the
     * direct Quiz page so its own client installs the dedicated session.
     * Release still requires a successful signed-in handoff smoke test.
     * A missing hash retains the legacy fallback.
     */
    session_launch_ready: Boolean(sessionLaunchUrl),
    expires_hint_seconds: 300,
    shadow_created: ensured?.created === true,
  });
});
