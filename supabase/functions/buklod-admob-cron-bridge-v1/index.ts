// BUKLOD internal AdMob scheduler bridge. Dedicated 256-bit Vault token only.
// verify_jwt=false on THIS proxy: its credential is not a JWT and is checked
// before any privileged action using a service-role-only SQL verifier.
// The existing provider importer REMAINS verify_jwt=true at the gateway.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return json({ error: 'Unauthorized' }, 401);

  try {
    const url = String(Deno.env.get('SUPABASE_URL') || '').trim();
    const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !serviceRole)
      return json({ error: 'Server configuration unavailable' }, 503);

    // Never compare the secret against a value in source code or transmit it to
    // the official Google AdMob importer. Service role remains server-side.
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data: allowed, error: authError } = await admin.rpc(
      'buklod_authorize_admob_cron_token_v1', { p_token: token },
    );
    if (authError || allowed !== true) return json({ error: 'Unauthorized' }, 401);

    // Only an authorized cron sender may ask the existing JWT-gated importer
    // to fetch new provider Network reports. The proxy cannot create cash.
    const response = await fetch(url + '/functions/v1/buklod-admob-revenue-preview-sync', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + serviceRole,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(75000),
    });
    if (!response.ok)
      return json({ error: 'Official AdMob report unavailable', provider_status: response.status }, 503);
    const report = await response.json();
    if (report?.status !== 'PRELIMINARY_ONLY'
      || report?.finalized !== false
      || report?.cash_credited !== false
      || report?.withdrawable !== false
      || !/^\d{4}-\d{2}$/.test(String(report.period_key || '')))
      return json({ error: 'Unverified AdMob importer response' }, 503);

    return json({
      status: 'PRELIMINARY_ONLY',
      period_key: report.period_key,
      report_date: report.report_date ?? null,
      result_status: report.result_status ?? null,
      finalized: false, cash_credited: false, withdrawable: false,
    });
  } catch {
    return json({ error: 'Official AdMob sync unavailable' }, 503);
  }
});
