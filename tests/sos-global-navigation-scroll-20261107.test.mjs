import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(file,'utf8');
const root = read('src/app/_layout.tsx');
const native = read('src/providers/NotificationProvider.tsx');
const host = read('src/components/BuklodGlobalEmergencyHost.tsx');

test('Global emergency overlay belongs inside the authenticated shared navigation shell',()=>{
  assert.match(root, /<AuthProvider>/);
  assert.match(root, /<NotificationProvider>/);
  assert.match(root, /<BuklodNavSafeShell>/);
  assert.match(root, /<BuklodMandatoryUpdateBoundary>/);
  assert.match(root, /<BuklodGlobalEmergencyHost \/>/);
  assert.match(root, /<Stack\.Screen name="\(tabs\)" \/>/);
  assert.match(root, /<Stack\.Screen name="clusters" \/>/);
  assert.match(root, /<Stack\.Screen name="connect\/index" \/>/);
  assert.match(root, /<Stack\.Screen name="notifications\/index" \/>/);
  assert.match(host, /statusBarTranslucent/);
  assert.match(host, /onRequestClose=\{minimize\}/);
  assert.match(host, /accessibilityRole="button"/);
});

test('Notification tap opens incident overlay without destructive public Wall navigation',()=>{
  const at=native.indexOf("if(kind==='community_emergency'&&data?.help_request_id)");
  const after=native.indexOf("const target=resolveBuklodNotificationTarget",at);
  assert.ok(at>0&&after>at);
  const route=native.slice(at,after);
  assert.match(route, /emitBuklodEmergencySignal/);
  assert.match(route, /return;/);
  assert.doesNotMatch(route, /router\.replace\(/);
  assert.match(host, /Your SOS is active/);
  assert.match(host, /A BUKLOD member needs help/);
  assert.match(host, /position:'absolute',right:16,bottom:92/);
});

test('Push handling remains shared and special response actions are untouched',()=>{
  assert.match(native, /BUKLOD_MESSAGE_REPLY_ACTION/);
  assert.match(native, /CLUSTER_JOIN_APPROVE_ACTION/);
  assert.match(native, /Notifications\.addNotificationResponseReceivedListener/);
  assert.match(native, /Notifications\.clearLastNotificationResponse\(\)/);
  assert.match(native, /registerPushToken\(user\.id\)/);
  assert.match(native, /shouldPlaySound:visible && \['community_emergency'/);
});
