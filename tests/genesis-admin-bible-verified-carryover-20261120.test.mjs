import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const r=p=>readFileSync(p,'utf8');
test('Genesis admin New Members routes remain admin-gated with server authorized RPC',()=>{
 const a=r('src/app/admin/new-users.tsx');
 assert.match(a,/<AdminGate>/);
 assert.match(a,/hasRole\('system_admin'\)/);
 assert.match(a,/buklod_admin_recent_registrations_v1/);
 assert.match(a,/buklod_admin_registration_detail_v1/);
 assert.match(a,/\.eq\('user_id', user.id\)/);
 assert.match(r('src/app/admin/index.tsx'),/\/admin\/new-users/);
 assert.match(r('src/lib/buklodNotificationNavigation.ts'),/admin_new_user/);
});
test('Bible V4 keeps existing server-authoritative quiz and adds rubric preview without local points',()=>{
 const a=r('src/components/bible/BuklodBibleQuizV4.tsx');
 assert.match(a,/rubric_guidance/);
 assert.match(a,/rubric_feedback/);
 assert.match(a,/requirements_met/);
 assert.match(a,/Awtomatikong/);
 assert.doesNotMatch(a,/localStorage|wallet\.mint/);
});
