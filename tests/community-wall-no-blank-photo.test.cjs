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
  assert.match(image, /!loaded \? \(/);
  assert.match(image, /pointerEvents="none" style=\{styles\.loadingBadge\}/);
  assert.match(image, /Platform.OS === 'android' \? \(/);
  assert.match(image, /loadingOverlay/);
  assert.match(image, /Mahina ang signal/);
  assert.match(image, /onLoadStart=\{\(\) => \{/);
  assert.match(image, /onLoad=\{event => \{/);
  assert.match(image, /onDisplay=\{\(\) => \{/);
  assert.match(image, /setLoaded\(true\);/);
  assert.match(image, /cachePolicy="memory-disk"/);
  assert.match(image, /readFromCacheAsync/);
  assert.match(image, /if \(local\) \{/);
  assert.match(image, /setCachedImage\(local\)/);
  assert.match(image, /A cached ImageRef is already decoded/);
  assert.match(image, /setLoaded\(true\)/);
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
  assert.match(image, /loadingBadge/);
});

test('Wall photo renderer changes are eligible for the canonical Android Production OTA', () => {
  const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
  assert.match(workflow, /^\s+- 'src\/components\/BuklodCachedMediaImage\.tsx'$/m);
});

const androidImage = fs.readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');

test('Android Wall uses a direct sized image component, not the masked web renderer', () => {
  assert.match(androidImage, /function AndroidWallPhoto\(/);
  assert.match(androidImage, /<ExpoImage[\s\S]*?style=\{style\}/);
  assert.match(androidImage, /<NativeImage[\s\S]*?style=\{style\}/);
  assert.doesNotMatch(androidImage, /loadingOverlay|StyleSheet\.absoluteFillObject|readFromCacheAsync/);
  assert.match(androidImage, /cachePolicy="memory-disk"/);
  assert.match(androidImage, /communityMediaCacheKey\(path, path \? path : preferred\)/);
  assert.match(androidImage, /peekCommunityMediaUrl\(path, preferred\)/);
  assert.match(androidImage, /resolveCommunityMediaUrl\(path, null\)/);
  assert.match(androidImage, /resignCommunityMediaUrl\(path\)/);
  assert.doesNotMatch(androidImage, /getPublicUrl|\/object\/public\//);
});

test('Android stalled native decoding falls back once to independent Fresco without re-signing', () => {
  assert.match(androidImage, /const NATIVE_FALLBACK_MS = 8_000/);
  assert.match(androidImage, /renderer: 'native'/);
  assert.match(androidImage, /<NativeImage/);
  assert.match(androidImage, /source=\{\{ uri: actual\.url \}\}/);
  assert.match(androidImage, /onLoad\?\.\(\{ source: event\.nativeEvent\.source \}\)/);
  assert.match(androidImage, /signRetryRef\.current >= 1/);
  assert.match(androidImage, /current\.identity === identity/);
});

test('Android-specific renderer is included in canonical OTA source-path trigger', () => {
  const release = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
  assert.match(release, /^\s+- 'src\/components\/BuklodCachedMediaImage\.android\.tsx'$/m);
});
