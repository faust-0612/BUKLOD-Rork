import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Wall retains functional scroll navigation, preserved media and sponsored ads', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const searchRail = wall.indexOf('<BuklodCommunityWallProfileBubbles />');
  const quickLinks = wall.indexOf('<BuklodWallQuickLinks', searchRail);
  assert.ok(searchRail > 0 && quickLinks > searchRail, 'Wall search/Notes should be above quick links');
  assert.match(wall, /reportBuklodDashboardScroll\('wall'/);
  assert.match(wall, /BuklodFirstViewAd/);
  assert.match(wall, /BuklodCommunitySponsoredAd/);
  assert.match(wall, /BuklodCommunityInlineAd/);
  assert.match(wall, /BuklodMaritesBoard/);
});

test('Connect retains navigation, unread badges, search, and actual AdMob placement', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  assert.match(inbox, /reportBuklodDashboardScroll\('connect'/);
  assert.match(inbox, /openPersonalThread\(/);
  assert.match(inbox, /openCommunityRoom\(/);
  assert.match(inbox, /ConnectInboxTabs/);
  assert.match(inbox, /personalUnread=\{regularThreads\.reduce/);
  assert.match(inbox, /BuklodFirstViewAd/);
  assert.match(inbox, /BuklodNativeSponsoredCard/);
  assert.doesNotMatch(inbox, /<View style=\{styles\.hero\}>/);
});
