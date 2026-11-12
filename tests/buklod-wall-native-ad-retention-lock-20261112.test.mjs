import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(path, 'utf8');
const controllerSource = read('src/lib/buklodGlobalAdController.ts');
const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const video = read('src/components/CommunityVideo.tsx');

function policy() {
  const noImports = controllerSource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
  const runnable = stripTypeScriptTypes(noImports, { mode: 'strip' })
    .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');
  const factory = runnable +
    '\n({setBuklodAdRoute,setBuklodAdForeground,setBuklodAdRemoteFeatures,acquireBuklodAdSafetyLock,isBuklodPassiveAdAllowed,canRetainBuklodLoadedNativeCreative})';
  return vm.runInNewContext(factory, {
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    Platform: { OS: 'android' },
    INTERSTITIAL_MIN_EVENT_COUNT: 2,
    AD_SLOT_REMOUNT_COOLDOWN_MS: 120000,
    Math, Date, String, Number, Object, Promise,
  });
}

test('native creative survives only a temporary interaction lock, while display stays forbidden', () => {
  const c = policy();
  const args = { placementId: 'public_wall_entry', placement: 'community_entry' };
  c.setBuklodAdRoute('/buklod');
  assert.equal(c.isBuklodPassiveAdAllowed(args), true);
  const release = c.acquireBuklodAdSafetyLock('typing');
  assert.equal(c.isBuklodPassiveAdAllowed(args), false, 'must not display while typing');
  assert.equal(c.canRetainBuklodLoadedNativeCreative(args), true,
    'valid existing NativeAd may remain reserved while its view is hidden');
  release();
  assert.equal(c.isBuklodPassiveAdAllowed(args), true);
});

test('native retention cannot bypass kill switch, sensitive route or background', () => {
  const c = policy();
  const args = { placementId: 'public_wall_feed', placement: 'community' };
  c.setBuklodAdRoute('/buklod');
  const release = c.acquireBuklodAdSafetyLock('form');
  assert.equal(c.canRetainBuklodLoadedNativeCreative(args), true);
  c.setBuklodAdRemoteFeatures({ ads_all: false });
  assert.equal(c.canRetainBuklodLoadedNativeCreative(args), false);
  c.setBuklodAdRemoteFeatures({});
  c.setBuklodAdRoute('/login');
  assert.equal(c.canRetainBuklodLoadedNativeCreative(args), false);
  c.setBuklodAdRoute('/buklod');
  c.setBuklodAdForeground(false);
  assert.equal(c.canRetainBuklodLoadedNativeCreative(args), false);
  release();
});

test('loaded native survives transient lock but is never requested or rendered while blocked', () => {
  assert.match(native, /const keepNativeLifecycle =/);
  assert.match(native, /nativeRequestStarted\.current && !nativeFailed/);
  assert.match(native, /if \(keepNativeLifecycle\) return/);
  assert.match(native, /if \(!keepNativeLifecycle \|\| !canStartNativeRef\.current/);
  assert.match(native, /if \(!active \|\| !routeSafe\) return null/);
  assert.match(native, /NativeAdEventType\.IMPRESSION/);
  assert.match(native, /reserveBuklodPassiveAdRequest\(placementId, requestKey\)/);
  assert.match(native, /NativeMediaView/);
  assert.match(native, /FEED_AD_CARD_HEIGHT = 392/);
  assert.match(native, /BannerAdSize\.MEDIUM_RECTANGLE/);
  assert.match(wall, /BuklodCommunitySponsoredAd/);
  assert.match(wall, /BuklodVideoCompanionAd/);
  assert.match(video, /BuklodImaVideo/);
});
