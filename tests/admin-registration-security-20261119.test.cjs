const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const sql = readFileSync('supabase/migrations/20261119214500_buklod_admin_new_registration_inbox_v1.sql','utf8');

test('System Admin security proof: both new registration RPCs enforce authenticated access', () => {
  assert.equal((sql.match(/auth\.uid\(\) is null or not public\.buklod_is_system_admin\(\)/g) || []).length, 2);
  assert.match(sql, /revoke all on function public\.buklod_admin_recent_registrations_v1\([\s\S]*?from PUBLIC,anon/);
  assert.match(sql, /revoke all on function public\.buklod_admin_registration_detail_v1\(uuid\) from PUBLIC,anon/);
  assert.match(sql, /grant execute on function public\.buklod_admin_registration_detail_v1\(uuid\) to authenticated/);
});

test('The notification database trigger stores a fixed route and UUID, no personal data', () => {
  const notifier = sql.split('create or replace function private.buklod_notify_admin_new_registration_v1')[1];
  assert.ok(notifier);
  assert.match(notifier, /'admin_new_user'/);
  assert.match(notifier, /'\/admin\/new-users','user_id',new\.id::text/);
  assert.doesNotMatch(notifier, /new\.(mobile|full_name|birth_date|login_identifier|password)/);
  assert.match(sql, /revoke all on function private\.buklod_notify_admin_new_registration_v1\(\) from PUBLIC,anon,authenticated/);
});

test('A notification outage must not roll back the creation of a new profile', () => {
  assert.match(sql, /exception when others then[\s\S]*?raise log 'BUKLOD admin registration notification delivery error/);
});
