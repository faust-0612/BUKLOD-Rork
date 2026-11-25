import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const generator = readFileSync(new URL('../supabase/functions/kl-generate-reading-quiz/index.ts', import.meta.url), 'utf8');
test('upstream 503 after edited KL manuscripts tries another model without bypassing security', () => {
  const upstream = generator.slice(generator.indexOf('if (!response.ok) {'), generator.indexOf('const data = await response.json();'));
  for (const status of [404, 500, 502, 503, 504]) assert.ok(upstream.includes('response.status === ' + status));
  assert.match(upstream, /lastTransportFailure = response\.status === 404/);
  assert.match(upstream, /tryNextModel = true;\s*break;/);
  assert.match(upstream, /return reply\(429, \{ ok: false, reason: "generator_quota_limited" \}\)/);
  assert.match(generator, /await client\.auth\.getUser\(\)/);
  assert.match(generator, /kl_quiz_admin_context_v1/);
  assert.match(generator, /validatedItems\(parsed, context\.manuscript, excerpts\)/);
  assert.match(generator, /p_manuscript_hash: context\.manuscript_hash/);
  assert.match(generator, /if \(!tryNextModel\) return reply\(422/);
});
