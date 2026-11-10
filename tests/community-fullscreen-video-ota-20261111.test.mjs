import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const component = read('src/components/CommunityVideo.tsx');
const engagement = read('src/components/BuklodCommunityPostEngagement.tsx');
const view = wall.slice(
  wall.indexOf('{/* BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_SWIPE_R4 */}'),
  wall.indexOf('{/* PATCH_161H_PHOTO_VIEWER */}')
);
const opening = wall.slice(wall.indexOf('const openVideoViewer='), wall.indexOf('const renderCommunityMedia='));
const refresh = wall.slice(wall.indexOf('const refreshVideoViewerUrl='), wall.indexOf('/* BUKLOD_WALL_VIDEO_PLAYABLE_REFRESH_R6 */'));

test('fullscreen player opens using existing permitted URL, without immediately re-signing/restarting', () => {
  assert.ok(opening.includes('setVideoViewerPosts([target])'));
  assert.doesNotMatch(opening, /void refreshVideoViewerUrl\(/);
  assert.ok(view.includes('videoViewerFreshUrls['));
  assert.ok(view.includes('descriptor?.uri'));
});

test('swipe changes playback on viewport entry and makes near-next video warm', () => {
  assert.match(wall, /videoViewerOnViewableItemsChanged=useRef/);
  assert.match(wall, /itemVisiblePercentThreshold:60/);
  assert.match(view, /onViewableItemsChanged=\{videoViewerOnViewableItemsChanged\}/);
  assert.match(view, /viewabilityConfig=\{videoViewerViewabilityConfig\}/);
  assert.match(view, /extraData=\{videoViewerIndex\}/);
  assert.match(view, /preload=\{index===videoViewerIndex\+1\}/);
  assert.match(view, /initialNumToRender=\{2\}/);
  assert.match(view, /windowSize=\{3\}/);
  const scroll = view.slice(view.indexOf('onMomentumScrollEnd='), view.indexOf('onEndReached='));
  assert.doesNotMatch(scroll, /refreshVideoViewerUrl\(/);
});

test('fullscreen snaps to measured modal height, preventing navigation-bar drift', () => {
  assert.match(view, /setVideoViewerPageHeight/);
  assert.match(view, /snapToInterval=\{videoViewerPageHeight\}/);
  assert.match(view, /getItemLayout/);
  assert.match(view, /height=\{videoViewerPageHeight\}/);
});

test('private media refresh occurs only after an actual playback error with bounded session-safe requests', () => {
  assert.match(view, /onPlaybackError=\{\(\)=>\{\s*void refreshVideoViewerUrl\(item,fullscreenUri\)/);
  assert.match(refresh, /videoViewerUrlInflightRef\.current\.has\(postId\)/);
  assert.match(refresh, /attempts>=3/);
  assert.match(refresh, /videoViewerUrlRetryAfterRef\.current\.set\(postId,now\+2500\)/);
  assert.match(refresh, /requestSession!==videoViewerScanSeqRef\.current/);
  assert.match(refresh, /if\(!freshUrl \|\| freshUrl===failed\)return null/);
  assert.match(refresh, /videoViewerUrlInflightRef\.current\.delete\(postId\)/);
  assert.doesNotMatch(view, /Refreshing videoâ/);
});

test('fullscreen chrome and comment actions do not obscure the video and status bar', () => {
  assert.match(view, /paddingTop:Math\.max\(communityInsets\.top\+14,54\)/);
  assert.match(view, /showCommentPreview=\{false\}/);
  assert.match(view, /socialActions/);
  assert.match(view, /videoViewerShowHint/);
  assert.match(view, /Reconnecting video…/);
  assert.match(engagement, /showCommentPreview = true/);
  assert.match(engagement, /showCommentPreview && totalComments > 0/);
  assert.match(component, /viewerSafeInsets\.top \+ 16/);
});

test('existing byte caching, signed authorization and native ads remain in place', () => {
  assert.match(component, /useCaching: true/);
  assert.match(component, /keepWarm: !imaEligible && recentlyActive/);
  assert.match(component, /if \(imaEligible && active\)/);
  assert.match(view, /playbackKey=\{postId\}/);
  assert.match(component, /onPlaybackError/);
});
