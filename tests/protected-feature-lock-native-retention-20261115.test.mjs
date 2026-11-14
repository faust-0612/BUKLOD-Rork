import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/engineering-accountability.yml', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/components/BuklodCommunityInlineAd.android.tsx', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../.buklod/scopes/nov15-conso-staging-video-ads.json', import.meta.url), 'utf8'));

test('protected feature lock is mandatory for the native ad lifecycle branch', () => {
  assert.match(workflow, /node scripts\/protected-feature-lock\.mjs/);
  assert.match(workflow, /node --test tests\/protected-feature-lock\.test\.mjs/);
  assert.match(workflow, /fix\/ad-native-lifecycle-retention-20261115\)/);
  assert.match(workflow, /BUKLOD_SCOPE_MANIFEST=\.buklod\/scopes\/nov15-conso-staging-video-ads\.json/);
  assert.equal(manifest.contractVersion, 2);
  for (const id of ['app-runtime', 'ads-finance-points', 'governance-lock']) {
    assert.ok(manifest.lockedFeatureChanges.some(item => item.id === id), `missing lock declaration: ${id}`);
  }
});

test('ad retention never changes consent or offscreen impression guard', () => {
  assert.match(source, /const sdkReady = ready && canRequestAds/);
  assert.match(source, /const routeSafe = isBuklodPassiveAdAllowed/);
  assert.match(source, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(source, /NativeAdEventType\.IMPRESSION/);
});
