import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldMountCommunityVideoPlayer } from '../src/lib/communityVideoPlayback.ts';

const read = path => readFileSync(path, 'utf8');

test('Public and scoped Wall photo tiles request original bytes directly, never low-resolution sidecars', () => {
  const collage = read('src/components/BuklodCommunityPhotoCollage.tsx');
  const matches = collage.match(/useWallPreview=\{false\}/g) || [];
  assert.ok(matches.length >= 3, 'single, collage and Swipe layout must bypass preview-first rendering');
  assert.doesNotMatch(collage, /^\s+useWallPreview\s*$/m);
});

test('direct original display keeps signed authorization, disk caching and independent native recovery', () => {
  const image = read('src/components/BuklodCachedMediaImage.android.tsx');
  assert.match(image, /const path = usingPreview \? markedPreviewPath! : originalPath/);
  assert.match(image, /resolveCommunityMediaUrl\(path, null\)/);
  assert.match(image, /source=\{\{ uri: actual\.url, cacheKey \}\}/);
  assert.match(image, /cachePolicy="memory-disk"/);
  assert.match(image, /decideAndroidPhotoRecovery/);
  assert.match(image, /renderer: current\.renderer === 'native' \? 'expo' : 'native'/);
  assert.doesNotMatch(image, /getPublicUrl|\/object\/public\//);
});

test('active native Wall video mounts even under degraded reachability, offscreen video does not', () => {
  assert.equal(shouldMountCommunityVideoPlayer({
    active: true, fullscreen: false, degraded: true, playIntent: false,
  }), true);
  assert.equal(shouldMountCommunityVideoPlayer({
    active: false, fullscreen: false, degraded: true, playIntent: true,
  }), false);
  const native = read('src/components/CommunityVideo.tsx');
  const web = read('src/components/CommunityVideo.web.tsx');
  assert.match(native, /useVideoPlayer\(/);
  assert.match(native, /contentFit=\{fullscreen \|\| \(preserveAspectRatio && !fillFrame\) \? 'contain' : 'cover'\}/);
  assert.match(web, /objectFit: fullscreen \|\| fitFrame \? 'contain' : 'cover'/);
});

test('new presentation source is shared by Public and scoped Walls with existing private data path', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(publicWall, /BuklodCommunityPhotoCollage/);
  assert.match(scopedWall, /BuklodCommunityPhotoCollage/);
  assert.match(publicWall, /CommunityVideo/);
  assert.match(scopedWall, /CommunityVideo/);
});
