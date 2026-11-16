import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Connect and Wall avatar rails do not reserve tall note placeholders', () => {
  const connect = source('src/components/connect/ConnectQuickContacts.tsx');
  const wall = source('src/components/BuklodCommunityWallProfileBubbles.tsx');
  for (const rail of [connect, wall]) {
    assert.match(rail, /const COLUMN_WIDTH = 104;/);
    assert.match(rail, /alignItems: 'flex-end'/);
    assert.doesNotMatch(rail, /height: NOTE_ZONE_HEIGHT|height: 108/);
    assert.match(rail, /const NOTE_MAX_LINES = 5/);
  }
  assert.match(connect, /marginRight: 6/);
  assert.match(wall, /gap: 6/);
});

test('Wall post author renders the canonical name on one responsive line', () => {
  const person = source('src/components/BuklodTappablePersonName.tsx');
  const wall = source('src/app/(tabs)/buklod.tsx');
  assert.match(person, /adjustsFontSizeToFit\?: boolean/);
  assert.match(person, /adjustsFontSizeToFit=\{adjustsFontSizeToFit\}/);
  assert.match(wall, /hydratePersonNamesOnRows\([\s\S]*?'author_name'/);
  assert.match(wall, /name=\{resolvePersonDisplayName\(item\.author_name, item\.user_id\)\}/);
  assert.match(wall, /numberOfLines=\{1\}\s+adjustsFontSizeToFit\s+minimumFontScale=\{0\.78\}/);
});

test('Avatar rail controls and notes retain their current behavior', () => {
  const connect = source('src/components/connect/ConnectQuickContacts.tsx');
  const wall = source('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(connect, /markConnectStatusNoteSeen/);
  assert.match(connect, /onSaveSelfNote=\{persistSelfNote\}/);
  assert.match(wall, /useFocusEffect/);
  assert.match(wall, /openConversation\(contact\)/);
});
