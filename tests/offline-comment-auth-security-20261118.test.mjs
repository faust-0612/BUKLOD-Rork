import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('auth invalid credentials do not create deferred BSOC system tickets', () => {
  const auth = read('src/lib/buklodAuthResilience.ts');
  assert.match(auth, /!isBuklodInvalidCredentialsError\(result\.error\)/);
  assert.match(auth, /authErrorCode\(result\.error\) !== 'auth_in_progress'/);
  const health = read('src/components/BuklodMainHealthAgent.tsx');
  assert.match(health, /classifyNetworkQuality\(\) !== 'normal'/);
  assert.match(health, /AUTH_SESSION_STALE/);
});

test('RLS and account validation stay server authoritative for queued Wall comments', () => {
  const migration = read('supabase/migrations/20261118014500_community_wall_comment_idempotency_v5.sql');
  assert.match(migration, /actor uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /public\.can_view_community_post_v2/);
  assert.match(migration, /p_parent_id is not null/);
  assert.match(migration, /where c\.id = p_parent_id and c\.post_id = p_post_id/);
  assert.match(migration, /on public\.comments \(user_id, client_request_key\)/);
  assert.match(migration, /existing\.post_id <> p_post_id/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /from public, anon/);
  assert.match(migration, /to authenticated/);
  assert.doesNotMatch(migration, /drop (?:table|function|policy)/i);
});

test('minimal auth observations remain diagnostics until repeated, not false urgent system incidents', () => {
  const processor = read('supabase/migrations/20261118015500_bsoc_low_signal_escalation_threshold_v1.sql');
  for (const pattern of [
    /he\.severity in \('INFO','WARNING'\)/,
    /he\.health_category = 'AUTH'/,
    /he\.privacy_classification = 'MINIMAL'/,
    /he\.repeat_count < 3/,
    /he\.local_self_heal_attempted = false/,
  ]) assert.match(processor, pattern);
  assert.match(processor, /e\.privacy_classification='SECURITY_REVIEW_REQUIRED'/);
  assert.match(processor, /REMOTE_RECOVERY_RUNNING/);
  const triage = read('src/lib/bsocCaseTriage.ts');
  assert.match(triage, /category:'auth',urgency:'investigate'/);
  assert.match(triage, /category:'auth',urgency:'priority'/);
});
