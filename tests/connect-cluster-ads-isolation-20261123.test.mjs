import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const thread = read('src/components/BuklodConnectThread.tsx');
const composer = read('src/components/connect/ConnectComposer.tsx');
const inbox = read('src/app/(tabs)/messages.tsx');

test('newest-message and older-page scroll cannot dispatch advertising or earnings mutations', () => {
  const start = thread.indexOf('        onContentSizeChange={(');
  const end = thread.indexOf('        scrollEventThrottle={16}', start);
  assert.ok(start > 0 && end > start, 'Connect FlatList content/scroll contracts');
  const callbacks = thread.slice(start, end);
  assert.match(callbacks, /pinLatestOnOpenRef\.current/);
  assert.match(callbacks, /userScrolledUpRef\.current/);
  assert.doesNotMatch(callbacks, /(?:AdMob|AdsProvider|QMP|awardPoints|FinanceAllocation|earnings|createReward)/i);
  assert.doesNotMatch(thread, /import [^;]*(?:admob|AdsProvider|Qmp|FinanceAllocation)/i);
});

test('Connect read cursor and SDK ad mounting stay outside history paging', () => {
  assert.match(thread, /markVisibleRoomRead\('returned-to-latest'\)/);
  assert.match(thread, /notifyConnectRead\(profileId\)/);
  assert.match(inbox, /the appearance modal and SDK ads/);
  assert.doesNotMatch(composer, /(?:AdsProvider|AdMob|FinanceAllocation|QMP|awardPoints|supabase)/i);
  assert.match(composer, /onPress=\{onAttachPress\}/);
});
