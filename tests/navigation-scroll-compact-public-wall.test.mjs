import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');

test('compact Wall header leaves feed scroll, pagination and refresh semantics unchanged', () => {
  const listStart = wall.indexOf(' <FlashList\n');
  const list = wall.slice(listStart, listStart + 1800);
  assert.match(list, /maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(list, /onScroll=\{/);
  assert.match(list, /onEndReached=\{\(\) => \{/);
  assert.match(list, /onRefresh=\{refreshCommunity186L\}/);
  assert.match(wall, /communityFeedRefBackR2\.current\.scrollToTop\(\{ animated: true \}\)/);
});

test('all compact Wall entry controls remain in the scrollable header', () => {
  const start = wall.indexOf('/* PATCH_161A_COMMUNITY_COMPACT */');
  const end = wall.indexOf("{Platform.OS !== 'web' ?", start);
  const header = wall.slice(start, end);
  assert.match(header, /Open My Bible/);
  assert.match(header, /COMMUNITY/);
  assert.match(header, /Open 702 DZAS Radio/);
  assert.match(wall, /BuklodCommunityWallProfileBubbles/);
});
