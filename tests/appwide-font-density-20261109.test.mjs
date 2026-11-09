import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicStyles = read('src/app/(tabs)/buklodCommunityStyles.ts');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const field = read('src/components/BuklodMentionField.tsx');
const comment = read('src/components/BuklodCommunityCommentComposer.tsx');
const chat = read('src/components/BuklodConnectThread.tsx');
const story = read('src/components/BuklodMaritesBoard.tsx');
const card = read('src/components/BuklodCommunityWallPostCard.tsx');

test('Public and scoped Wall composers use readable text with a useful multiline height', () => {
  assert.match(publicStyles, /area:\s*\{[\s\S]*?minHeight:96[\s\S]*?maxHeight:200[\s\S]*?fontSize:16/);
  assert.match(scoped, /composer:\s*\{[\s\S]*?minHeight:\s*104[\s\S]*?maxHeight:\s*220[\s\S]*?fontSize:\s*16/);
  assert.match(field, /<TextInput[\s\S]*?multiline\s+allowFontScaling/);
  assert.match(field, /visibleTyping:\s*\{[\s\S]*?fontSize:\s*16/);
});

test('Full-bleed Wall media insets track the compact card gutter', () => {
  assert.match(card, /feedCard:\s*\{[\s\S]*?padding:\s*8/);
  assert.equal((publicWall.match(/marginHorizontal:-8/g) ?? []).length, 3);
  assert.doesNotMatch(publicWall, /marginHorizontal:-12/);
});

test('Comment and chat typing fields grow without oversized gutters', () => {
  assert.match(comment, /input:\s*\{[\s\S]*?minHeight:\s*48[\s\S]*?maxHeight:\s*150[\s\S]*?fontSize:\s*16/);
  assert.match(chat, /input:\s*\{[\s\S]*?minHeight:\s*48[\s\S]*?maxHeight:\s*150[\s\S]*?fontSize:\s*16/);
});

test('Feed posts, chat messages and Marites writing boxes remain readable', () => {
  assert.match(publicStyles, /body:\s*\{[^}]*fontSize:17/);
  assert.match(chat, /body:\s*\{[^}]*fontSize:\s*16/);
  assert.match(story, /input:\s*\{[^}]*fontSize:\s*16/);
});

test('Community comment input style separates background and readable font declarations', () => {
  assert.match(publicStyles, /communityCommentInput:\s*\{[\s\S]*?backgroundColor:\s*c\.background,\s*fontSize:\s*16/);
});
