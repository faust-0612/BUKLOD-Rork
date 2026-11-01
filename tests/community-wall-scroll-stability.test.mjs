import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicWall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const scopedWall = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx', 'utf8');

test('Public Wall disables implicit FlashList v2 upward scroll correction', () => {
  const list = publicWall.slice(publicWall.indexOf(' <FlashList\n'), publicWall.indexOf(' <FlashList\n') + 1000);
  assert.match(list, /<FlashList[\s\S]*?maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/);
  assert.match(list, /ref=\{communityFeedRefBackR2\}/);
  assert.match(list, /onScroll=\{/);
});

test('Existing pagination and manual refresh are still connected to Public Wall', () => {
  assert.match(publicWall, /onEndReached=\{\(\) => \{\s*void loadMoreCommunity186L\(\)/);
  assert.match(publicWall, /onRefresh=\{refreshCommunity186L\}/);
  assert.match(publicWall, /communityFeedRows\s*=\s*useMemo/);
});

test('Notification post focus and Android Back keep intentional scroll behaviors', () => {
  assert.match(publicWall, /if\(!focusedPost \|\| String\(focusedPost\.id\)!==focusPostId\)return/);
  assert.match(publicWall, /communityFeedRefBackR2\.current\?\.scrollToIndex\?\.\(\{/);
  assert.match(publicWall, /BackHandler\.addEventListener\(/);
  assert.match(publicWall, /communityFeedRefBackR2\.current\.scrollToTop\(\{ animated: true \}\)/);
});

test('Scoped Wall continues to use its existing FlatList, unchanged', () => {
  assert.match(scopedWall, /<FlatList<any>/);
  assert.doesNotMatch(scopedWall, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true/);
});

test('photo viewer compact dock stays inside modal without changing Public Wall feed scroll', () => {
  const modal = publicWall.slice(publicWall.indexOf('visible={viewerOpen}'), publicWall.indexOf('visible={viewerOpen}') + 5000);
  assert.match(modal, /<GestureFlatList/);
  assert.match(modal, /\{!viewerZoomed&&renderViewerPhotoActions\(\)\}/);
  assert.match(publicWall, /maintainVisibleContentPosition=\{\{\s*disabled:\s*true\s*\}\}/);
  assert.match(publicWall, /onEndReached=\{\(\) => \{\s*void loadMoreCommunity186L\(\)/);
});
