import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const screen = read('src/app/admin/backend-capacity.tsx');
const admin = read('src/app/admin/index.tsx');
const migration = read('supabase/migrations/20261112013654_buklod_backend_capacity_monitor_v1_20261112.sql');
const alerts = read('supabase/migrations/20261112021134_buklod_backend_capacity_early_warning_v2_20261112.sql');
const edge = read('supabase/functions/buklod-admin-backend-metrics/index.ts');

test('only System Admin navigation exposes the capacity monitor', () => {
  assert.match(admin, /title="Backend Health & Capacity"/);
  assert.match(admin, /path="\/admin\/backend-capacity"/);
  assert.match(screen, /<AdminGate>/);
  assert.match(screen, /\.rpc\('buklod_admin_backend_capacity_v1'\)/);
});
test('capacity screen never guesses provider CPU, RAM or authorizes upgrade', () => {
  assert.match(screen, /CPU load \/ logical vCPU/);
  assert.match(screen, /Database host RAM usage/);
  assert.match(screen, /Database host filesystem usage/);
  assert.match(screen, /No guessed percentages/);
  assert.doesNotMatch(screen, /\.rpc\('.*upgrade/);
  assert.doesNotMatch(screen, /showBuklodAdOpportunity|VideoPlayer|expo-video/);
});
test('SQL requires server-side admin identity and denies raw sample reads', () => {
  assert.match(migration, /if \(select auth\.uid\(\)\) is null or not public\.is_system_admin\(\)/);
  assert.match(migration, /revoke all on table private\.buklod_backend_capacity_samples_v1 from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.buklod_admin_backend_capacity_v1\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.buklod_admin_backend_capacity_v1\(\) to authenticated/);
});
test('hourly collection is idempotent and bounded, never a backend upgrade action', () => {
  assert.match(migration, /on conflict \(sampled_at\) do nothing/);
  assert.match(migration, /interval '60 days'/);
  assert.match(migration, /'17 \* \* \* \*'/);
  assert.match(migration, /'upgrade_recommended', false/);
  assert.doesNotMatch(migration, /alter system|resize|upgrade compute|service_role/);
});

test('capacity alerts require sustained sampling, official admin and push dedup', () => {
  assert.match(alerts, /v_last6 = 6 and v_high6 = 6/);
  assert.match(alerts, /v_last6 = 6 and v_watch6 = 6/);
  assert.match(alerts, /v_last3 = 3 and v_low3 = 3/);
  assert.match(alerts, /OFFICIAL_SYSTEM_ADMIN/);
  assert.match(alerts, /buklod_queue_notification_once_v1/);
  assert.match(alerts, /buklod-backend-capacity-hourly-v1/);
  assert.doesNotMatch(alerts, /pg_catalog\.pg_sleep|alter system/i);
});
test('provider data is server-authenticated and optional for app dashboard', () => {
  assert.match(screen, /buklod_admin_backend_capacity_alert_v2/);
  assert.match(screen, /supabase\.functions\.invoke\('buklod-admin-backend-metrics'/);
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.match(edge, /caller\.rpc\('is_system_admin'\)/);
  assert.match(edge, /PROVIDER_UNAVAILABLE/);
});
