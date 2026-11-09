import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/buklod-referral-v2/index.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const cors = source.match(/'Access-Control-Allow-Headers':\s*'([^']+)'/);
const allowed = new Set((cors?.[1] ?? '').split(',').map(x => x.trim().toLowerCase()));

test('identity edge function allows all BUKLOD global/SDK preflight headers', () => {
  assert.match(client, /'x-buklod-client'/);
  for (const name of ['authorization', 'apikey', 'x-client-info', 'content-type', 'x-buklod-client', 'x-retry-count', 'traceparent', 'tracestate', 'baggage']) {
    assert.ok(allowed.has(name), `CORS must allow ${name}`);
  }
  assert.match(source, /'Access-Control-Allow-Origin':\s*'\*'/);
  assert.match(source, /'Access-Control-Allow-Methods':\s*'POST, OPTIONS'/);
  assert.match(source, /if\(req\.method==='OPTIONS'\)return new Response\('ok',\{headers:cors\}\)/);
});

test('CORS repair preserves authenticated identity and referral attribution', () => {
  assert.match(source, /admin\.auth\.getUser\(token\)/);
  assert.match(source, /if\(authError\|\|!authData\?\.user\)return json\(\{error:'Invalid or expired session\.'\},401\)/);
  assert.match(source, /buklod_pf_link_identity_service_v2/);
  assert.match(source, /buklod_pf_attach_referral_service_v2/);
  assert.match(source, /if\(req\.method!=='POST'\)return json\(\{error:'POST required'\},405\)/);
});
