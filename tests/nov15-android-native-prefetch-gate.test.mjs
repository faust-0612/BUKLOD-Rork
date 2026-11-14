import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Android, not only generic component, requests one near-future native creative', () => {
  const android = read('src/components/BuklodCommunityInlineAd.android.tsx');
  const connector = read('src/components/BuklodNativeSponsoredCard.android.tsx');
  for (const expected of [
    'prefetch?: boolean',
    'prefetch = false',
    'const canPrefetchNative',
    'eligible || prefetch || nativeRequestStarted.current',
    'const canStartNativeRef = useRef(canPrefetchNative)',
    'canAttempt || canPrefetchNative',
    'NativeAd.createForAdRequest',
    'reserveBuklodPassiveAdRequest(placementId, requestKey)',
    'getBuklodAdSafetyRevision',
    'createdAd?.destroy()',
  ]) assert.ok(android.includes(expected), expected);
  assert.ok(connector.includes('prefetch={prefetch}'));
});

test('Android prefetch never displays NativeAdView or records rendered before visibility', () => {
  const android = read('src/components/BuklodCommunityInlineAd.android.tsx');
  const guardedRender = android.indexOf('if (nativeAd && !nativeFailed && canShowNativeCreative)');
  const mountedView = android.indexOf('<NativeAdView nativeAd=', guardedRender);
  assert.ok(guardedRender >= 0 && mountedView > guardedRender);
  assert.ok(android.includes('if (!nativeAd || nativeRendered.current || !canShowNativeCreative) return;'));
  // The fast path uses the actual FlatList viewability callback, not a
  // hardcoded timer or invisible placeholder. The first-view gate stays intact.
  assert.ok(android.includes("surface === 'wall' && !firstView && Boolean(slotId) && currentListVisibility"));
  assert.ok(android.includes('firstView || (eligible || prefetch || nativeRequestStarted.current)'));
  assert.ok(android.includes('if ((!eligible && !hasLoadedCreative) ||'));
  assert.ok(android.includes('!canAttempt ||'));
  assert.ok(android.includes('const { ref, eligible } = useBuklodAdViewportGate()'));
});

test('QA scope and workflow explicitly cover Android-specific prewarm', () => {
  const manifest = JSON.parse(read('.buklod/scopes/nov15-conso-prod-video-ads.json'));
  assert.ok(manifest.allowedPaths.includes('src/components/BuklodCommunityInlineAd.android.tsx'));
  assert.ok(manifest.regressionTests.includes('tests/nov15-android-native-prefetch-gate.test.mjs'));
  assert.ok(read('.github/workflows/engineering-accountability.yml').includes('tests/nov15-android-native-prefetch-gate.test.mjs'));
});
