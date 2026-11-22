import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const publicFeed = read('src/app/(tabs)/buklod.tsx');
const scopeFeed = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const collage = read('src/components/BuklodCommunityPhotoCollage.tsx');

test('Public Wall keeps FlashList identity, scroll, pagination and video/ad lifecycles', () => {
  assert.match(publicFeed, /<FlashList/);
  assert.match(publicFeed, /maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(publicFeed, /ref=\{communityFeedRefBackR2\}/);
  assert.match(publicFeed, /keyExtractor=\{\(i: any\)=>i\.id\}/);
  assert.match(publicFeed, /loadMoreCommunity186L\(\)/);
  assert.match(publicFeed, /<BuklodCommunityInlineAd/);
  assert.match(publicFeed, /onVideoFrameLayout/);
});

test('Scoped Organization and Cluster Wall preserve one list and stable photo frames', () => {
  assert.match(scopeFeed, /<FlatList<any>/);
  assert.match(scopeFeed, /keyExtractor=\{/);
  assert.match(scopeFeed, /buildCommunityFeedWithInlineAds\(/);
  assert.match(scopeFeed, /showLayoutPicker\s+stableFeedFrame\s+items=\{communityPhotoCollageItems\(/);
  assert.match(scopeFeed, /<BuklodCommunityInlineAd/);
  assert.match(collage, /stableFeedFrame && height == null\s*\? stableHeight/);
});
