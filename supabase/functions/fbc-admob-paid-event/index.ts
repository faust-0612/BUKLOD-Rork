import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "AUTH_REQUIRED" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return json({ error: "SERVER_CONFIG_MISSING" }, 500);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  const user = userData?.user;

  if (userError || !user) {
    return json({ error: "INVALID_SESSION" }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const eventId = cleanText(body.event_id, 180);
  const placement = cleanText(body.placement, 100);
  const adUnitId = cleanText(body.ad_unit_id, 180);
  const currency = cleanText(body.currency, 8).toUpperCase();
  const precision = Number(body.precision ?? 0);
  const value = Number(body.value ?? Number.NaN);

  if (!eventId) {
    return json({ error: "EVENT_ID_REQUIRED" }, 400);
  }

  if (!placement) {
    return json({ error: "PLACEMENT_REQUIRED" }, 400);
  }

  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    return json({ error: "INVALID_CURRENCY" }, 400);
  }

  if (!Number.isFinite(value) || value < 0 || value > 1000000) {
    return json({ error: "INVALID_VALUE" }, 400);
  }

  if (!Number.isFinite(precision) || precision < 0 || precision > 10) {
    return json({ error: "INVALID_PRECISION" }, 400);
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const normalizedPhp = currency === "PHP" ? value : null;

  const { data, error } = await serviceClient.rpc(
    "fbc_ingest_provider_finance_event_v1",
    {
      p_source_key: "admob",
      p_event_type: "REVENUE",
      p_amount: value,
      p_currency: currency,
      p_normalized_amount_php: normalizedPhp,
      p_financial_state: "PROVIDER_REPORTED",
      p_external_reference: adUnitId || null,
      p_idempotency_key: "admob-paid:" + eventId,
      p_occurred_at: new Date().toISOString(),
      p_metadata: {
        provider: "Google AdMob",
        revenue_kind: "impression_level",
        precision,
        placement,
        ad_unit_id: adUnitId || null,
        app_version: cleanText(body.app_version, 80) || null,
        platform: cleanText(body.platform, 40) || null,
        user_id: user.id,
        note:
          currency === "PHP"
            ? "Provider-reported paid event; bridged to R38 as estimated until statement reconciliation."
            : "Provider-reported paid event; native currency retained pending FX/reconciliation.",
      },
    },
  );

  if (error) {
    return json(
      {
        error: "INGEST_FAILED",
        detail: error.message,
      },
      500,
    );
  }

  return json({
    ok: true,
    source: "admob",
    event_id: eventId,
    currency,
    value,
    precision,
    normalized_php: normalizedPhp,
    result: data,
  });
});
