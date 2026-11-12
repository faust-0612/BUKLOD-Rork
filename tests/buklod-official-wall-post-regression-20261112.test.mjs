import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20261112115000_official_wall_post_reward_settlement_guard_v1.sql',
  'utf8',
);
const functionNames = [
  'private.buklod_community_qmp_after_post_v1',
  'private.buklod_engagement_r4_post_trigger_v1',
  'private.buklod_r36_settle_creator_impact_v1',
  'private.buklod_r36_settle_publish_v1',
  'public.community_post_points_trigger_v2',
];
function body(name) {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION ' + name + '(');
  assert.notEqual(start, -1, 'missing function: ' + name);
  const end = migration.indexOf('$function$;', start);
  assert.ok(end > start, 'incomplete function definition: ' + name);
  return migration.slice(start, end + '$function$;'.length);
}

test('all five canonical reward paths skip Official identity without weakening reward-write guard', () => {
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION /g) ?? []).length, 5);
  for (const name of functionNames) {
    assert.match(body(name), /private\.buklod_is_platform_official_v1\(/i, name);
  }
  assert.doesNotMatch(migration, /DROP TRIGGER|DISABLE TRIGGER|GRANT ALL|ALTER POLICY|DROP POLICY|DROP FUNCTION/i);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION private\.buklod_official_reward_write_guard_v1/i);
});

test('Official post skips legacy publisher and after-post QMP economic writes', () => {
  const pub = body('public.community_post_points_trigger_v2').toLowerCase();
  assert.ok(pub.indexOf('private.buklod_is_platform_official_v1(new.user_id)') < pub.indexOf('private.buklod_r36_settle_publish_v1('));
  const qmp = body('private.buklod_community_qmp_after_post_v1').toLowerCase();
  assert.ok(qmp.indexOf('private.buklod_is_platform_official_v1(new.user_id)') < qmp.indexOf('private.buklod_community_qmp_ensure_period_v1('));
  const r4 = body('private.buklod_engagement_r4_post_trigger_v1').toLowerCase();
  assert.ok(r4.indexOf('private.buklod_is_platform_official_v1(new.user_id)') < r4.indexOf('private.buklod_r36_settle_creator_impact_v1('));
});

test('direct publisher and creator-impact functions return no-credit for Official before writing ledgers', () => {
  for (const name of ['private.buklod_r36_settle_publish_v1', 'private.buklod_r36_settle_creator_impact_v1']) {
    const fn = body(name).toLowerCase();
    assert.match(fn, /'status','official_excluded','written',false/);
    const guard = fn.indexOf('private.buklod_is_platform_official_v1(');
    const ledger = fn.indexOf('insert into public.buklod_points_ledger');
    assert.ok(guard > -1 && ledger > guard, name);
  }
});
