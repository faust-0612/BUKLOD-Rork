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
  assert.match(video, /active: props\.active !== false/);
  assert.match(video, /playIntent/);
  assert.match(video, /return \([\s\S]*?<InactiveCommunityVideo/);
  assert.match(video, /pointerEvents="none"/);
});

test('offscreen feed rows do not create thumbnail players or trigger poster uploads', () => {
  const video = read('src/components/CommunityVideo.tsx');
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  const preview = read('src/lib/communityVideoPreview.ts');
  assert.doesNotMatch(video, /createVideoPlayer\(/);
  assert.match(video, /if \(Platform\.OS !== 'web' && !posterUri/);
  assert.match(upload, /generateWallPreview = false/);
  assert.match(upload, /if \(!generateWallPreview\) return \{\}/);
  assert.match(preview, /createVideoPlayer\(\{ uri \}\)/);
});
