const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const image = fs.readFileSync('src/components/BuklodCachedMediaImage.tsx', 'utf8');
const signer = fs.readFileSync('src/lib/buklodMediaUrl.ts', 'utf8');
const collage = fs.readFileSync('src/components/BuklodCommunityPhotoCollage.tsx', 'utf8');

test('Wall media never uses an unverified, potentially expired feed signed URL', () => {
  assert.match(signer, /Feed\/disk URLs have no trusted mint time/);
  assert.match(signer, /if \(preferred && isUsableDirectMediaUri\(preferred\)\)/);
  assert.match(image, /peekCommunityMediaUrl\(path, preferredUri\) \|\|\s*\(!path \? preferredUri \|\| null : null\)/);
  assert.doesNotMatch(image, /peekCommunityMediaUrl\(path, preferredUri\) \|\|\s*preferredUri/);
});

test('A new no-path photo resets recycled image identity, without flashing same-path signed URL refresh', () => {
  assert.match(image, /const mediaIdentity = path \|\| `url:\$\{preferredUri\}`/);
  assert.match(image, /mediaIdentity !== lockedMediaIdentityRef\.current/);
  assert.match(image, /if \(preferredUri && !displayUri && !failed\)/);
});

test('Unsuccessful and rejected sign requests always leave an actionable failure state', () => {
  assert.match(image, /resolveCommunityMediaUrl\(path, null\)/);
  assert.match(image, /let resolved = await resolveCommunityMediaUrl\(path, null\)\.catch\(\(\) => null\)/);
  assert.match(image, /await resolveCommunityMediaUrl\(path, null\)\.catch\(\(\) => null\)/);
  assert.match(image, /if \(resolved\)/);
  assert.match(image, /setFailed\(true\)/);
  assert.match(image, /\.catch\(\(\) => \{/);
  assert.match(image, /I-tap para subukan muli/);
  assert.match(image, /onPress=\{event => \{\s*\/\/[^\n]*\n[^\n]*\n\s*event\.stopPropagation\(\)/);
  assert.match(image, /resignCommunityMediaUrl\(path\)/);
  assert.match(signer, /const NEGATIVE_CACHE_TTL_MS = 45 \* 1000/);
});

test('Slow decode and stalled network render visible feedback then bounded manual recovery', () => {
  assert.match(image, /const PHOTO_LOAD_TIMEOUT_MS = 20_000/);
  assert.match(image, /setTimeout\(\(\) => setSlow\(true\), PHOTO_LOAD_TIMEOUT_MS\)/);
  assert.doesNotMatch(image, /setTimeout\(\(\) => setFailed\(true\), PHOTO_LOAD_TIMEOUT_MS\)/);
  assert.match(image, /!loaded \? \(/);
  assert.match(image, /pointerEvents="none" style=\{styles\.loadingOverlay\}/);
  assert.match(image, /onLoadStart=\{\(\) => setSlow\(false\)\}/);
  assert.match(image, /onLoad=\{event => \{/);
  assert.match(image, /onDisplay=\{\(\) => \{/);
  assert.match(image, /setLoaded\(true\);/);
  assert.match(image, /Mahina ang signal\. Patuloy na nilo-load ang larawan\./);
  assert.match(image, /cachePolicy="memory-disk"/);
  assert.match(image, /readFromCacheAsync/);
  assert.match(image, /if \(local\) \{/);
  assert.match(image, /setCachedImage\(local\)/);
  assert.match(image, /await new Promise\(resolve => setTimeout\(resolve, 5_500\)\)/);
});

test('One image error cannot create simultaneous URL re-signing floods', () => {
  assert.match(image, /if \(resignInFlightRef\.current\) return/);
  assert.match(image, /resignInFlightRef\.current = true/);
  assert.match(image, /resignAttemptRef\.current >= 2/);
  assert.match(image, /finally \{/);
  assert.match(image, /manualRetryInFlightRef\.current/);
});

test('Wall collage still preserves each photo, layout and tap handlers', () => {
  assert.match(collage, /const photos = communityPhotoCollageItems\(items\)/);
  assert.match(collage, /const visible = photos\.slice\(0, 4\)/);
  assert.match(collage, /onPressPhoto\?\.\(index, photos\)/);
  assert.match(collage, /onLongPressPhoto\?\.\(index, photos\)/);
  assert.match(collage, /preserveSinglePhotoAspectRatio/);
});


test('Native photos recover a truly stalled request once, while byte progress extends the window', () => {
  assert.match(image, /PHOTO_STALL_NO_PROGRESS_MS = 40_000/);
  assert.match(image, /Date\.now\(\) - lastImageProgressAtRef\.current/);
  assert.match(image, /view\.reloadAsync\(\)/);
  assert.match(image, /stalledReloadAttemptRef\.current >= 1/);
  assert.match(image, /setFailed\(true\); \/\/ Actionable retry/);
  assert.match(image, /onProgress=\{event => \{/);
  assert.match(image, /bytes > lastLoadedBytesRef\.current/);
  assert.match(image, /source=\{imageSource\}/);
  assert.match(image, /useMemo\(/);
  assert.doesNotMatch(image, /setCachedImage\(local\);\s*setLoaded\(true\)/);
  assert.doesNotMatch(image, /setTimeout\(\(\) => setFailed\(true\), PHOTO_LOAD_TIMEOUT_MS\)/);
});
