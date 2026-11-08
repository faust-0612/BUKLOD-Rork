// BUKLOD official AdMob NETWORK report → QMP noncash preview.
// Native AdMob ad impressions are accounted for by Network reports, not
// third-party Mediation reports. Keep this source exclusive to prevent
// accidental double counting if mediation is added in the future.
// Deploy with JWT verification enabled. Invoke with a *server-only* service-role
// bearer token from a scheduled worker; never send this token to a device.
// Required secrets: ADMOB_OAUTH_CLIENT_ID, ADMOB_OAUTH_CLIENT_SECRET,
// ADMOB_OAUTH_REFRESH_TOKEN, BUKLOD_ADMOB_PUBLISHER_ID,
// BUKLOD_ADMOB_APP_ID. No client-side AdMob revenue can fund an estimate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const requireEnv = (key: string) => {
  const value = (Deno.env.get(key) || '').trim();
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
};
function manilaParts(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}
async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  // Never surface OAuth or report response bodies to callers or logs.
  if (!response.ok) throw new Error(`AdMob API request failed: HTTP ${response.status}`);
  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const url = requireEnv('SUPABASE_URL');
    const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    // A trusted scheduler must authenticate with the server service key.
    if (!token || token !== serviceRole) return json({ error: 'Authorized scheduler required' }, 401);

    const clientId = requireEnv('ADMOB_OAUTH_CLIENT_ID');
    const clientSecret = requireEnv('ADMOB_OAUTH_CLIENT_SECRET');
    const refreshToken = requireEnv('ADMOB_OAUTH_REFRESH_TOKEN');
    const publisherId = requireEnv('BUKLOD_ADMOB_PUBLISHER_ID');
    const appId = requireEnv('BUKLOD_ADMOB_APP_ID');
    if (!/^pub-\d+$/.test(publisherId) || !/^ca-app-pub-\d+~\d+$/.test(appId))
      return json({ error: 'Invalid AdMob account/app configuration' }, 503);

    const oauth = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    }, 12_000);
    if (!oauth?.access_token) throw new Error('AdMob OAuth access token was not returned');

    const date = manilaParts(new Date());
    const periodKey = `${date.year}-${String(date.month).padStart(2, '0')}`;
    const report = await fetchJson(
      `https://admob.googleapis.com/v1/accounts/${publisherId}/networkReport:generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oauth.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportSpec: {
            dateRange: {
              startDate: { year: date.year, month: date.month, day: 1 },
              endDate: date,
            },
            dimensions: ['APP'],
            dimensionFilters: [{
              dimension: 'APP', matchesAny: { values: [{ value: appId }] },
            }],
            metrics: ['ESTIMATED_EARNINGS'],
            localizationSettings: { currencyCode: 'PHP', languageCode: 'en-US' },
          },
        }),
      },
      20_000,
    );
    if (!Array.isArray(report)) throw new Error('Unexpected AdMob report response');
    const header = report.find((item) => item?.header)?.header;
    if (header?.localizationSettings?.currencyCode !== 'PHP')
      throw new Error('AdMob did not confirm PHP report currency');
    // Google terminates a complete report with a footer. Do not store a
    // partial stream or silently treat a truncated response as zero earnings.
    if (!report.some((item) => item?.footer))
      throw new Error('AdMob network report footer missing');

    let totalMicros = 0n;
    for (const entry of report) {
      if (!entry?.row) continue;
      if (entry.row.dimensionValues?.APP?.value !== appId)
        throw new Error('AdMob report included an unexpected app');
      const micros = String(entry.row.metricValues?.ESTIMATED_EARNINGS?.microsValue ?? '');
      if (!/^\d+$/.test(micros)) throw new Error('AdMob report earnings format invalid');
      totalMicros += BigInt(micros);
    }
    if (totalMicros < 0n || totalMicros > 1_000_000_000_000_000n)
      throw new Error('AdMob report amount outside the configured noncash estimate bound');
    const amountPhp = Number(totalMicros) / 1_000_000;
    // Only this server-only RPC records a provisional estimate. It does not
    // insert into Finance V3, settle referrals, or affect withdrawable balances.
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { error } = await admin.rpc('admin_set_buklod_community_admob_estimate_v1', {
      p_period_key: periodKey,
      p_amount_php: amountPhp,
      p_source_reference: `OFFICIAL_ADMOB_NETWORK:${publisherId}:${appId}:${periodKey}:PHP`,
      p_source_mode: 'OFFICIAL_ADMOB_API',
      p_observed_at: new Date().toISOString(),
    });
    if (error) throw new Error('Estimate snapshot storage failed');
    return json({
      status: 'PRELIMINARY_ONLY',
      period_key: periodKey,
      amount_php: amountPhp,
      source: 'OFFICIAL_ADMOB_API',
      finalized: false, cash_credited: false, withdrawable: false,
    });
  } catch (error) {
    // Fail closed: never invent/estimate a value on OAuth, report, or DB error.
    const kind = error instanceof Error && error.message.startsWith('Missing server configuration')
      ? 'SOURCE_NOT_CONFIGURED'
      : 'SOURCE_UNAVAILABLE';
    return json({ error: kind }, 503);
  }
});
