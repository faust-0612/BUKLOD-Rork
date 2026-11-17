const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261117142009_formation_all_active_scope_reporting_v1_20261117.sql'), 'utf8');
const acl = fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261117142308_formation_scope_resolver_privilege_lock_v1_20261117.sql'), 'utf8');
const dedup = fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261117142548_formation_multi_scope_reporting_dedup_v2_20261117.sql'), 'utf8');

test('database scope helper requires ACTIVE membership and excludes deleted scopes', () => {
  assert.match(migration, /m\.membership_status='ACTIVE'/);
  assert.match(migration, /member_scope\.status not in \('SUSPENDED','DELETED'\)/);
  assert.match(migration, /target\.status not in \('SUSPENDED','DELETED'\)/);
  assert.match(migration, /m\.scope_id=target\.id/);
});

test('direct Data API access to internal scope resolvers is locked', () => {
  assert.match(migration, /revoke all on function public\.buklod_formation_reports_member_v1\(uuid,uuid\) from public,anon,authenticated/i);
  assert.match(acl, /revoke all on function public\.buklod_resolve_auto_submission_scope_v1\(text,uuid\)\s+from public,anon,authenticated/i);
  assert.match(acl, /grant execute on function public\.buklod_resolve_auto_submission_scope_v1\(text,uuid\)\s+to service_role/i);
  assert.doesNotMatch(acl, /to authenticated|to anon/i);
});

test('report-only activity projection does not mutate points or audit history', () => {
  assert.match(dedup, /distinct on \(ra\.learner_id,ra\.item_kind,ra\.item_id\)/);
  assert.match(dedup, /when 'APPROVED' then 0/);
  for (const source of [migration, acl, dedup]) {
    assert.doesNotMatch(source, /insert\s+into\s+public\.buklod_points_ledger\b/i);
    assert.doesNotMatch(source, /delete\s+from\s+public\.buklod_scope_formation_approvals_v2\b/i);
  }
});
