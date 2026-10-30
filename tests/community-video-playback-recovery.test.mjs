import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideCommunityVideoErrorRecovery as decide } from '../src/lib/communityVideoPlayback.ts';

test('one automatic same signed URI replay, then one bounded refresh', () => {
  assert.equal(decide({active: true, replayAttempts: 0, retryNotBefore: 0, now: 1000, reported: false}), 'replay');
  assert.equal(decide({active: true, replayAttempts: 1, retryNotBefore: 3500, now: 2000, reported: false}), 'ignore');
  assert.equal(decide({active: true, replayAttempts: 1, retryNotBefore: 3500, now: 3500, reported: false}), 'refresh');
  assert.equal(decide({active: true, replayAttempts: 1, retryNotBefore: 3500, now: 4500, reported: true}), 'ignore');
  assert.equal(decide({active: false, replayAttempts: 0, retryNotBefore: 0, now: 1000, reported: false}), 'ignore');
});

test('Expo player owns one replay before reporting source rotation, without touching IMA', () => {
  const source = readFileSync('src/components/CommunityVideo.tsx','utf8');
  const start = source.indexOf('function ExpoCommunityVideo(');
  const body = source.slice(start);
  assert.ok(start > 0);
  assert.match(body,/decideCommunityVideoErrorRecovery\(\{/);
  assert.match(body,/if \(action === 'replay'\)/);
  assert.match(body,/player\.replay\(\)/);
  assert.match(body,/if \(action === 'refresh'\)/);
  assert.match(body,/playbackErrorHandlerRef\.current\?\.\(\)/);
  assert.match(body,/clearTimeout\(replayTimerRef\.current\)/);
  assert.match(source,/function ImaCommunityVideo\(/);
  assert.match(source,/onAdEvent=\{\(event\) => \{/);
});

test('scoped Wall refreshes protected Supabase or AWS video URLs with bounded attempts', () => {
  const scope = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
  assert.match(scope,/onPlaybackError=\{\(\) => \{\s*void recoverScopedWallVideo\(item\)/);
  assert.match(scope,/videoRefreshAttemptsRef\.current\.get\(postId\)/);
  assert.match(scope,/attempts >= 2 \|\| videoRefreshInFlightRef\.current\.has\(postId\)/);
  assert.match(scope,/getAwsWallVideoViewUrl\(postId, mediaPath\.slice\(4\), true\)/);
  assert.match(scope,/resignCommunityMediaUrl\(mediaPath\)/);
  assert.match(scope,/String\(row\.media_url \?\? ''\) === failedUri/);
  assert.doesNotMatch(scope,/getPublicUrl\(/);
});

test('existing one-visible-player and bounded cache behavior remains unchanged', () => {
  const policy = readFileSync('src/lib/communityVideoPlayback.ts','utf8');
  const publicWall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');
  const scope = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
  assert.match(policy,/COMMUNITY_VIDEO_CACHE_BUDGET_BYTES = 256 \* 1024 \* 1024/);
  assert.match(publicWall,/visibleVideoPostId===postId/);
  assert.match(scope,/visibleVideoPostId ===\s*String\(item\.id\)/);
});
