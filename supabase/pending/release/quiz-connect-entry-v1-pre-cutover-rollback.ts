import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const QUIZ_ENTRY_URL = "https://cjtehbfspgimyhifnjon.supabase.co/functions/v1/buklod-quiz-main-entry-v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { ok: false, error: "method_not_allowed" });

  const authorization = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return respond(401, {
      ok: false,
      error: "main_session_required",
      message: "Valid BUKLOD Main session required.",
    });
  }

  try {
    const quizResponse = await fetch(QUIZ_ENTRY_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(12000),
    });

    const payload = await quizResponse.json().catch(() => null);
    if (!quizResponse.ok || !payload?.ok || !payload?.launch_url) {
      return respond(quizResponse.status || 503, {
        ok: false,
        error: payload?.error ?? "quiz_entry_failed",
        message: payload?.message ?? "BUKLOD Quiz entry is temporarily unavailable.",
        retry_after_ms: payload?.retry_after_ms ?? null,
      });
    }

    return respond(200, {
      ok: true,
      authority: "buklod_main",
      launch_url: payload.launch_url,
      quiz_url: payload.quiz_url ?? "https://buklod-quiz.expo.app",
      expires_hint_seconds: payload.expires_hint_seconds ?? 300,
    });
  } catch (error) {
    console.error("buklod_quiz_entry_proxy_error", {
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return respond(503, {
      ok: false,
      error: "quiz_entry_unavailable",
      message: "BUKLOD Quiz entry is temporarily unavailable. Please try again.",
    });
  }
});
