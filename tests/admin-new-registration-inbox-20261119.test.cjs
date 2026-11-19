const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const sql = read('supabase/migrations/20261119214500_buklod_admin_new_registration_inbox_v1.sql');
const screen = read('src/app/admin/new-users.tsx');
const nav = read('src/lib/buklodNotificationNavigation.ts');
const admin = read('src/app/admin/index.tsx');

test('only an authenticated System Admin may fetch private registration details', () => {
  assert.match(sql, /auth\.uid\(\) is null or not public\.buklod_is_system_admin\(\)/);
  assert.match(sql, /revoke all on function public\.buklod_admin_recent_registrations_v1\([\s\S]*?from PUBLIC,anon/);
  assert.match(sql, /revoke all on function public\.buklod_admin_registration_detail_v1\(uuid\) from PUBLIC,anon/);
  assert.match(sql, /grant execute on function public\.buklod_admin_registration_detail_v1\(uuid\) to authenticated/);
  assert.match(screen, /<AdminGate>/);
  assert.match(screen, /hasRole\('system_admin'\)/);
});

test('new member notifications carry no PII; privileged detail comes from live profile', () => {
  const notifier = sql.split('create or replace function private.buklod_notify_admin_new_registration_v1')[1];
  assert.ok(notifier);
  assert.match(notifier, /after insert on public\.profiles/);
  assert.match(notifier, /'admin_new_user'/);
  assert.match(notifier, /jsonb_build_object\('route','\/admin\/new-users','user_id',new\.id::text/);
  assert.doesNotMatch(notifier, /new\.(full_name|mobile|birth_date|login_identifier)/);
  assert.match(screen, /buklod_admin_registration_detail_v1/);
  assert.match(screen, /'Hindi pa ibinigay'/);
  assert.match(screen, /'admin_new_user'/);
});

test('the admin registration inbox shows complete available fields and keeps notices account-scoped', () => {
  for (const key of ['full_name', 'first_name', 'middle_name', 'surname', 'suffix',
    'username', 'sex', 'birth_date', 'mobile', 'email', 'login_method',
    'address', 'barangay', 'province', 'country', 'membership_request',
    'scopes', 'roles', 'member_verified', 'is_active']) {
    assert.ok(sql.includes("'" + key + "'"), 'missing secure detail field: ' + key);
  }
  assert.match(screen, /\.eq\('user_id', user\.id\)\.eq\('kind', 'admin_new_user'\)/);
  assert.match(screen, /\.contains\('data', \{ user_id: id \}\)/);
  assert.match(screen, /'admin_new_user'\)\.is\('read_at', null\)/);
  assert.match(screen, /p_before_created_at: last\?\.created_at/);
});

test('strict new-member deep links and visible admin dashboard entry', () => {
  assert.match(admin, /title="Bagong Members · Registration Inbox"/);
  assert.match(admin, /path="\/admin\/new-users"/);
  assert.match(nav, /normalizedKind === 'admin_new_user'/);
  assert.match(nav, /\^\[0-9a-f\]\{8\}/);
  assert.match(nav, /'\/admin\/new-users\?user_id='/);
  assert.doesNotMatch(screen, /service_role|supabase\.auth\.admin/);
});

test('registration notification outage cannot roll back a new member signup', () => {
  assert.match(sql, /exception when others then[\s\S]*?raise log 'BUKLOD admin registration notification delivery error/);
  assert.doesNotMatch(sql, /create or replace function public\.buklod_complete_registration_v1/);
  assert.doesNotMatch(sql, /buklod_points_ledger|season_2|withdrawals/);
});
