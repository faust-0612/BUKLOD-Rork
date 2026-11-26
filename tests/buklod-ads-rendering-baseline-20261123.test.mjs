import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-only guard: do not change ad units, SDK behavior, or live creatives.
// Device fill/impressions, native compatibility and OTA proof are separate gates.
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
const banner = read('src/components/BuklodAdMobBanner.tsx');
const warm = read('src/components/BuklodDashboardAdWarmup.android.tsx');
const controller = read('src/lib/buklodGlobalAdController.ts');

test('same first-view placements and bounded Android prewarm after tab navigation', () => {
  const first = read('src/components/BuklodFirstViewAd.android.tsx');
  assert.match(first, /<BuklodCommunityInlineAd/);
  assert.match(first, /\bfirstView\b/);
  assert.match(native, /if \(firstView\) \{\s*const preload = getBuklodDashboardAdPreloadState/);
  assert.match(native, /takeBuklodDashboardAdPreload\(placementId, nativeUnitId\)/);
  assert.match(native, /if \(preload === 'loading'\)/);
  assert.match(native, /if \(preload === 'failed'\)/);
  assert.match(native, /releaseBuklodDashboardNativeAdOwned\(placementId\)/);
  for (const [file, id] of [
    ['src/app/(tabs)/hub.tsx', 'new_home_first_view'],
    ['src/app/(tabs)/buklod.tsx', 'public_wall_entry'],
    ['src/app/(tabs)/me.tsx', 'profile_first_view'],
    ['src/app/(tabs)/messages.tsx', 'connect_personal_first_view'],
  ]) {
    assert.ok(read(file).includes(id), 'Missing first view: ' + id);
    assert.ok(warm.includes(id), 'Wrong prewarm slot: ' + id);
  }
  assert.match(warm, /MAX_WARM_CREATIVES = 2/);
  assert.match(warm, /NATIVE_WARM_TTL_MS = 30 \* 60_000/);
});

test('focused viewport renders filled native creative without reloading on scroll or blur', () => {
  assert.match(native, /const hasLoadedCreative = Boolean\(nativeAd \|\| bannerLoaded\)/);
  assert.match(native, /const canShowNativeCreative\s*=\s*screenFocused &&/);
  assert.match(native, /const canPrefetchNative\s*=\s*active && screenFocused && routeSafe && sdkReady && adNetworkAvailable/);
  assert.match(native, /if \(!screenFocusRef\.current \|\| !keepNativeLifecycle/);
  assert.match(native, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(native, /if \(\(!eligible && !hasLoadedCreative\) \|\|/);
  assert.match(native, /const keepNativeLifecycle/);
  assert.match(native, /currentListVisibility/);
  assert.match(native, /createdAd\?\.destroy\(\)/);
});

test('no empty 392px feed card before a real native impression or after no-fill', () => {
  assert.match(native, /const AD_PENDING_SLOT_HEIGHT = 8/);
  assert.match(native, /const FEED_AD_CARD_HEIGHT = 392/);
  assert.match(native, /if \(!nativeFailed\) \{[\s\S]*?style=\{styles\.viewportProbe\}/);
  assert.match(native, /if \(bannerFailed\) \{[\s\S]*?style=\{styles\.viewportProbe\}/);
  assert.match(native, /if \(!bannerRequestReady\) \{[\s\S]*?style=\{styles\.viewportProbe\}/);
  assert.match(native, /pendingBannerShell: \{[\s\S]*?minHeight: AD_PENDING_SLOT_HEIGHT/);
  assert.match(native, /rectangleArea: \{[\s\S]*?height: 250/);
  assert.match(native, /<NativeMediaView/);
  assert.match(native, /<Text style=\{styles\.adBadge\}>AD<\/Text>/);
  assert.match(native, /<Text style=\{styles\.label\}>Sponsored<\/Text>/);
});

test('sequential native-to-banner fallback honors viewport and bounded no-fill retry', () => {
  assert.match(native, /if \(\s*!canAttempt \|\|\s*!currentlyVisible \|\|\s*!nativeFailed/);
  assert.match(native, /if \(!nativeRequestStarted\.current &&\s*!reserveBuklodPassiveAdRequest/);
  assert.match(native, /if \(!screenFocused \|\| !bannerFailed \|\| !adNetworkAvailable \|\| !currentlyVisible\) return/);
  assert.match(native, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(native, /getBuklodPassiveAdRequestWaitMs\(placementId, requestKey\)/);
  assert.match(banner, /getBuklodPassiveAdRequestWaitMs\(stablePlacementId, requestKey\)/);
  assert.match(banner, /const viewportReady = !requireViewport \|\| eligible \|\| loaded/);
  assert.match(banner, /const mountBanner\s*=\s*routeSafe && reservationReady &&\s*\(shouldRequest \|\| loaded\)/);
  assert.match(banner, /if \(!screenFocusRef\.current \|\| !shouldRequest \|\| reservationReady\) return/);
  assert.match(banner, /BANNER_LOAD_TIMEOUT_MS = 14_000/);
});

test('consent, focus, locks and SDK-only impression accounting remain mandatory', () => {
  assert.match(native, /const sdkReady = ready && canRequestAds/);
  assert.match(banner, /const sdkReady = ready && canRequestAds/);
  assert.match(controller, /enabled\('ads_all'\)/);
  assert.match(controller, /enabled\('ads_placements'\)/);
  assert.match(controller, /!hasInteractionLock\(\)/);
  assert.match(warm, /isBuklodAdRouteSensitive\(source\)/);
  assert.match(warm, /reserveBuklodPassiveAdRequest/);
  assert.match(banner, /const shouldRequest\s*=\s*screenFocused && routeSafe/);
  assert.match(read('src/app/(tabs)/_layout.tsx'), /freezeOnBlur: true/);
  assert.doesNotMatch(warm, /<NativeAdView|<BannerAd|['"]ad_impression['"]|['"]ad_rendered['"]/);
  assert.match(native, /NativeAdEventType\.IMPRESSION/);
  assert.match(native, /onAdImpression=\{\(\) => \{/);
  assert.match(banner, /onAdImpression: \(\) =>/);
  assert.match(read('src/lib/buklodAds.ts'), /AdEventType\.OPENED/);
  assert.doesNotMatch(read('src/lib/buklodAds.ts'), /['"]ad_impression['"]/);
  assert.doesNotMatch(native, /fakeImpression|syntheticImpression/);
});

test('PR, Genesis source QA, RC and production OTA all transitively run this guard', () => {
  const importLine = "import './buklod-ads-rendering-baseline-20261123.test.mjs';";
  assert.ok(read('tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs').includes(importLine));
  assert.ok(read('tests/ad-dashboard-focus-performance-20261116.test.mjs').includes(importLine));
  assert.match(read('.github/workflows/engineering-accountability.yml'), /node --test tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
  assert.match(read('.github/workflows/production_android_ota.yml'), /node --test tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
  assert.match(read('.github/workflows/genesis-all-updates-conso-qa-20261122.yml'), /tests\/ad-dashboard-focus-performance-20261116\.test\.mjs/);
  assert.match(read('.github/workflows/unified_rc_compiled_qa_20261108.yml'), /node --test tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
});
