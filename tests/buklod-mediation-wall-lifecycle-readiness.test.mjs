import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const inline = read('src/components/BuklodCommunityInlineAd.android.tsx');

test('re-entry cannot reuse a destroyed SDK NativeAd after eligibility is lost', () => {
  const reset = inline.split('// Reset stale SDK handles when eligibility is revoked.')[1]
    ?.split('useEffect(() => {\n    if (!canAttempt || nativeRequestStarted.current')[0];
  assert.ok(reset, 'the re-entry reset must be before the NativeAd request effect');
  assert.match(reset, /if \(canAttempt\) return;/);
  assert.match(reset, /nativeRequestStarted\.current = false;/);
  assert.match(reset, /setNativeAd\(null\);/);
  assert.match(reset, /\}, \[canAttempt\]\);/);
  assert.match(inline, /createdAd\?\.destroy\(\);/);
  assert.match(inline, /if \(cancelled \|\| timedOut\)/);
});

test('re-entry resets stale banner request and loaded state under shared cooldown', () => {
  const reset = inline.split('// Reset stale SDK handles when eligibility is revoked.')[1]
    ?.split('useEffect(() => {\n    if (!canAttempt || nativeRequestStarted.current')[0];
  assert.ok(reset);
  assert.match(reset, /bannerRequestStarted\.current = false;/);
  assert.match(reset, /setBannerLoaded\(false\);/);
  assert.match(reset, /setBannerFailed\(false\);/);
  assert.match(inline, /getBuklodPassiveAdRequestWaitMs\(/);
  assert.match(inline, /reserveBuklodPassiveAdRequest\(/);
});

test('wall sponsored inventory, attribution, policy gates, and fallback remain unchanged', () => {
  assert.match(inline, /NativeAdEventType\.IMPRESSION/);
  assert.match(inline, /<NativeMediaView/);
  assert.match(inline, /'ad_impression'/);
  assert.match(inline, /isBuklodPassiveAdAllowed\(/);
  assert.match(inline, /if \(!active \|\| !routeSafe\) return null/);
  assert.match(inline, /!nativeUnitId && styles\.bannerOnlyFrame/);
  assert.match(inline, /if \(!errorCode\.includes\('no-fill'\)\)/);
  const wallPolicy = read('src/lib/buklodAdMonetizationPolicy.android.ts');
  assert.match(wallPolicy, /EXPO_PUBLIC_ADS_WALL_CONTENT_INTERVAL/);
  const appConfig = read('app.config.js');
  assert.match(appConfig, /'react-native-google-mobile-ads'/);
});
