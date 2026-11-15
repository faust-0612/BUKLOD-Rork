import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('src/app/notifications/index.tsx');
const actions=read('src/components/ClusterNotificationActions.tsx');
test('notification privacy and deep links survive layout change',()=>{
 for(const token of [
  ".eq('user_id',user.id)",
  ".neq('kind','ptt_incoming')",
  "FAITH_NOTIFICATION_PATTERNS",
  "resolveBuklodNotificationTarget(kind,data",
  "syncScopeSelection(selectScope",
  "buklodInstantPush(p as any)",
  "refreshUnread()",
  "setItems(displayed)",
  "await markAllRead()",
  "runClusterJoinNotificationAction({kind:",
  "ClusterNotificationActions kind=",
 ])assert.ok(src.includes(token),'Missing behavior '+token);
});
test('bulk read action is guarded against duplicate presses and leaves errors actionable',()=>{
 assert.match(src,/if\(markingAll\)return/);
 assert.match(src,/disabled=\{markingAll\}/);
 assert.match(src,/setMarkingAll\(true\)/);
 assert.match(src,/setMarkingAll\(false\)/);
 assert.match(src,/Alert\.alert\('Notifications'/);
 assert.match(actions,/disabled=\{busy\}/);
});
