import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bubble = fs.readFileSync('src/components/connect/ConnectMessageBubble.tsx', 'utf8');
const thread = fs.readFileSync('src/components/BuklodConnectThread.tsx', 'utf8');
const reader = fs.readFileSync('src/lib/connectChatWindow.ts', 'utf8');

test('Seen avatars have physical slots rather than overlapping rank and note overlays', () => {
  assert.match(bubble, /seenAvatar:\s*\{\s*width: 36,\s*height: 30,/);
  assert.match(bubble, /seenRow:\s*\{[\s\S]*?gap: 4,/);
  assert.match(bubble, /size=\{22\}\s*onPress=\{onPressSeenReaders\}/);
  assert.match(bubble, /<Text style=\{styles\.seenExtraText\}>\+\{seen\.extra\}<\/Text>/);
  assert.match(reader, /CONNECT_SEEN_AVATAR_LIMIT = 3/);
  assert.match(reader, /extra: Math\.max\(0, readers\.length - max\)/);
});

test('Seen timestamp uses an authorized read cursor, never a fabricated send receipt', () => {
  assert.match(bubble, /latestConnectReaderReadAt\(seenReaders \?\? \[\]\)/);
  assert.match(bubble, /<Text style=\{styles\.seenTime\}/);
  assert.match(reader, /Date\.parse\(reader\.lastReadAt\)/);
  assert.match(reader, /Number\.isFinite\(timestamp\)/);
  assert.match(thread, /hasConfirmedDelivery/);
  assert.match(thread, /roomCursorCoversMessage\(item\.created_at, reader\.lastReadAt\)/);
  assert.match(thread, /formatConnectTimestamp\(reader\.lastReadAt\)/);
});
