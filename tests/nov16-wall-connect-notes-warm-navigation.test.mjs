import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Wall retains authorized notes and polls only on active screen', () => {
  const wall = source('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(wall, /peekCachedMessagesStatusNote\(viewerId\)/);
  assert.match(wall, /readCachedConnectSuggestedContacts\(viewerId, MAX_BUBBLES\)/);
  assert.match(wall, /ownerId === viewerId/);
  assert.match(wall, /setContacts\(previous => clean\.length \? clean : previous\)/);
  assert.match(wall, /useFocusEffect\(useCallback\(\(\) => \{/);
  assert.match(wall, /clearInterval\(interval\)/);
});
test('Connect focus polling preserves realtime unread subscriptions and avoids full inbox reload on note save', () => {
  const inbox = source('src/app/(tabs)/messages.tsx');
  assert.match(inbox, /const pollTimer = setInterval/);
  assert.match(inbox, /useFocusEffect\(useCallback/);
  assert.match(inbox, /acquireSharedRealtimeSubscription/);
  assert.match(inbox, /invalidateBuklodConnectUnreadCaches/);
  assert.doesNotMatch(inbox, /onStatusNoteSaved=\{\(\) => void loadRef\.current\(\)\}/);
});
test('Wall and Connect still render readable five-line notes and retain Wall media/ad surfaces', () => {
  const wall = source('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const contacts = source('src/components/connect/ConnectQuickContacts.tsx');
  const feed = source('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /const NOTE_MAX_LINES = 5/);
  assert.match(contacts, /const NOTE_MAX_LINES = 5/);
  assert.match(feed, /BuklodNativeSponsoredCard|BuklodFirstViewAd/);
});
