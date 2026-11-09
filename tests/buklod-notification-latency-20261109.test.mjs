import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261109150000_buklod_notification_latency_v1.sql','utf8');
const notifications = readFileSync('src/app/notifications/index.tsx','utf8');

test('New welcome key is unique per member and scope, not membership row', () => {
  assert.match(migration,/membership:scope-user:/);
  assert.match(migration,/new\.scope_id::text\|\|':'\|\|new\.user_id::text/);
  assert.match(migration,/on conflict\(event_key\) do nothing/);
});
test('Bounded dispatcher reuses existing privacy and idempotent delivery path', () => {
  assert.match(migration,/private\.buklod_living_dispatch_greetings_v1\(/);
  assert.match(migration,/pg_catalog\.least\(pg_catalog\.greatest\(coalesce\(p_iterations,1\),1\),6\)/);
  assert.match(migration,/buklod-living-greetings-dispatch-v1/);
  assert.doesNotMatch(migration,/create table|drop table|delete from public\.notifications/i);
});
test('Notification list updates on focus and when push changes the unread count', () => {
  assert.match(notifications,/useFocusEffect\(useCallback\(/);
  assert.match(notifications,/lastUnreadCount\.current===unreadCount/);
  assert.match(notifications,/if\(notificationsFocused\.current\)void load\(\)/);
});
test('No change to birthday sharing, PTT or notification provider logic', () => {
  assert.doesNotMatch(migration,/share_birthday\s*=|ptt_/);
  assert.doesNotMatch(notifications,/ptt_|setNotificationHandler/);
});
