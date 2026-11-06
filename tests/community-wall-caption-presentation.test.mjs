import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const caption = readFileSync(new URL('../src/components/BuklodExpandableWallCaption.tsx', import.meta.url), 'utf8');
const publicWall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
const scopedWall = readFileSync(new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url), 'utf8');

test('Wall caption shows a single line with an inline See more action', () => {
  assert.match(caption, /numberOfLines=\{1\}/);
  assert.match(caption, /styles\.collapsedRow/);
  assert.match(caption, /accessibilityLabel="See more"/);
  assert.match(caption, /accessibilityLabel="See less"/);
  assert.match(caption, /setExpanded\(false\)/);
});

test('Only text-only posts of at most 80 Unicode code points receive large text', () => {
  assert.match(caption, /const LARGE_TEXT_LIMIT = 80/);
  assert.match(caption, /Array\.from\(fullText\.trim\(\)\)\.length/);
  assert.match(caption, /!hasMedia && charCount > 0 && charCount <= LARGE_TEXT_LIMIT/);
  assert.match(caption, /styles\.largeText/);
  assert.match(caption, /fontSize: 25/);
});

test('Both Public and scoped Wall detect media without changing media engines', () => {
  assert.match(publicWall, /<BuklodExpandableWallCaption[\s\S]*?hasMedia=\{Boolean\(/);
  assert.match(scopedWall, /<BuklodExpandableWallCaption[\s\S]*?hasMedia=\{Boolean\(/);
  assert.match(publicWall, /renderCommunityMedia\(item\)/);
  assert.match(scopedWall, /communityPhotoCollageItems\(/);
  assert.match(scopedWall, /<CommunityVideo/);
});

test('Caption keeps canonical mention recognition and resets on recycled content', () => {
  assert.match(caption, /BuklodMentionText/);
  assert.match(caption, /\.\.\.mentionProps/);
  assert.match(caption, /\[fullText, hasMedia\]/);
  assert.match(caption, /text=\{fullText\}/);
});
