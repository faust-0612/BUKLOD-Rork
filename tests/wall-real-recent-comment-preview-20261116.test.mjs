import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommunityWallMetadata } from '../src/lib/communityWallHydration.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const previews = read('src/lib/buklodPostCommentPreviews.ts');
const engagement = read('src/components/BuklodCommunityPostEngagement.tsx');
const webEngagement = read('src/components/BuklodCommunityPostEngagement.web.tsx');
const visiblePreview = read('src/components/BuklodCommunityCommentPreview.tsx');

test('feed actually loads the latest comment body, name, avatar and timestamp', () => {
  assert.match(visiblePreview, /preview\.author_name/);
  assert.match(visiblePreview, /preview\.body/);
  assert.match(visiblePreview, /BuklodTappableAvatar/);
  assert.match(visiblePreview, /formatSpecificDateTime\(preview\.created_at\)/);
  assert.match(engagement, /showCommentPreview && commentPreview/);
  assert.match(webEngagement, /\{commentPreview \? \(/);
  assert.doesNotMatch(engagement, /Recent comment|tap to view/);
  assert.doesNotMatch(webEngagement, /Recent comment|tap to view/);
});

test('public Wall fetches comment previews asynchronously after first media paint', () => {
  assert.match(publicWall, /const pendingCommentPreviews:/);
  assert.match(publicWall, /void pendingCommentPreviews/);
  assert.match(publicWall, /communityLoadSeq !== communityLoadSeqRef\.current/);
  assert.match(publicWall, /requestedCommentIds\.has\(id\)/);
  assert.doesNotMatch(publicWall, /4000,\s*'Community comments'/);
});

test('scoped Wall fetches asynchronously with scope and sequence protection', () => {
  assert.match(scopedWall, /const previewPromise = fetchBuklodPostCommentPreviews/);
  assert.match(scopedWall, /void previewPromise/);
  assert.match(scopedWall, /scopeMediaLoadSeqRef\.current !== loadSeq/);
  assert.match(scopedWall, /requestedCommentIds\.has\(id\)/);
  assert.doesNotMatch(scopedWall, /4000,\s*'Scoped comments'/);
});

test('batch RPC can recover missing or failed previews with existing RLS, without one query per card', () => {
  assert.match(previews, /get_buklod_post_comment_previews_v1/);
  assert.match(previews, /commentedPostIds\.filter\(id => ids\.includes\(id\) && !map\[id\]\)/);
  assert.match(previews, /fetchCommentPreviewsDirect\(missing\)/);
  assert.match(previews, /fetchCommentPreviewsDirect\(ids\)/);
  assert.match(previews, /\.eq\('is_hidden', false\)/);
  assert.match(previews, /\.is\('deleted_at', null\)/);
  assert.match(previews, /\.in\('post_id', postIds\)/);
});

test('refresh preserves the actual last verified comment, but clears it at zero count', () => {
  const latest = { comment_id:'c1', body:'Real comment', user_id:'u1' };
  const previous = [{ id:'p1', comment_count:2, comment_preview:latest, media_items:[{media_path:'photo'}] }];
  const late = applyCommunityWallMetadata(previous, [{id:'p1',comment_count:2, comment_preview:null, author_rank_name:'Circle I'}]);
  assert.deepEqual(late[0].comment_preview, latest);
  assert.deepEqual(late[0].media_items, previous[0].media_items);
  const emptied = applyCommunityWallMetadata(late, [{id:'p1',comment_count:0, comment_preview:null}]);
  assert.equal(emptied[0].comment_preview, null);
});

test('a successful new comment refreshes only its own preview without reloading Wall', () => {
  assert.match(publicWall, /Community new comment preview:/);
  assert.match(publicWall, /fetchBuklodPostCommentPreviews\(\[postId\],\[postId\]\)/);
  assert.match(scopedWall, /Scoped new comment preview:/);
  assert.match(scopedWall, /fetchBuklodPostCommentPreviews\(\[postId\], \[postId\]\)/);
});
