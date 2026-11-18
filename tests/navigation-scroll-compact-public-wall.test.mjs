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

test('all compact Wall controls remain inside the scrollable header', () => {
  // The Platform.OS conditional now directly follows the marker, so slice the
  // actual FlashList ListHeaderComponent boundaries to verify scroll containment.
  const start = wall.indexOf('ListHeaderComponent={<BuklodFocusFadeUp');
  const end = wall.indexOf('</BuklodFocusFadeUp>}', start);
  assert.ok(start > 0 && end > start, 'Wall controls must remain in the scrollable FlashList header');
  const header = wall.slice(start, end);
  assert.match(header, /<BuklodCommunityWallProfileBubbles/);
  assert.match(header, /<BuklodFirstViewAd/);
  assert.ok(header.indexOf('<BuklodWallQuickLinks') < header.indexOf('<BuklodFirstViewAd'), 'QuickLinks precede first-view ad without removing it');
  const shortcuts = readFileSync('src/components/BuklodWallQuickLinks.tsx','utf8');
  assert.match(header, /<BuklodWallQuickLinks/);
  assert.match(shortcuts, /Open My Bible/);
  assert.match(shortcuts, /COMMUNITY/);
  assert.match(shortcuts, /Open 702 DZAS Radio/);
  assert.match(wall, /BuklodCommunityWallProfileBubbles/);
});
