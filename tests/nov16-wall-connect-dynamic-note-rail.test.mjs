import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const block = (source, key) => source.match(new RegExp(key + ':\\s*\\{([\\s\\S]*?)\\n\\s*\\},'))?.[1] ?? '';

test('Wall and Connect Notes grow only with actual content, not fixed blank heights', () => {
  const wall = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const connect = read('src/components/connect/ConnectQuickContacts.tsx');
  for (const [name, src] of [['Wall', wall], ['Connect', connect]]) {
    const note = block(src, 'noteZone');
    assert.match(note, /minHeight:\s*44/, name + ' note tap zone');
    assert.doesNotMatch(note, /^\s*height\s*:/m, name + ' must not reserve empty five-line note height');
  }
  assert.match(block(wall, 'noteAddWrap'), /minHeight:\s*44/);
  assert.doesNotMatch(block(wall, 'noteAddWrap'), /^\s*height\s*:/m);
  assert.match(block(wall, 'row'), /alignItems:\s*'flex-end'/);
  assert.match(block(connect, 'scroll'), /alignItems:\s*'flex-end'/);
  assert.match(wall, /My note/);
});

test('Long Notes, editing, 56dp avatars, ranking and ads remain intact', () => {
  const wall = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const connect = read('src/components/connect/ConnectQuickContacts.tsx');
  const inbox = read('src/app/(tabs)/messages.tsx');
  const feed = read('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /const NOTE_MAX_LINES = 5/);
  assert.match(connect, /const NOTE_MAX_LINES = 5/);
  assert.match(wall, /const AVATAR_SIZE = 56/);
  assert.match(connect, /const AVATAR_SIZE = 56/);
  assert.match(block(wall, 'noteZoneEditing'), /height:\s*100/);
  assert.match(block(connect, 'noteZoneEditing'), /height:\s*NOTE_ZONE_HEIGHT/);
  assert.match(wall, /onSave=\{persistSelfNote\}/);
  assert.match(connect, /onSave=\{onSaveSelfNote\}/);
  assert.match(inbox, /BuklodFirstViewAd/);
  assert.match(feed, /BuklodFirstViewAd/);
});
