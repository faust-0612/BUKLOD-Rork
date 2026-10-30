const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const native = fs.readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
const generic = fs.readFileSync('src/components/BuklodCachedMediaImage.tsx','utf8');
const collage = fs.readFileSync('src/components/BuklodCommunityPhotoCollage.tsx','utf8');
const release = fs.readFileSync('.github/workflows/production_android_ota.yml','utf8');

test('Android-specific module bypasses October 28 full-screen photo masking wrapper',()=>{
  assert.match(native,/export const BuklodCachedMediaImage = memo\(AndroidWallPhoto/);
  // The progressive overlay is a sibling inside the existing measured
  // Pressable; never recreate the white-screen nested wrapper.
  assert.match(native,/const renderWithUpgrade = \(preview: React\.ReactNode\) => \(/);
  assert.match(native,/<ExpoImage[\s\S]*?style=\{style\}/);
  assert.match(native,/<NativeImage[\s\S]*?style=\{style\}/);
  assert.doesNotMatch(native,/<View style=\{style as any\}|const photoStyle =|loadingOverlay|loadingBadge|recyclingKey=\{cacheKey\}/);
  // Web and iOS keep their existing generic implementation.
  assert.match(generic,/styles\.loadingOverlay/);
});

test('Android decode cannot prematurely suppress fallback without onDisplay',()=>{
  assert.match(native,/decideAndroidPhotoRecovery/);
  const policy = fs.readFileSync('src/lib/buklodAndroidPhotoRecovery.ts','utf8');
  assert.match(policy,/export const ANDROID_PHOTO_DECODE_STALL_MS = 8_000/);
  assert.match(native,/current\.renderer === 'expo' && !current\.painted/);
  assert.match(native,/renderer: 'native'/);
  const expo = native.slice(native.lastIndexOf('  return renderWithUpgrade(\n    <ExpoImage'));
  const onLoad = expo.split('onLoad={event => {')[1]?.split('onDisplay=')[0] ?? '';
  assert.doesNotMatch(onLoad,/painted: true/);
  assert.match(expo,/onDisplay=\{\(\) => \{[\s\S]*?painted: true/);
  assert.match(native,/source=\{\{ uri: actual\.url \}\}/);
});

test('Signed-media authorization and retry remain bounded',()=>{
  assert.match(native,/peekCommunityMediaUrl\(path, preferred\)/);
  assert.match(native,/resolveCommunityMediaUrl\(path, null\)/);
  assert.match(native,/resignCommunityMediaUrl\(path\)/);
  assert.match(native,/signRetryRef\.current >= 1/);
  assert.match(native,/cachePolicy="memory-disk"/);
  assert.match(native,/event\.stopPropagation\(\)/);
  assert.doesNotMatch(native,/getPublicUrl|\/object\/public\//);
});

test('Photo-collage layout and per-photo taps remain on canonical shared component',()=>{
  assert.match(collage,/const visible = photos\.slice\(0, 4\)/);
  assert.match(collage,/onPressPhoto\?\.\(index, photos\)/);
  assert.match(collage,/preserveSinglePhotoAspectRatio/);
  assert.match(native,/onLoad\?\.\(\{ source: event\.nativeEvent\.source \}\)/);
});

test('Android-specific file is included in the canonical production OTA trigger',()=>{
  assert.match(release,/^\s+- 'src\/components\/BuklodCachedMediaImage\.android\.tsx'$/m);
});