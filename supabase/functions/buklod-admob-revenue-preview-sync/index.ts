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
import { hasGatewayVerifiedServiceRoleClaims, hasGatewayVerifiedServiceRoleSecretKey } from './gateway-service-role.mjs';
import { summarizeDatedAdmobReport } from './report-totals.mjs';

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
function dateParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
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
    // Security boundary: verify_jwt=true. The gateway validates legacy JWTs
    // or current sb_secret_ keys (minted compatibility). A modern secret key
    // is not itself a JWT; compare it only to this server's own expected key.
    // Both trusted paths are forbidden when verify_jwt=false.
    if (!token || !(hasGatewayVerifiedServiceRoleClaims(token)
      || hasGatewayVerifiedServiceRoleSecretKey(token, serviceRole)))
      return json({ error: 'Authorized scheduler required' }, 401);

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

    const account = await fetchJson(
      `https://admob.googleapis.com/v1/accounts/${publisherId}`,
      { headers: { Authorization: `Bearer ${oauth.access_token}` } }, 12_000,
    );
    const timeZone = String(account?.reportingTimeZone || '');
    if (!timeZone || timeZone.length > 64) throw new Error('AdMob reporting timezone unavailable');
    const date = dateParts(new Date(), timeZone);
    const manila = dateParts(new Date(), 'Asia/Manila');
    if (date.year !== manila.year || date.month !== manila.month)
      throw new Error('Provider and Manila QMP months disagree');
    const periodKey = `${date.year}-${String(date.month).padStart(2, '0')}`;
    const reportDate = `${periodKey}-${String(date.day).padStart(2, '0')}`;
    const reportDay = reportDate.replace(/-/g, '');
    const report = await fetchJson(
      `https://admob.googleapis.com/v1/accounts/${publisherId}/networkReport:generate`,
      { method: 'POST',
        headers: { Authorization: `Bearer ${oauth.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportSpec: {
          dateRange: { startDate: { year: date.year, month: date.month, day: 1 }, endDate: date },
          dimensions: ['DATE', 'APP'],
          dimensionFilters: [{ dimension: 'APP', matchesAny: { values: [appId] } }],
          metrics: ['ESTIMATED_EARNINGS'],
          localizationSettings: { currencyCode: 'PHP', languageCode: 'en-US' },
        } }),
      }, 20_000,
    );
    const { totalMicros, dayMicros } = summarizeDatedAdmobReport(report, appId, reportDay);
    const amountPhp = Number(totalMicros) / 1_000_000;
    const todayPhp = Number(dayMicros) / 1_000_000;
    // Atomic, service-only write. No cash allocation or payout.
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: result, error } = await admin.rpc('buklod_write_admob_daily_preview_v2', {
      p_period_key: periodKey, p_month_php: amountPhp, p_report_date: reportDate,
      p_today_php: todayPhp,
      p_source_reference: `OFFICIAL_ADMOB_NETWORK:${publisherId}:${appId}:${periodKey}:PHP`,
      p_reporting_time_zone: timeZone, p_observed_at: new Date().toISOString(),
    });
    if (error || !['PRELIMINARY_ONLY', 'OLDER_REPORT_IGNORED'].includes(result?.status))
      throw new Error('Estimate snapshot storage failed');
    return json({
      status: 'PRELIMINARY_ONLY',
      period_key: periodKey,
      amount_php: amountPhp,
      today_amount_php: todayPhp,
      report_date: reportDate,
      reporting_time_zone: timeZone,
      result_status: result.status,
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
