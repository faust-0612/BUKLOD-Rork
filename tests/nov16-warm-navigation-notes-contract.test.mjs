import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Notes cache is per-account, bounded, coalesced, and not overwritten by stale reads', () => {
  const notes = source('src/lib/buklodMessagesStatusNote.ts');
  assert.match(notes, /NOTE_WARM_MS = 30_000/);
  assert.match(notes, /const userId = session\?\.user\?\.id/);
  assert.match(notes, /noteInFlight\.get\(userId\)/);
  assert.match(notes, /noteInFlight\.set\(userId, request\)/);
  assert.match(notes, /noteVersions\.get\(userId\)/);
  assert.match(notes, /invalidatePendingNoteReads\(userId\)/);
  assert.match(notes, /LOCAL_NOTE_KEY = 'buklod:messages:status-note:v2'/);
  assert.match(notes, /getItem\(`\$\{LOCAL_NOTE_KEY\}:\$\{userId\}`\)/);
  assert.doesNotMatch(notes, /getItem\(LOCAL_NOTE_KEY\)/);
});

test('Connect Notes and Wall use warm content and focus-only polling', () => {
  const notes = source('src/components/connect/ConnectQuickContacts.tsx');
  const wall = source('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const inbox = source('src/app/(tabs)/messages.tsx');
  assert.match(notes, /peekCachedMessagesStatusNote\(userId\)/);
  assert.match(notes, /subscribeMessagesStatusNote/);
  assert.match(notes, /useFocusEffect\(useCallback/);
  assert.match(notes, /\[currentUser\?\.user_id\]/);
  assert.match(wall, /peekCachedMessagesStatusNote\(viewerId\)/);
  assert.match(wall, /useFocusEffect\(useCallback\(\(\) => \{/);
  assert.match(inbox, /useFocusEffect\(useCallback\(\(\) => \{\s*if \(!profileId \|\| !connectOnline\) return;\s*const pollTimer/);
  assert.match(inbox, /acquireSharedRealtimeSubscription/);
  assert.match(inbox, /invalidateBuklodConnectUnreadCaches/);
});

test('Profile content stays painted while refreshing; account boundaries remain explicit', () => {
  const profile = source('src/app/(tabs)/me.tsx');
  const posts = source('src/components/BuklodProfilePostCards.tsx');
  const activity = source('src/components/BuklodProfileActivityCards.tsx');
  const save = source('src/app/profile/status.tsx');
  assert.doesNotMatch(profile, /let active=true;setProfileNote\(''\)/);
  assert.match(profile, /profileNoteOwnerRef\.current === profile\?\.id/);
  assert.match(profile, /rankFetchedRef\.current/);
  assert.match(posts, /visiblePosts=ownerRef\.current===userId/);
  assert.match(activity, /visibleActivities=ownerRef\.current===viewerId/);
  assert.match(save, /invalidateMessagesStatusNoteCache\(userId\)/);
});
