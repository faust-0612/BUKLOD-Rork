import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const bubble = read('src/components/connect/ConnectMessageBubble.tsx');
const thread = read('src/components/BuklodConnectThread.tsx');
const windowSource = read('src/lib/connectChatWindow.ts');

test('all Connect text rooms share compact renderer and sender avatar without repeated name', () => {
  assert.match(thread, /<ConnectMessageBubble/);
  assert.match(thread, /showSenderAvatar=\{!own && grouping\.startsGroup\}/);
  assert.match(thread, /senderLabel=\{null\}/);
  assert.match(bubble, /!own && styles\.bubbleWithAvatar/);
  assert.match(bubble, /size=\{24\}/);
  assert.match(bubble, /marginBottom: 3/);
  assert.match(bubble, /maxWidth: '90%',/);
  assert.match(bubble, /flexDirection: 'row',\s+alignItems: 'center'/);
  assert.match(bubble, /useState,/);
});

test('tap-to-reveal message timestamp keeps delivery status legible', () => {
  assert.match(bubble, /onPress=\{\(\) => setDetailsExpanded\(current => !current\)\}/);
  assert.match(bubble, /detailsExpanded \|\| !!deliveryLabel/);
  assert.match(bubble, /\{detailsExpanded && \(/);
  assert.match(thread, /showTime=\{false\}/);
  assert.match(bubble, /onLongPress=\{handleLongPress\}/);
});

test('seen readers are shown only at group boundaries; every scope has an on-demand list', () => {
  assert.match(thread, /seenReaders=\{own && grouping\.endsGroup \? seenReaders : \[\]\}/);
  assert.match(thread, /showSeenReport=\{mode === 'scope' && own && grouping\.endsGroup/);
  assert.match(thread, /onPressSeenReaders=\{\(\) => \{/);
  assert.match(thread, /readersForMessageWindow\(\{/);
  assert.match(thread, /roomCursorCoversMessage\(/);
  assert.match(bubble, /Seen unavailable/);
  assert.match(bubble, /seenReportAvailable/);
});

test('read cursors, direct peer receipt and older pagination are not bypassed', () => {
  assert.match(thread, /directPeerReadAt/);
  assert.match(thread, /markVisibleRoomRead\('returned-to-latest'\)/);
  assert.match(thread, /pendingOlderAnchorRef\.current/);
  assert.match(windowSource, /shouldAdvanceConnectReadCursor/);
});
