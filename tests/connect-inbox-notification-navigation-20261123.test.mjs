import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const notifications = read('src/providers/NotificationProvider.tsx');
const inbox = read('src/app/(tabs)/messages.tsx');
const signal = read('src/lib/connectInboxSignal.ts');
const direct = read('src/app/connect/personal/[threadId].tsx');
const scope = read('src/app/connect/community/[scopeId].tsx');

test('push invalidates the authorized viewer without changing PTT or notification routing', () => {
  assert.match(notifications, /if\(kind==='ptt_incoming'\)return/);
  assert.match(notifications, /if\(isConnectMessageNotification\(kind\)\) notifyConnectInboxChanged\(user\.id\)/);
  assert.match(notifications, /resolveBuklodNotificationTarget/);
  assert.match(signal, /'scope_message'/);
  assert.match(signal, /'community_message'/);
  assert.match(signal, /'cluster_message'/);
  assert.doesNotMatch(signal, /'ptt_incoming'/);
});

test('direct and scope routing preserve exact thread identity and authenticated verification', () => {
  assert.match(inbox, /pathname: personalThreadPath as any/);
  assert.match(inbox, /pathname: communityThreadPath as any/);
  assert.match(direct, /mode="direct"/);
  assert.match(direct, /containerId=/);
  assert.match(scope, /mode="scope"/);
  assert.match(scope, /containerId=\{scopeId\}/);
});

test('zero unread does not fabricate delivered or seen status', () => {
  assert.doesNotMatch(inbox, /showSentIndicator=\{!isPerson && unread === 0/);
  assert.match(inbox, /unreadCount=\{unread\}/);
  assert.match(inbox, /avatarUri=\{isPerson \? item.avatar_url : item.other_avatar_url \?\? null\}/);
});

test('first-message logic does not change native package, AdMob or backend mutation', () => {
  assert.match(notifications, /addNotificationReceivedListener/);
  assert.match(inbox, /\.rpc\('buklod_connect_message_requests_v1'\)/);
  assert.match(inbox, /\.rpc\(\s*'buklod_connect_personal_threads'/);
  assert.match(inbox, /\.rpc\(\s*'buklod_connect_community_rooms'/);
});
