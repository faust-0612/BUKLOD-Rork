import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/BuklodCommunityInlineAd.android.tsx', 'utf8');
const reset = source.split('// Eligibility transitions destroy the NativeAd instance')[1]
  ?.split('useEffect(() => {\n    if (!canAttempt || nativeRequestStarted.current')[0];

test('NativeAd and banner states are reset when eligibility is lost', () => {
  assert.ok(reset, 'reset effect must precede SDK request effect');
  assert.match(reset, /if \(canAttempt\) return;/);
  for (const fragment of [
    'nativeRequestStarted.current = false;',
    'bannerRequestStarted.current = false;',
    'nativeRendered.current = false;',
    'bannerRendered.current = false;',
    'setNativeAd(null);',
    'setBannerLoaded(false);',
    'setBannerFailed(false);',
    'setBannerRequestReady(false);',
    '}, [canAttempt]);',
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
  const guard = source.indexOf('if (!nativeFailed || !bannerUnitId || bannerFailed || !bannerRequestReady)');
  assert.ok(start >= 0 && start < reserve && reserve < ready && ready < guard);
  assert.match(source, /const \[bannerRequestReady, setBannerRequestReady\] = useState\(false\)/);
});

test('existing privacy, creative and no-fill handling are unchanged', () => {
  assert.match(source, /isBuklodPassiveAdAllowed\(/);
  assert.match(source, /NativeAdEventType\.IMPRESSION/);
  assert.match(source, /<NativeMediaView/);
  assert.match(source, /if \(!active \|\| !routeSafe\) return null/);
  assert.match(source, /if \(!errorCode\.includes\('no-fill'\)\)/);
});
