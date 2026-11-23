import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Connect newest-first improvements leave first-view and inline ads operational', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  assert.match(inbox, /<BuklodFirstViewAd/);
  assert.match(inbox, /placement="messages"/);
  assert.match(inbox, /connect_community_first_view/);
  assert.match(inbox, /connect_personal_first_view/);
  assert.match(inbox, /slotId="connect_community_inline_4"/);
  assert.match(inbox, /slotId="connect_personal_inline_4"/);
  assert.match(inbox, /prefetch/);
});

test('Connect chat and notifications preserve unrelated AdMob and tab-navigation boundaries', () => {
  const messages = read('src/app/(tabs)/messages.tsx');
  const thread = read('src/components/BuklodConnectThread.tsx');
  assert.match(messages, /reportBuklodDashboardScroll\('connect'/);
  assert.match(messages, /<FlatList/);
  assert.match(thread, /nearBottomRef/);
  assert.match(thread, /pinLatestOnOpenRef/);
  assert.match(thread, /connectOlderPrependScrollOffset/);
});
