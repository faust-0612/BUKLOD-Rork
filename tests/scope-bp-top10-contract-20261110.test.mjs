import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('exact-scope Top 10 BP card appears on Cluster and Organization Home only', () => {
  const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  const org = read('src/components/BuklodScopeHomeDashboard.tsx');
  assert.match(cluster, /<BuklodScopeBPTop10 key=\{scope.scope_id\} scopeId=\{scope.scope_id\} scopeType="CLUSTER"/);
  assert.match(org, /scope.scope_type === 'ORGANIZATION' \? <BuklodScopeBPTop10 key=\{scope.scope_id\} scopeId=\{scope.scope_id\} scopeType="ORGANIZATION"/);
});

test('only ACTIVE exact-scope members can see lifetime BP; max ten rows', () => {
  const sql = read('supabase/migrations/20261110091000_buklod_scope_bp_top10_members_only.sql');
  const ui = read('src/components/BuklodScopeBPTop10.tsx');
  assert.match(sql, /viewer.user_id = v_viewer/);
  assert.match(sql, /viewer.membership_status = 'ACTIVE'/);
  assert.match(sql, /viewer.left_at IS NULL/);
  assert.match(sql, /m.scope_id = p_scope_id/);
  assert.match(sql, /b.lifetime_points/);
  assert.match(sql, /LIMIT 10/);
  assert.match(sql, /FROM PUBLIC, anon/);
  assert.match(sql, /TO authenticated/);
  assert.match(ui, /get_buklod_scope_bp_top10_v1/);
  assert.match(ui, /\.slice\(0, 10\)/);
  assert.match(ui, /useFocusEffect/);
  assert.doesNotMatch(ui, /AsyncStorage|useBuklodOfflineCache/);
});
