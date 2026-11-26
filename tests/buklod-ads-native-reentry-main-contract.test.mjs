import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/BuklodCommunityInlineAd.android.tsx', 'utf8');
const resetStart = source.indexOf('useEffect(() => {\n    if (keepNativeLifecycle) return;');
const requestStart = source.indexOf('if (!screenFocusRef.current || !keepNativeLifecycle || !canStartNativeRef.current ||');
const reset = resetStart >= 0 && requestStart > resetStart
  ? source.slice(resetStart, requestStart) : null;

test('Loaded NativeAd is preserved through scrolling but reset on genuine route/permission loss', () => {
  assert.match(source, /const hasLoadedCreative = Boolean\(nativeAd \|\| bannerLoaded\)/);
  assert.match(source, /\(eligible \|\| hasLoadedCreative\)/);
  assert.match(source, /!sdkReady \|\| \(!adNetworkAvailable && !hasLoadedCreative\)/);
  assert.ok(reset, 'reset effect must precede SDK request effect');
  assert.match(reset, /if \(keepNativeLifecycle\) return;/);
  for (const fragment of [
    'nativeRequestStarted.current = false;',
    'bannerRequestStarted.current = false;',
    'nativeRendered.current = false;',
    'bannerRendered.current = false;',
    'setNativeAd(null);',
    'setBannerLoaded(false);',
    'setBannerFailed(false);',
    'setBannerRequestReady(false);',
    '}, [keepNativeLifecycle]);',
  ]) assert.ok(reset.includes(fragment), fragment);
  assert.match(source, /createdAd\?\.destroy\(\);/);
  assert.match(source, /if \(cancelled \|\| timedOut\)/);
});

test('fallback BannerAd requires the existing shared reservation', () => {
  assert.match(source, /reserveBuklodPassiveAdRequest\(placementId, requestKey\)/);
  assert.match(source, /getBuklodPassiveAdRequestWaitMs\(placementId, requestKey\)/);
  const start = source.indexOf('if (!nativeRequestStarted.current &&');
  const reserve = source.indexOf('reserveBuklodPassiveAdRequest(placementId, requestKey)', start);
  const ready = source.indexOf('setBannerRequestReady(true);', start);
  const guard = source.indexOf('if (!bannerUnitId) return null;');
  const failedGuard = source.indexOf('if (bannerFailed) {', guard);
  const readyGuard = source.indexOf('if (!bannerRequestReady) {', failedGuard);
  const bannerMount = source.indexOf('<BannerAd', readyGuard);
  assert.ok(guard >= 0 && failedGuard > guard && readyGuard > failedGuard && bannerMount > readyGuard);
  assert.ok(start >= 0 && start < reserve && reserve < ready && ready < guard);
  assert.match(source, /const \[bannerRequestReady, setBannerRequestReady\] = useState\(false\)/);
});

test('existing privacy, creative and terminal no-fill collapse remain authoritative', () => {
  assert.match(source, /isBuklodPassiveAdAllowed\(/);
  assert.match(source, /NativeAdEventType\.IMPRESSION/);
  assert.match(source, /<NativeMediaView/);
  assert.match(source, /if \(!active \|\| !routeSafe\) return null/);
  assert.match(source, /Collapse every terminal fallback failure, including no-fill/);
  assert.match(source, /bannerFailedAt\.current = Date\.now\(\)/);
  assert.match(source, /setBannerFailed\(true\)/);
});
