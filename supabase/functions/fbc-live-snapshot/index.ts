import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://buklod-fbc.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://buklod-fbc.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  if (req.method !== "GET") {
    return json(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "AUTH_REQUIRED" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return json(req, { error: "SERVER_CONFIG_MISSING" }, 500);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser();

  const user = userData?.user;

  if (userError || !user) {
    return json(req, { error: "INVALID_SESSION" }, 401);
  }

  const { data: isAdmin, error: adminError } =
    await userClient.rpc("buklod_is_system_admin");

  if (adminError || isAdmin !== true) {
    return json(req, { error: "SYSTEM_ADMIN_REQUIRED" }, 403);
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [
    quickcheckResult,
    mainEconomyResult,
    referralEconomyResult,
    splitResult,
    economyConfigResult,
    productsResult,
    actionPricesResult,
    controlCenterResult,
  ] = await Promise.all([
    serviceClient.rpc("quickcheck_finance_snapshot"),
    userClient.rpc("buklod_r36_system_admin_economy_health_v1"),
    userClient.rpc("admin_get_buklod_r38_economy_report_v1", {
      p_period_key: null,
    }),
    userClient.rpc("get_buklod_revenue_split_config_v1"),
    serviceClient
      .from("quickcheck_economy_config")
      .select(
        "currency,enforcement_mode,target_margin_bps,min_operating_margin_bps,target_operating_margin_bps,ads_enabled,rewarded_ads_enabled,payment_provider,payout_provider,fcc_sync_enabled,provider_activation_state,updated_at",
      )
      .eq("id", true)
      .maybeSingle(),
    serviceClient
      .from("quickcheck_products")
      .select(
        "code,kind,name,price_minor,wallet_credit_minor,duration_days,ad_free,active,sort_order,updated_at",
      )
      .eq("active", true)
      .order("sort_order"),
    serviceClient
      .from("quickcheck_action_prices")
      .select("action,base_minor,unit_minor,description,active,updated_at")
      .eq("active", true)
      .order("action"),
    userClient.rpc("admin_fbc_control_center_v1"),
  ]);

  const errors = [
    quickcheckResult.error
      ? { source: "quickcheck", message: quickcheckResult.error.message }
      : null,
    mainEconomyResult.error
      ? {
          source: "main_economy",
          message: mainEconomyResult.error.message,
        }
      : null,
    referralEconomyResult.error
      ? {
          source: "referral_economy",
          message: referralEconomyResult.error.message,
        }
      : null,
    splitResult.error
      ? { source: "revenue_split", message: splitResult.error.message }
      : null,
    economyConfigResult.error
      ? {
          source: "quickcheck_config",
          message: economyConfigResult.error.message,
        }
      : null,
    productsResult.error
      ? {
          source: "quickcheck_products",
          message: productsResult.error.message,
        }
      : null,
    actionPricesResult.error
      ? {
          source: "quickcheck_action_prices",
          message: actionPricesResult.error.message,
        }
      : null,
    controlCenterResult.error
      ? {
          source: "fbc_control_center",
          message: controlCenterResult.error.message,
        }
      : null,
  ].filter(Boolean);

  const referral = referralEconomyResult.data ?? null;

  const referralSafe = referral
    ? {
        period: referral.period ?? null,
        revenue_chain: referral.revenue_chain ?? null,
        distributed: referral.distributed ?? null,
        cash_ledger: referral.cash_ledger ?? null,
        referral_states: referral.referral_states ?? {},
        withdrawals: referral.withdrawals ?? {},
        invariant_checks: referral.invariant_checks ?? null,
        activation: referral.activation ?? null,
      }
    : null;

  const quickcheck = quickcheckResult.data ?? null;
  const controlCenter = controlCenterResult.data ?? null;

  const hasQuickcheckMoney = Boolean(
    quickcheck &&
      (Number(quickcheck.grossRevenueMinor ?? 0) !== 0 ||
        Number(quickcheck.cashCollectedMinor ?? 0) !== 0 ||
        Number(quickcheck.operatingCostsMinor ?? 0) !== 0 ||
        Number(quickcheck.operatingProfitMinor ?? 0) !== 0 ||
        Number(quickcheck.walletLiabilityMinor ?? 0) !== 0),
  );

  const hasReferralPeriod = Boolean(referralSafe?.period);

  const hasUniversalFinanceEvents = Boolean(
    Number(controlCenter?.recent_finance_events?.length ?? 0) > 0,
  );

  return json(req, {
    mode: "LIVE",
    authoritative: true,
    mockData: false,
    generatedAt: new Date().toISOString(),
    actor: {
      userId: user.id,
      systemAdmin: true,
    },
    dataState:
      hasQuickcheckMoney ||
      hasReferralPeriod ||
      hasUniversalFinanceEvents
        ? "LIVE_ACTIVITY"
        : "LIVE_NO_FINANCE_ACTIVITY",
    quickcheck,
    quickcheckConfig: economyConfigResult.data ?? null,
    quickcheckProducts: productsResult.data ?? [],
    quickcheckActionPrices: actionPricesResult.data ?? [],
    buklodEconomyHealth: mainEconomyResult.data ?? null,
    referralEconomy: referralSafe,
    revenueSplit: splitResult.data ?? null,
    providerControlCenter: controlCenter,
    errors,
  });
});
