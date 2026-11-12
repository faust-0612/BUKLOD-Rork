// Read-only BUKLOD infrastructure telemetry. Service key never leaves the Edge.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';
import { parseBuklodProviderMetrics } from './parse.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};
const respond = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length > 5000) return respond({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  const projectRef = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1];
  if (!projectRef || !service || !publishable) return respond({ error: 'PROVIDER_UNAVAILABLE' }, 503);

  try {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user) return respond({ error: 'Invalid session' }, 401);
    // Authorize via authenticated identity, not via untrusted user_metadata.
    const caller = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: isAdmin, error: gateError } = await caller.rpc('is_system_admin');
    if (gateError || isAdmin !== true) return respond({ error: 'System Admin required' }, 403);

    const metricsUrl = `https://${projectRef}.supabase.co/customer/v1/privileged/metrics`;
    const response = await fetch(metricsUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${btoa('service_role:' + service)}` },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok || Number(response.headers.get('content-length') || '0') > 2_000_000)
      return respond({ error: 'PROVIDER_UNAVAILABLE' }, 503);
    const raw = await response.text();
    const metrics = parseBuklodProviderMetrics(raw, projectRef);
    if (!metrics) return respond({ error: 'PROVIDER_UNAVAILABLE' }, 503);
    return respond({
      ...metrics, source: 'Supabase Metrics API (database host)',
      sampled_at: new Date().toISOString(),
      cpu_note: 'CPU load / vCPU is not the same as CPU utilization.',
      quota_note: 'Disk filesystem usage is not the Supabase plan quota.',
    });
  } catch {
    // Do not log auth headers, raw Prometheus text or keys.
    return respond({ error: 'PROVIDER_UNAVAILABLE' }, 503);
  }
});
