import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicWall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
const scopedWall = readFileSync(new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url), 'utf8');
const caption = readFileSync(new URL('../src/components/BuklodExpandableWallCaption.tsx', import.meta.url), 'utf8');

test('Public Wall retains its stable feed instance, anchor and pagination', () => {
  assert.match(publicWall, /<FlashList/);
  assert.match(publicWall, /ref=\{communityFeedRefBackR2\}/);
  assert.match(publicWall, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/);
  assert.match(publicWall, /loadMoreCommunity186L\(\)/);
  assert.match(publicWall, /onRefresh=\{refreshCommunity186L\}/);
});

test('Scoped Wall keeps FlatList keying and refreshing around the caption', () => {
  assert.match(scopedWall, /<FlatList<any>/);
  assert.match(scopedWall, /keyExtractor=/);
  assert.match(scopedWall, /onRefresh=/);
  assert.match(scopedWall, /<BuklodExpandableWallCaption/);
});

test('Caption expands locally without routing, feed remounts or global scroll mutation', () => {
  assert.match(caption, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.doesNotMatch(caption, /\brouter\.|\bscrollToOffset\b|\bscrollToIndex\b|\bnavigate\(/);
  assert.match(publicWall, /<BuklodExpandableWallCaption\s+key=\{String\(item\.id\)\}/);
  assert.match(scopedWall, /<BuklodExpandableWallCaption\s+key=\{String\(item\.id\)\}/);
});
