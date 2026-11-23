import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const inbox = read('src/app/(tabs)/messages.tsx');
const helper = read('src/lib/connectInboxActivity.ts');
const signals = read('src/lib/connectInboxSignal.ts');
const thread = read('src/components/BuklodConnectThread.tsx');

test('every conversation section is chronological and tie-stable, not unread-prioritized', () => {
  assert.match(inbox, /sortConnectInboxByActivity\(personal\)/);
  assert.match(inbox, /sortConnectInboxByActivity\(rooms\.filter/);
  assert.match(inbox, /partitionConnectInboxThreads\(sortedPersonal, requestThreadIds\)/);
  assert.match(helper, /activityTime\(b\.value\.last_message_at\)/);
  assert.match(helper, /a\.index - b\.index/);
  assert.doesNotMatch(inbox, /sort\(\s*\(a, b\) =>\s*b\.unread_count/);
});

test('realtime inserts refresh only account authorized thread/room snapshots', () => {
  assert.match(inbox, /thread_id=in\.\(\$\{idChunk\.join\(','\)\}\)/);
  assert.match(inbox, /scope_id=in\.\(\$\{idChunk\.join\(','\)\}\)/);
  assert.match(inbox, /applyConnectInboxRealtimeActivity\(/);
  assert.match(inbox, /invalidateBuklodConnectUnreadCaches\(kind\)/);
  assert.doesNotMatch(inbox, /\.channel\([^\n]*all_connect_messages/);
  assert.match(helper, /nextTime < activityTime\(row\.last_message_at\)/);
  assert.match(helper, /changed \? next : rows/);
});

test('focus/read revision invalidates cached inbox after foreground first-message pushes', () => {
  assert.match(inbox, /subscribeConnectInboxChanged\(/);
  assert.match(inbox, /connectInboxRevision\(profileId\)/);
  assert.match(inbox, /inboxFocusedRef\.current/);
  assert.match(inbox, /refreshDebounceRef/);
  assert.match(signals, /const revisions = new Map<string, number>\(\)/);
  assert.match(signals, /if \(!id\) return/);
  assert.match(signals, /'direct_message'/);
});

test('only successful outgoing text and attachments signal inbox; never pending or failed', () => {
  assert.match(thread, /const markLocalMessageSent =[\s\S]*?notifyConnectInboxChanged\(profileId\)/);
  assert.match(thread, /if \(result\.error\) \{\s*throw result\.error;\s*\}[\s\S]{0,200}markLocalMessageSent/);
  assert.match(thread, /markLocalMessageFailed/);
  assert.ok((thread.match(/if \(profileId\) notifyConnectInboxChanged\(profileId\);/g) || []).length >= 3);
  assert.match(thread, /userDraggingRef\.current \|\| userMomentumRef\.current/);
  assert.match(thread, /pinLatestOnOpenRef\.current/);
});

test('first-view ads and sponsored cards remain anchored to their existing placements', () => {
  assert.match(inbox, /placementId=\{community \? 'connect_community_first_view' : 'connect_personal_first_view'\}/);
  assert.match(inbox, /slotId="connect_community_inline_4"/);
  assert.match(inbox, /slotId="connect_personal_inline_4"/);
  assert.match(inbox, /<BuklodFirstViewAd/);
  assert.match(inbox, /<BuklodNativeSponsoredCard/);
});
