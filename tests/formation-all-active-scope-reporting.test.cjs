const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261117140200_formation_all_active_scope_reporting_v1.sql'),
  'utf8',
);
const acl = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/20261117142500_formation_scope_resolver_privilege_lock_v1.sql'),
  'utf8',
);

test('one canonical activity is projected into every ACTIVE member scope', () => {
  assert.match(migration, /create or replace function public\.buklod_formation_reports_member_v1/i);
  assert.match(migration, /m\.membership_status='ACTIVE'/);
  assert.match(migration, /target\.scope_type in \('CLUSTER','ORGANIZATION'\)/);
  assert.match(migration, /member_scope\.scope_type='CLUSTER'/);
  assert.match(migration, /coalesce\(member_scope\.organization_id,member_scope\.parent_scope_id\)=target\.id/);
});

test('latest approved reading Cluster anchors processing without blocking multi-membership', () => {
  assert.match(migration, /d\.status='approved'/);
  assert.match(migration, /m\.joined_at asc nulls last,s\.id/);
  assert.match(migration, /v_feature in \('DAILY_READING','DAILY_DEVOTION','LESSON'\)/);
});

test('existing reporting RPCs use membership projection instead of originating scope', () => {
  for (const name of [
    'buklod_scope_formation_submission_history_v1',
    'buklod_scope_faith_monitoring_summary_v2',
    'buklod_scope_faith_monitoring_summary_v3',
    'buklod_scope_faith_monitoring_members_v1',
    'buklod_scope_faith_monitoring_period_v1',
    'buklod_scope_faith_monitoring_metric_details_v1',
  ]) assert.ok(migration.includes('CREATE OR REPLACE FUNCTION public.' + name), name);
  assert.match(migration, /buklod_formation_reports_member_v1\(p_scope_id,s\.user_id\)/);
  assert.match(migration, /buklod_formation_reports_member_v1\(p_scope_id,a\.learner_id\)/);
});

test('do not credit points or expose the scope resolver and private projection', () => {
  assert.doesNotMatch(migration, /insert\s+into\s+public\.buklod_points_ledger\b/i);
  assert.match(migration, /revoke all on function public\.buklod_formation_reports_member_v1\(uuid,uuid\) from public,anon,authenticated/i);
  assert.match(acl, /revoke all on function public\.buklod_resolve_auto_submission_scope_v1\(text,uuid\)/i);
});
