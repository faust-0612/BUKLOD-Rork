import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const collage = read('src/components/BuklodCommunityPhotoCollage.tsx');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const engagement = read('src/components/BuklodCommunityPostEngagement.tsx');

test('both Community Wall feeds reserve one media height for first and late photos', () => {
  assert.match(publicWall, /showLayoutPicker\s+stableFeedFrame\s+items=\{media\}/);
  assert.match(publicWall, /showLayoutPicker\s+stableFeedFrame\s+items=\{communityPhotoCollageItems\(/);
  assert.match(scopedWall, /showLayoutPicker\s+stableFeedFrame\s+items=\{communityPhotoCollageItems\(/);
  assert.match(collage, /stableFeedFrame = false/);
  assert.match(collage, /const collageHeight = stableFeedFrame && height == null\s*\? stableHeight\s*: count === 1/);
  assert.match(collage, /const stableHeight = Math\.min\(440, Math\.max\(300, Math\.round\(viewportWidth \* 0\.95\)\)\)/);
});

test('image decode is not allowed to resize or crop a live Community feed card', () => {
  assert.match(collage, /stableFeedFrame && height == null\s*\? 'contain'/);
  const callback = collage.slice(collage.indexOf('onLoad={(event: any) => {'), collage.indexOf('const visible = photos.slice(0, 4)'));
  assert.match(callback, /!preserveSinglePhotoAspectRatio \|\|\s*stableFeedFrame \|\|\s*height != null/);
  assert.match(callback, /setSingleAspect\(current =>/);
  // Normal detail/viewer surfaces retain their intrinsic dimensions.
  assert.match(collage, /singlePhotoFrame = preserveSinglePhotoAspectRatio && singleAspectRatio/);
});

test('late recent-comment metadata fills a reserved slot instead of inserting new height', () => {
  assert.match(engagement, /showCommentPreview && \(commentPreview \|\| totalComments > 0\)/);
  assert.match(engagement, /<View style=\{styles\.commentPreviewSlot\}>/);
  assert.match(engagement, /commentPreviewSlot: \{ minHeight: 94 \}/);
  assert.match(engagement, /<BuklodCommunityCommentPreview/);
});

test('Wall feed virtualization, ad cadence and native rendering remain owned by existing code', () => {
  assert.match(publicWall, /<FlashList/);
  assert.match(publicWall, /maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(publicWall, /buildCommunityFeedWithInlineAds\(/);
  assert.match(scopedWall, /<FlatList<any>/);
  assert.match(scopedWall, /buildCommunityFeedWithInlineAds\(/);
});
