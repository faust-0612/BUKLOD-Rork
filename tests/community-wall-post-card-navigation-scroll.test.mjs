import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicWall = readFileSync(
  new URL('../src/app/(tabs)/buklod.tsx', import.meta.url),
  'utf8',
);
const scopedWall = readFileSync(
  new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url),
  'utf8',
);

test('Shared Public Wall card integration preserves FlashList scroll anchoring policy', () => {
  const list = publicWall.slice(
    publicWall.indexOf(' <FlashList\n'),
    publicWall.indexOf(' <FlashList\n') + 1400,
  );
  assert.match(list, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/);
  assert.match(list, /ref=\{communityFeedRefBackR2\}/);
  assert.match(list, /onScroll=\{/);
});

test('Public Wall pagination and refresh remain connected after card integration', () => {
  assert.match(publicWall, /onEndReached=\{\(\) => \{\s*void loadMoreCommunity186L\(\)/);
  assert.match(publicWall, /onRefresh=\{refreshCommunity186L\}/);
  assert.match(publicWall, /communityFeedRows\s*=\s*useMemo/);
});

test('Scoped Wall retains its existing FlatList and card sizing boundary', () => {
  assert.match(scopedWall, /<FlatList<any>/);
  assert.match(scopedWall, /<BuklodCommunityWallPostCard[\\s\\S]*?containerStyle=\\{focusId === item\\.id \\?/);
  assert.doesNotMatch(scopedWall, /<View\s+style=\{\[styles\.postCard/);
  assert.doesNotMatch(scopedWall, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true/);
});
