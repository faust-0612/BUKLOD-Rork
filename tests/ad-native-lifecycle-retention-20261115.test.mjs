import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/BuklodCommunityInlineAd.android.tsx', import.meta.url), 'utf8');

test('loaded native ad survives safe pathname changes without SDK teardown', () => {
  const effect = source.match(/void NativeAd\.createForAdRequest\([\s\S]*?\n  \}, \[([\s\S]*?)\n  \]\);/);
  assert.ok(effect, 'native SDK lifecycle effect must exist');
  assert.doesNotMatch(effect[1], /^\s*pathname\s*,?\s*$/m, 'pathname must not restart the SDK request');
  assert.match(effect[0], /createdAd\?\.destroy\(\)/, 'teardown still destroys SDK ad on genuine lifecycle end');
  assert.match(source, /const keepNativeLifecycle\s*=/);
  assert.match(source, /const routeSafe\s*=\s*isBuklodPassiveAdAllowed/);
  assert.match(source, /const mayRetainNative\s*=\s*canRetainBuklodLoadedNativeCreative/);
});

test('prefetch cannot mount an offscreen native view', () => {
  assert.match(source, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(source, /const canPrefetchNative\s*=/);
  assert.match(source, /sdkReady && adNetworkAvailable/);
});
