const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('post detail builds text and comment colors from selected theme', () => {
  const src = read('src/app/post/[id].tsx');
  assert.match(src, /useBuklodTheme\(\)/);
  assert.match(src, /createPostDetailStyles\(theme\)/);
  assert.match(src, /color:theme\.textPrimary/);
  assert.match(src, /backgroundColor:theme\.surfaceElevated/);
  assert.match(src, /backgroundColor:theme\.inputSurface/);
});
test('Connect notes use readable sizes and keep every avatar aligned', () => {
  const connect = read('src/components/connect/ConnectQuickContacts.tsx');
  const wall = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(connect, /const NOTE_LINE_HEIGHT = 17/);
  assert.match(connect, /const NOTE_MAX_LINES = 5/);
  assert.match(connect, /const COLUMN_WIDTH = 116/);
  assert.match(wall, /const NOTE_MAX_LINES = 5/);
  assert.match(wall, /return <View style=\{styles\.noteZone\} \/>;/);
  assert.match(wall, /textColor="#173626"/);
});
test('Wall post headers expose Connect note text without touching feed or ad lifecycle', () => {
  const avatar = read('src/components/ProfileAvatar.tsx');
  const wall = read('src/app/(tabs)/buklod.tsx');
  const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const detail = read('src/app/post/[id].tsx');
  assert.match(avatar, /export function ProfileAvatarNoteChip/);
  assert.match(avatar, /quick_note_expires_at/);
  for (const src of [wall, scoped, detail]) assert.match(src, /<ProfileAvatarNoteChip userId=/);
});
test('Locked profile retains private content while showing standard authenticated avatar', () => {
  const member = read('src/app/member/[id].tsx');
  assert.match(member, /profile\?\.is_locked \|\| !profile\?\.can_view_details/);
  assert.match(member, /profile \? <ProfileAvatar userId=\{profile\.user_id\}/);
  assert.match(member, /Private profile/);
});
