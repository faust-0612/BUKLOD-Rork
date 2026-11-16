import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('one Android-only dashboard warmup, max two with TTL and consent/route gates', () => {
  const shell = read('src/app/(tabs)/_layout.tsx');
  const warm = read('src/components/BuklodDashboardAdWarmup.android.tsx');
  assert.match(shell, /<BuklodDashboardAdWarmup \/>/);
  for (const token of [
    'MAX_WARM_CREATIVES = 2', 'NATIVE_WARM_TTL_MS = 30 * 60_000',
    'isBuklodAdRouteSensitive(source)', 'isBuklodPassiveAdAllowed',
    'reserveBuklodPassiveAdRequest', 'NativeAd.createForAdRequest',
    'canRequestAds', 'isInternetReachable', 'safetyRevision',
  ]) assert.ok(warm.includes(token), token);
  assert.doesNotMatch(warm, /<NativeAdView|<BannerAd|['"]ad_impression['"]|['"]ad_rendered['"]/);
  assert.match(read('src/components/BuklodDashboardAdWarmup.tsx'), /return null/);
});
test('first-view only consumes loaded native creative after focused viewport gate', () => {
  const src = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(src, /if \(firstView\) \{\s*const preload = getBuklodDashboardAdPreloadState/);
  assert.match(src, /if \(preload === 'loading'\)/);
  assert.match(src, /if \(preload === 'failed'\) \{\s*nativeRequestStarted\.current = true/);
  assert.match(src, /takeBuklodDashboardAdPreload\(placementId, nativeUnitId\)/);
  assert.match(src, /releaseBuklodDashboardNativeAdOwned\(placementId\)/);
  assert.match(src, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(src, /NativeAdEventType\.IMPRESSION/);
});
test('prewarm IDs match live Home, Wall, Profile, and Connect first-view placements', () => {
  const warm = read('src/components/BuklodDashboardAdWarmup.android.tsx');
  for (const [path, id] of [
    ['src/app/(tabs)/hub.tsx','new_home_first_view'],
    ['src/app/(tabs)/buklod.tsx','public_wall_entry'],
    ['src/app/(tabs)/me.tsx','profile_first_view'],
    ['src/app/(tabs)/messages.tsx','connect_personal_first_view'],
  ]) { assert.ok(read(path).includes(id)); assert.ok(warm.includes(id)); }
});

test('navigation and authentication redirects remain before any ad prewarm', () => {
  const shell = read('src/app/(tabs)/_layout.tsx');
  const gate = shell.indexOf('if (!session)');
  const onboarding = shell.indexOf('if (!profile)');
  const ad = shell.indexOf('<BuklodDashboardAdWarmup />');
  assert.ok(gate >= 0 && onboarding > gate && ad > onboarding);
  assert.match(shell, /freezeOnBlur: true/);
});
