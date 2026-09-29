import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-buklod-finance-secret',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function cleanText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const expectedSecret = Deno.env.get('BUKLOD_FINANCE_VALUE_WEBHOOK_SECRET') ?? '';

  if (!url || !serviceRole) {
    return json({ error: 'Canonical finance service is not configured.' }, 503);
  }

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (String(body.action ?? '').toLowerCase() === 'health') {
    return json({
      ok: true,
      service: 'buklod-finalized-value-v2',
      provider_secret_configured: Boolean(expectedSecret),
    });
  }

  const suppliedSecret = req.headers.get('x-buklod-finance-secret') ?? '';
  if (!expectedSecret || !safeEqual(expectedSecret, suppliedSecret)) {
    return json({ error: 'Verified finance provider callback required.' }, 401);
  }

  const userId = cleanText(body.user_id, 64);
  const provider = cleanText(body.provider, 40).toUpperCase();
  const featureKey = cleanText(body.feature_key, 80).toLowerCase();
  const placementId = cleanText(body.placement_id, 120);
  const externalReference = cleanText(body.external_reference, 180);
  const idempotencyKey = cleanText(body.idempotency_key, 180);
  const finalizedAt = cleanText(body.finalized_at, 64);
  const grossValuePhp = Number(body.gross_value_php);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: 'Valid user_id required.' }, 400);
  }
  if (!provider || !featureKey) {
    return json({ error: 'provider and feature_key are required.' }, 400);
  }
  if (!Number.isFinite(grossValuePhp) || grossValuePhp <= 0) {
    return json({ error: 'Positive gross_value_php required.' }, 400);
  }
  if (!idempotencyKey) {
    return json({ error: 'idempotency_key required.' }, 400);
  }

  const db = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.rpc('record_buklod_finalized_value_v2', {
    p_user_id: userId,
    p_provider: provider,
    p_feature_key: featureKey,
    p_placement_id: placementId || null,
    p_gross_value_php: grossValuePhp,
    p_external_reference: externalReference || null,
    p_idempotency_key: idempotencyKey,
    p_finalized_at: finalizedAt || null,
    p_metadata:
      body.metadata && typeof body.metadata === 'object'
        ? body.metadata
        : {},
  });

  if (error) {
    return json({ error: error.message }, 409);
  }

  return json({
    ok: true,
    canonical_finance: true,
    result: data,
  });
});
