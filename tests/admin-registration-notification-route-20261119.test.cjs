const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const nav=fs.readFileSync('src/lib/buklodNotificationNavigation.ts','utf8');
const admin=fs.readFileSync('src/app/admin/index.tsx','utf8');
const screen=fs.readFileSync('src/app/admin/new-users.tsx','utf8');

test('new-registration notification routes to the protected Admin inbox only',()=>{
  assert.match(nav,/normalizedKind === 'admin_new_user'/);
  assert.match(nav,/\^\[0-9a-f\]\{8\}/);
  assert.match(nav,/'\/admin\/new-users\?user_id='/);
  assert.match(admin,/path="\/admin\/new-users"/);
  assert.match(screen,/<AdminGate>/);
  assert.match(screen,/hasRole\('system_admin'\)/);
});

test('existing BSOC, Connect and Community notification routing remains in place',()=>{
  assert.match(nav,/normalizedKind === 'bsoc_support'/);
  assert.match(nav,/direct_message/);
  assert.match(nav,/community_comment/);
  assert.doesNotMatch(screen,/supabase\.auth\.admin|service_role/);
});
