import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('persistent video posters preserve Wall viewability, inactive-player gating and immediate touch behavior', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const video = read('src/components/CommunityVideo.tsx');
  assert.match(wall, /onViewableItemsChanged/);
  assert.match(wall, /viewabilityConfig/);
  assert.match(video, /shouldMountCommunityVideoPlayer\(/);
  assert.match(video, /const active = props\.active !== false/);
  assert.match(video, /playIntent/);
  assert.match(video, /return \([\s\S]*?<InactiveCommunityVideo/);
  assert.match(video, /pointerEvents="none"/);
});

test('offscreen feed rows do not create thumbnail players or trigger poster uploads', () => {
  const video = read('src/components/CommunityVideo.tsx');
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  const preview = read('src/lib/communityVideoPreview.ts');
  assert.doesNotMatch(video, /createVideoPlayer\(/);
  assert.match(video, /if \(isPlaying && Platform\.OS !== 'web' && !posterUri/);
  assert.match(upload, /generateWallPreview = false/);
  assert.match(upload, /if \(!generateWallPreview\) return \{\}/);
  assert.match(preview, /createVideoPlayer\(\{ uri \}\)/);
});


test('Community Wall videos use the Marites full-frame presentation without changing Marites', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const video = read('src/components/CommunityVideo.tsx');
  const web = read('src/components/CommunityVideo.web.tsx');
  const marites = read('src/components/BuklodMaritesBoard.tsx');
  assert.match(marites, /contentFit="contain"/);
  assert.match(publicWall, /edgeToEdge\s+fitFrame\s+autoPlay/);
  assert.match(scopedWall, /height=\{\s*470\s*\}\s*fitFrame\s*autoPlay/);
  assert.match(video, /!fullscreen && preserveAspectRatio && !fitFrame && videoAspectRatio/);
  assert.match(video, /contentFit=\{preserveAspectRatio \? 'contain' : 'cover'\}/);
  assert.match(web, /objectFit: fullscreen \|\| fitFrame \? 'contain' : 'cover'/);
  assert.match(web, /muted: fullscreen \? false : !soundOn/);
});

test('viewport autoplay is independent from ad visibility, and one next video prepares without playback', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const hook = read('src/hooks/useBuklodCommunityAdViewability.ts');
  const policy = read('src/lib/communityVideoPlayback.ts');
  const native = read('src/components/CommunityVideo.tsx');
  assert.match(hook, /minimumViewTime: 400/); // Ad visibility unchanged.
  assert.match(hook, /videoViewabilityConfig/);
  assert.match(hook, /preloadVideoPostId/);
  assert.match(publicWall, /viewabilityConfigCallbackPairs=\{communityViewabilityPairs\}/);
  assert.match(scope, /viewabilityConfigCallbackPairs=\{\s*communityViewabilityPairs\s*\}/);
  assert.match(publicWall, /preloadVideoPostId===postId/);
  assert.match(scope, /preloadVideoPostId ===\s*String\(item\.id\)/);
  assert.match(native, /preload: !imaEligible && !degraded/);
  assert.match(native, /keepWarm: !imaEligible && recentlyActive/);
  assert.match(native, /minBufferForPlayback: 1/);
  assert.equal(policy.includes('if (!input.active && !input.preload && !input.keepWarm) return false;'), true);
  assert.equal(policy.includes('COMMUNITY_VIDEO_CACHE_BUDGET_BYTES = 256 * 1024 * 1024'), true);
});

test('retry is tappable above the overlay only after recovery; progress is not reset on every buffer', () => {
  const native = read('src/components/CommunityVideo.tsx');
  const body = native.slice(native.indexOf('function ExpoCommunityVideo('));
  const tap = body.indexOf('style={styles.tapLayer}');
  const retry = body.indexOf('style={styles.retryButton}');
  assert.ok(tap >= 0 && retry > tap, 'Retry must receive touch priority');
  assert.match(body, /playerStatus === 'error' && !autoRecovering/);
  assert.match(body, /recoveryDeadlineRef\.current = setTimeout/);
  assert.match(body, /resumeAppliedRef\.current/);
  assert.match(body, /playbackTimeByUri\.get\(playbackIdentity\)/);
  assert.match(body, /playbackKey \? `post:\$\{playbackKey\}` : uri/);
});

test('public Wall video URL retry never permanently blacklists a failed signed URL', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /wallVideoRefreshInFlightRef=useRef\(new Set<string>\(\)\)/);
  assert.match(wall, /Date\.now\(\)<last\.retryAfter/);
  assert.match(wall, /retryAfter:Date\.now\(\)\+2500/);
  assert.match(wall, /finally\{\s*wallVideoRefreshInFlightRef\.current\.delete\(postId\)/);
  assert.doesNotMatch(wall, /\.current\[postId\]===failed/);
});

test('thumbnail work is deferred until the first visible frame has played', () => {
  const video = read('src/components/CommunityVideo.tsx');
  const ready = video.slice(video.indexOf("if (nextStatus === 'readyToPlay')"), video.indexOf('const playingSub'));
  assert.doesNotMatch(ready, /generateThumbnailsAsync/);
  assert.match(video, /posterTimerRef\.current = setTimeout/);
  assert.match(video, /\}, 1500\)/);
  assert.match(video, /!activeRef\.current \|\| !playingRef\.current/);
  assert.match(video, /clearTimeout\(posterTimerRef\.current\)/);
});
