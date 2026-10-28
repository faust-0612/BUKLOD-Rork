const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

test('TUS video uploads recover authoritative offsets with bounded retries', () => {
  const source = read('src/lib/uploadCommunityResumableTus.ts');
  assert.match(source, /MAX_RECOVERY_ATTEMPTS = 3/);
  assert.match(source, /method: 'HEAD'/);
  assert.match(source, /serverOffset > offset/);
  assert.match(source, /offset = serverOffset/);
  assert.match(source, /timeoutMs: 300000/);
  assert.match(source, /if \(!patchResponse\.ok\)/);
});

test('photo uploads avoid redundant JPEG recompression and weak-uplink floods', () => {
  const source = read('src/lib/uploadCommunityVideoFile.ts');
  assert.match(source, /existingBytes <= 2 \* 1024 \* 1024/);
  assert.match(source, /return \{ uri, sizeBytes: existingBytes \}/);
  assert.match(source, /quality === 'normal' \? Math\.max\(1, concurrency\) : 1/);
  assert.match(source, /preferResumable: true/);
});

test('missing photos show a manual retry instead of indefinite signed URL requests', () => {
  const source = read('src/components/BuklodCachedMediaImage.tsx');
  assert.match(source, /resignAttemptRef\.current >= 2/);
  assert.match(source, /Hindi ma-load ang larawan/);
  // PR #390 uses the tap event so a retry does not also open a stale viewer.
  assert.match(source, /onPress=\{event => \{/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /onDisplay=\{\(\) => \{/);
  assert.match(source, /readFromCacheAsync/);
  assert.match(source, /cachedImage \|\| \(displayUri/);
  assert.match(source, /cachePolicy="memory-disk"/);
});

test('feed player shows weak-signal feedback and measures actual readiness', () => {
  const native = read('src/components/CommunityVideo.tsx');
  const web = read('src/components/CommunityVideo.web.tsx');
  assert.match(native, /Data saver sa mahinang signal/);
  assert.match(native, /nextStatus === 'readyToPlay'/);
  assert.match(native, /Date\.now\(\) - readyStartedAtRef\.current/);
  assert.doesNotMatch(native, /elapsedMs: 0,\s*status: 'ok',\s*player: 'expo-video'/);
  assert.match(web, /src: active \? uri : undefined/);
  assert.match(web, /preload: active \? 'metadata' : 'none'/);
});

test('the scoped wall keeps individual photo aspect ratios', () => {
  const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(scoped, /preserveSinglePhotoAspectRatio\s+onPressPhoto/);
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  assert.match(publicWall, /Keep BUKLOD open/);
});
