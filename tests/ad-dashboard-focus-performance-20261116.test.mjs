import './buklod-ads-rendering-baseline-20261123.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
const banner = read('src/components/BuklodAdMobBanner.tsx');
const header = read('src/components/BuklodHeaderSponsor.tsx');

test('Android NativeAd only requests or presents on the focused dashboard', () => {
  assert.match(native, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*?screenFocusRef\.current = true;[\s\S]*?screenFocusRef\.current = false;/);
  assert.match(native, /const canAttempt\s*=\s*active &&\s*screenFocused &&\s*routeSafe/);
  assert.match(native, /const canPrefetchNative\s*=\s*active && screenFocused && routeSafe/);
  assert.match(native, /const canShowNativeCreative\s*=\s*screenFocused &&/);
  assert.match(native, /if \(!screenFocusRef\.current \|\| !keepNativeLifecycle/);
  // Preserve the previous no-native-view prefetch contract, 2-minute cooldown,
  // measured visibility, and real SDK impression callbacks.
  for (const token of [
    'NativeAd.createForAdRequest', 'reserveBuklodPassiveAdRequest(placementId, requestKey)',
    'NativeAdEventType.IMPRESSION', 'createdAd?.destroy()', 'currentListVisibility',
    'const keepNativeLifecycle', 'AD_SLOT_REMOUNT_COOLDOWN_MS',
  ]) assert.ok(native.includes(token), token);
});

test('Banner requests pause on blur without discarding already filled creatives', () => {
  assert.match(banner, /const shouldRequest\s*=\s*screenFocused && routeSafe/);
  assert.match(banner, /if \(!screenFocusRef\.current \|\| !shouldRequest \|\| reservationReady\) return/);
  assert.match(banner, /if \(screenFocused \|\| loaded \|\| !reservationReady\) return/);
  assert.match(banner, /const mountBanner\s*=\s*routeSafe && reservationReady &&\s*\(shouldRequest \|\| loaded\)/);
  assert.match(banner, /if \(!screenFocused \|\| !failed \|\| !adNetworkAvailable\) return/);
  assert.match(banner, /if \(!screenFocused \|\| !failed\) return/);
  assert.match(banner, /getBuklodPassiveAdRequestWaitMs\(stablePlacementId, requestKey\)/);
});

test('Healthy native/banner slots do not attach redundant resume listeners', () => {
  assert.match(native, /if \(!screenFocused \|\| !bannerFailed\) return;\s*const sub = AppState\.addEventListener/);
  assert.match(banner, /if \(!screenFocused \|\| !failed\) return;\s*const sub = AppState\.addEventListener/);
  assert.match(header, /key=\{\`header:\$\{placement\}\`\}/);
});

test('Legacy app and Android render contracts remain in place', () => {
  const stack = read('src/app/(tabs)/_layout.tsx');
  assert.match(stack, /freezeOnBlur: true/);
  assert.match(native, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(banner, /onAdImpression:/);
  assert.doesNotMatch(native, /fakeImpression|syntheticImpression/);
});
