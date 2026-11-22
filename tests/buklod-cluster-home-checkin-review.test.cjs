const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261122090000_cluster_scoped_home_checkin_review_v1.sql');
const cluster = read('src/app/clusters/home-checkin-review.tsx');
const manage = read('src/app/clusters/scope-manage.tsx');
const admin = read('src/app/admin/points-r2-monitor.tsx');
const priority = read('src/lib/buklodAdminPriority.ts');
const layout = read('src/app/_layout.tsx');

test('authorization is exact-Cluster, active role plus active membership, without System Admin override', () => {
  const guard = migration.split('create or replace function public.buklod_cluster_can_review_home_checkin_v1')[1]
    .split('create or replace function public.cluster_get_buklod_home_checkin_queue_v1')[0];
  assert.match(guard, /auth\.uid\(\)/);
  assert.match(guard, /s\.id=p_scope_id/);
  assert.match(guard, /s\.scope_type='CLUSTER'/);
  assert.match(guard, /s\.status='ACTIVE'/);
  assert.match(guard, /m\.membership_status='ACTIVE'/);
  assert.match(guard, /m\.left_at is null/);
  assert.match(guard, /ra\.status='ACTIVE'/);
  assert.match(guard, /ra\.revoked_at is null/);
  assert.match(guard, /'ADMIN','CLUSTER_ADMIN'/);
  assert.doesNotMatch(guard, /is_system_admin|actor_is_system_admin/);
});
test('queue is scoped server-side, with no global check-in enumeration', () => {
  const sql = migration.split('create or replace function public.cluster_get_buklod_home_checkin_queue_v1')[1]
    .split('create or replace function public.cluster_review_buklod_home_checkin_v1')[0];
  assert.match(sql, /buklod_cluster_can_review_home_checkin_v1\(p_scope_id\)/);
  assert.match(sql, /c\.scope_id=p_scope_id and c\.status='pending'/);
  assert.match(sql, /e\.scope_id=c\.scope_id/);
  assert.match(sql, /limit 100/i);
});
test('verification is transactional, duplicate-safe, and denies approving yourself', () => {
  const sql = migration.split('create or replace function public.cluster_review_buklod_home_checkin_v1')[1]
    .split('create or replace function public.admin_get_buklod_home_checkin_queue_r3')[0];
  assert.match(sql, /for update of c/);
  assert.match(sql, /row_rec\.status <> 'pending'/);
  assert.match(sql, /buklod_cluster_can_review_home_checkin_v1\(row_rec\.scope_id\)/);
  assert.match(sql, /row_rec\.user_id=actor/);
  assert.match(sql, /unique|on conflict \(user_id,source_key\) do nothing/i);
  assert.match(sql, /'scope_attendance:'\|\|row_rec\.event_id/);
  assert.match(sql, /reviewed_by=actor/);
  assert.match(sql, /row_rec\.user_id/);
});
test('legacy System Admin queue and BP approval do not remain active', () => {
  const old = migration.split('create or replace function public.admin_get_buklod_home_checkin_queue_r3')[1];
  assert.match(old, /return '\[\]'::jsonb/);
  assert.match(old, /Home check-in verification belongs to the exact Cluster Admin/);
  assert.doesNotMatch(admin, /admin_review_buklod_home_checkin_r3|admin_get_buklod_home_checkin_queue_r3/);
  assert.doesNotMatch(priority, /admin_get_buklod_home_checkin_queue_r3|Home attendance/);
});
test('Cluster can reach the scoped review screen with exact scope params', () => {
  assert.match(manage, /open\('\/clusters\/home-checkin-review'\)/);
  assert.match(cluster, /readClusterScopeId/);
  assert.match(cluster, /cluster_get_buklod_home_checkin_queue_v1/);
  assert.match(cluster, /cluster_review_buklod_home_checkin_v1/);
  assert.match(cluster, /buklod_cluster_can_review_home_checkin_v1/);
  assert.match(cluster, /reason\.length < 8/);
  assert.match(layout, /name="clusters\/home-checkin-review"/);
});
