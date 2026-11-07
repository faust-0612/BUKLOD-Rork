import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const editor = read('src/components/BuklodMentionField.tsx');
const caption = read('src/components/BuklodExpandableWallCaption.tsx');
const postCard = read('src/components/BuklodCommunityWallPostCard.tsx');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const publicStyles = read('src/app/(tabs)/buklodCommunityStyles.ts');
const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');

test('Native caption keyboard text is visible immediately, not mirrored behind a transparent TextInput', () => {
  assert.match(editor, /style=\{\[styles\.visibleTyping, style\]\}/);
  assert.match(editor, /visibleTyping:\s*\{\s*color:\s*colors\.text/);
  assert.doesNotMatch(editor, /color:\s*['"]transparent['"]/);
  assert.doesNotMatch(editor, /<View pointerEvents="none" style=\{styles\.mirror\}/);
  assert.doesNotMatch(editor, /styles\.mirrorText|styles\.typing/);
  assert.match(editor, /onChangeText=\{changeText\}/);
  assert.match(editor, /value=\{value\}/);
  assert.match(editor, /ref=\{node => \{/);
});

test('Mention suggestions, selection and selected author insert still work on the same composer', () => {
  assert.match(editor, /activeMentionQuery\(text, cursor\)/);
  assert.match(editor, /insertMention\(/);
  assert.match(editor, /mentionsStillInText\(/);
  assert.match(editor, /search_post_mention_candidates_v2/);
  assert.match(editor, /p_audience: audience/);
  assert.match(editor, /p_group_id: audience === 'group' \? groupId : null/);
  assert.match(editor, /onSelectionChange=\{event => \{/);
  assert.match(publicWall, /<BuklodMentionField/);
  assert.match(scopedWall, /<BuklodMentionField/);
  assert.match(editor, /editable=\{!disabled\}/);
});

test('Short, text-only Wall posts display in large type, while media captions keep a one-line preview', () => {
  assert.match(caption, /const LARGE_TEXT_LIMIT = 80/);
  assert.match(caption, /!hasMedia && charCount > 0 && charCount <= LARGE_TEXT_LIMIT/);
  assert.match(caption, /fontSize: 25/);
  assert.match(caption, /styles\.largeText/);
  assert.match(caption, /numberOfLines=\{1\}/);
  assert.match(caption, /accessibilityLabel="See more"/);
  assert.match(caption, /accessibilityLabel="See less"/);
  assert.match(publicWall, /<BuklodExpandableWallCaption/);
  assert.match(scopedWall, /<BuklodExpandableWallCaption/);
  assert.match(caption, /BuklodMentionText/);
});

test('Public and scoped posts use compact spacing, retaining media, reactions and scroll handling', () => {
  assert.match(postCard, /feedCard:\s*\{[\s\S]*?padding: 12,[\s\S]*?marginBottom: 9,[\s\S]*?gap: 6,/);
  assert.match(publicStyles, /body:\{marginTop:4,fontSize:16,lineHeight:23,color:c\.text\}/);
  assert.match(publicWall, /\{\/\* PATCH_185A_R2_COMMUNITY_AUTHOR_PROFILE_PHOTO \*\/\}/);
  assert.match(publicWall, /marginBottom:0/g);
  assert.match(scopedWall, /postPhotos:\s*\{[\s\S]*?marginTop:\s*4/);
  assert.match(scopedWall, /body:\s*\{\s*marginTop:\s*4/);
  assert.match(publicWall, /renderCommunityMedia\(item\)/);
  assert.match(scopedWall, /<BuklodCommunityPhotoCollage/);
  assert.match(publicWall, /<FlashList/);
  assert.match(scopedWall, /<FlatList<any>/);
  assert.match(postCard, /<BuklodCommunityPostEngagement/);
  assert.match(postCard, /overflow: 'visible'/);
});

test('The previously approved Wall and Home card relocation remain protected', () => {
  const home = read('src/app/(tabs)/home.tsx');
  assert.match(home, /<BuklodCommunityContributionCard \/>/);
  assert.doesNotMatch(publicWall, /<BuklodCommunityContributionCard \/>/);
  assert.match(publicWall, /<BuklodMaritesBoard/);
  assert.match(publicWall, /<BuklodPublicLocationChips/);
  assert.match(publicWall, /Share with your Community\.\.\./);
});
