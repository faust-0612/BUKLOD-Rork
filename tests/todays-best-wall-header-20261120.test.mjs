import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test("Today's Best is the first native Wall section, before search, while ad slots remain", () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const headerStart = wall.indexOf('ListHeaderComponent={<BuklodFocusFadeUp');
  const story = wall.indexOf('<BuklodMaritesBoard', headerStart);
  const search = wall.indexOf('<BuklodCommunityWallProfileBubbles />', headerStart);
  const quickLinks = wall.indexOf('<BuklodWallQuickLinks', headerStart);
  const ad = wall.indexOf('<BuklodFirstViewAd', headerStart);
  assert.ok(headerStart >= 0 && story > headerStart && story < search && search < quickLinks && quickLinks < ad);
  assert.equal((wall.match(/<BuklodMaritesBoard\s/g) ?? []).length, 1, 'Do not double-mount the story player');
  assert.match(wall, /playbackBlocked=\{videoPriority\.maritesBlocked\}/);
  assert.match(wall, /onViewerVisibilityChange=\{setMaritesViewerOpen\}/);
  assert.match(wall, /visibilityRefreshRef=\{maritesVisibilityRefreshRef\}/);
  assert.match(wall, /BuklodCommunitySponsoredAd/);
  assert.match(wall, /BuklodCommunityInlineAd/);
});

test("Today's Best has a bigger heading and slightly larger story cards", () => {
  const story = read('src/components/BuklodMaritesBoard.tsx');
  const visual = read('src/lib/buklodVisual.ts');
  assert.match(story, /Today's Best/);
  assert.doesNotMatch(story, /MARITES STORY|New Marites Story/);
  assert.match(story, /title:\s*\{\s*fontSize: 16,/);
  assert.match(visual, /storyWidth: 148, storyHeight: 200/);
  assert.match(story, /const MARITES_COMPACT_CARD_WIDTH = buklodVisual\.size\.storyWidth/);
  assert.match(story, /const MARITES_COMPACT_CARD_HEIGHT = buklodVisual\.size\.storyHeight/);
  assert.match(story, /selectVisibleMaritesVideo/);
  assert.match(story, /<FlatList/);
  assert.match(story, /<Modal/);
});

test("Web Today's Best also precedes search and keeps the existing map", () => {
  const web = read('src/components/BuklodMaritesBoard.web.tsx');
  const story = web.indexOf('<BaseBuklodMaritesBoard {...props} />');
  const search = web.indexOf('<BuklodCommunityConnectHeaderWeb />');
  const map = web.indexOf('<BuklodWebCommunityMapHeader />');
  assert.ok(story > 0 && story < search && search < map);
});
