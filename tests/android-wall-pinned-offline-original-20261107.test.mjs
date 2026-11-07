import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const cache = read('src/lib/communityWallPinnedPhotoCache.ts');
const android = read('src/components/BuklodCachedMediaImage.android.tsx');
const collage = read('src/components/BuklodCommunityPhotoCollage.tsx');
const network = read('src/lib/buklodMediaUrl.ts');
const offline = read('src/lib/buklodOfflineSync.ts');

test('A decoded original is pinned from disk bytes; there is never a second network download', () => {
  assert.match(cache, /FileSystem\.documentDirectory/);
  assert.match(cache, /ExpoImage\.getCachePathAsync\(cacheKey\)/);
  assert.match(cache, /await FileSystem\.copyAsync\(\{ from: existing, to: temporary \}\)/);
  assert.match(cache, /await FileSystem\.moveAsync\(\{ from: temporary, to: destination \}\)/);
  assert.doesNotMatch(cache, /downloadAsync|createDownloadResumable|fetch\(|createSignedUrl|getPublicUrl/);
  assert.match(android, /onDisplay=\{\(\) => \{/);
  assert.match(android, /void pinLoadedCommunityWallPhoto\(\{/);
  assert.match(cache, /const pinning = new Map<string, Promise<void>>\(\)/);
});

test('A returning post can use the owner-scoped local original before signing or requesting network', () => {
  const image = android.slice(android.indexOf('function AndroidWallPhoto'));
  assert.match(image, /const \{ session \} = useAuth\(\)/);
  assert.match(image, /const ownerId = session\?\.user\?\.id \?\? null/);
  assert.match(image, /peekPinnedCommunityWallPhoto\(ownerId, path\)/);
  assert.match(image, /loadCachedCommunityWallPhoto\(\{ owner: ownerId, mediaPath: path, cacheKey \}\)/);
  const lookup = image.indexOf('loadCachedCommunityWallPhoto({ owner: ownerId, mediaPath: path, cacheKey })');
  const networkRequest = image.indexOf('resolveCommunityMediaUrl(path, null)');
  assert.ok(lookup > 0 && networkRequest > lookup, 'local photo lookup must precede URL signer');
  assert.match(image, /if \(!canRequestRef\.current\) \{/);
  assert.match(android, /url: local \|\| \(!path \?/);
  assert.match(cache, /const scopedKey = \(owner: string, path: string\) =>/);
  assert.match(cache, /Crypto\.CryptoDigestAlgorithm\.SHA256/);
  assert.match(cache, /ownerDirectory\(owner\)/);
  assert.match(offline, /communityFeedCacheKey\(/);
  assert.match(network, /communityMediaCacheKey\(/);
});

test('Offline input and invalid cache have bounded, recoverable behavior', () => {
  assert.match(android, /Wala pang naka-save na offline copy/);
  assert.match(android, /setRetryEpoch\(epoch => epoch \+ 1\)/);
  assert.match(android, /invalidateCachedCommunityWallPhoto\(ownerId, path\)/);
  assert.match(android, /failed: !canRequestRef\.current/);
  assert.match(android, /!actual\.painted && !actual\.fromDiskCache/);
  assert.match(android, /cachePolicy="memory-disk"/);
  assert.match(android, /fromDiskCache: true, failed: false/);
  assert.match(cache, /await FileSystem\.deleteAsync\(destination, \{ idempotent: true \}\)/);
  assert.match(cache, /const invalidCache = new Set<string>\(\)/);
});

test('Offline storage has a per-user cap, eviction, deduplication and bounded I/O', () => {
  assert.match(cache, /MAX_ACCOUNT_BYTES = 160 \* 1024 \* 1024/);
  assert.match(cache, /MAX_ACCOUNT_FILES = 240/);
  assert.match(cache, /MAX_SINGLE_PHOTO_BYTES = 20 \* 1024 \* 1024/);
  assert.match(cache, /RETAIN_MS = 45 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(cache, /MAX_ACTIVE_COPIES = 2/);
  assert.match(cache, /MAX_QUEUED_COPIES = 32/);
  assert.match(cache, /const loading = new Map<string, Promise<string \| null>>\(\)/);
  assert.match(cache, /const trimming = new Map<string, Promise<void>>\(\)/);
  assert.match(cache, /const names = \(await FileSystem\.readDirectoryAsync/);
  assert.match(cache, /const active = pinning\.get\(key\)/);
  assert.match(cache, /trimAccount\(owner\)/);
});

test('Wall visuals remain original-resolution, and photo rendering remains shared across all scopes', () => {
  assert.ok((collage.match(/useWallPreview=\{false\}/g) || []).length >= 3, 'grid, single and swipe use originals');
  assert.match(android, /source=\{\{ uri: actual\.url, cacheKey \}\}/);
  assert.match(android, /decideAndroidPhotoRecovery/);
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(publicWall, /<BuklodCommunityPhotoCollage/);
  assert.match(scopedWall, /<BuklodCommunityPhotoCollage/);
  const home = read('src/app/(tabs)/home.tsx');
  assert.match(home, /<BuklodCommunityContributionCard \/>/);
  assert.doesNotMatch(publicWall, /<BuklodCommunityContributionCard \/>/);
});
