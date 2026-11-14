import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Android NativeAd implementation, not just generic fallback, prefetches one upcoming slot', () => {
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  const connector = read('src/components/BuklodNativeSponsoredCard.android.tsx');
  assert.match(native, /prefetch\\?: boolean/);
  assert.match(native, /prefetch = false/);
  assert.match(native, /const canPrefetchNative/);
  assert.match(native, /eligible \\|\\| prefetch \\|\\| nativeRequestStarted\\.current/);
  assert.match(native, /const canStartNativeRef = useRef\\(canPrefetchNative\\)/);
  assert.match(native, /canAttempt \\|\\| canPrefetchNative/);
  assert.match(connector, /prefetch=\\{prefetch\\}/);
});
test('A prefetched Android NativeAd cannot render or count a view before viewport eligibility', () => {
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /if \\(!nativeAd \\|\\| nativeRendered\\.current \\|\\| !eligible\\) return/);
  assert.match(native, /if \\(nativeAd && !nativeFailed && eligible\\)/);
  assert.match(native, /reserveBuklodPassiveAdRequest\\(placementId, requestKey\\)/);
  assert.match(native, /createdAd\\?\\.destroy\\(\\)/);
  assert.match(native, /if \\(!canAttempt \\|\\|/);
  assert.match(native, /getBuklodAdSafetyRevision/);
  assert.doesNotMatch(native, /BannerAd[\\s\\S]{0,100}prefetch/);
});
test('The prefetch contract is included in the branch QA gate and allowed path inventory', () => {
  const manifest = JSON.parse(read('.buklod/scopes/nov14-video-scroll-pause-ad-prewarm.json'));
  assert.ok(manifest.allowedPaths.includes('src/components/BuklodCommunityInlineAd.android.tsx'));
  assert.ok(manifest.regressionTests.includes('tests/nov15-android-native-prefetch-gate.test.mjs'));
  assert.match(read('.github/workflows/engineering-accountability.yml'), /nov15-android-native-prefetch-gate\\.test\\.mjs/);
});
