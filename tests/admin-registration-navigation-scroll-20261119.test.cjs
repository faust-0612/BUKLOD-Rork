const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const route=fs.readFileSync('src/lib/buklodNotificationNavigation.ts','utf8');
const screen=fs.readFileSync('src/app/admin/new-users.tsx','utf8');

test('registration notification navigation only uses the guarded fixed Admin destination',()=>{
  const block=route.split("if (normalizedKind === 'admin_new_user')")[1]?.split('// BSOC links')[0];
  assert.ok(block,'missing dedicated registration notification routing');
  assert.match(block,/\^\[0-9a-f\]\{8\}/);
  assert.match(block,/'\/admin\/new-users'/);
  assert.match(block,/encodeURIComponent\(id\)/);
  assert.match(screen,/<AdminGate>/);
});

test('notification routing and list scrolling remain independent of existing Wall, Connect and BSOC flows',()=>{
  assert.match(route,/normalizedKind === 'bsoc_support'/);
  assert.match(route,/direct_message/);
  assert.match(route,/postInItsCommunity/);
  assert.match(screen,/useFocusEffect/);
  assert.match(screen,/ScrollView/);
  assert.match(screen,/p_before_created_at/);
});
