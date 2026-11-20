import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test("Today's Best moves ahead of Wall search without losing navigation or scope", () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const header = wall.slice(wall.indexOf('ListHeaderComponent={<BuklodFocusFadeUp'));
  const storyIndex = header.indexOf('<BuklodMaritesBoard');
  const searchIndex = header.indexOf('<BuklodCommunityWallProfileBubbles />');
  const shortcutsIndex = header.indexOf('<BuklodWallQuickLinks');
  assert.ok(storyIndex >= 0 && searchIndex > storyIndex && shortcutsIndex > searchIndex);
  const story = header.slice(storyIndex, searchIndex);
  assert.match(story, /locationScopeId=\{/);
  assert.match(story, /publicLocationScopeId/);
  assert.match(story, /onOpenComments=/);
  assert.match(header, /onCommunityPress=\{\(\) => communityFeedRefBackR2\.current\?\.scrollToOffset/);
  assert.match(wall, /<BuklodPublicLocationChips/);
  assert.match(wall, /onChange=\{\s*setPublicLocationScopeId\s*\}/);
});

test('Native search/Notes rail and web search remain functional after reordering', () => {
  const nativeRail = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const webHeader = read('src/components/BuklodCommunityConnectHeader.web.tsx');
  const webWrapper = read('src/components/BuklodMaritesBoard.web.tsx');
  assert.match(nativeRail, /placeholder="Search messages or people"/);
  assert.match(webHeader, /placeholder="Search messages or people"/);
  assert.ok(webWrapper.indexOf('<BaseBuklodMaritesBoard {...props} />') < webWrapper.indexOf('<BuklodCommunityConnectHeaderWeb />'));
});
