import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(path, 'utf8');
const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
const banner = read('src/components/BuklodAdMobBanner.tsx');
const bridge = read('src/components/BuklodAdSafetyRouteBridge.tsx');
const interstitial = read('src/lib/buklodAds.ts');
const controllerSource = read('src/lib/buklodGlobalAdController.ts');
const release = read('.github/workflows/production_android_ota.yml');

function controller() {
  const noImports = controllerSource.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
  const runnable = stripTypeScriptTypes(noImports, { mode: 'strip' })
    .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');
  const factory = runnable +
    '\n({setBuklodAdRoute,setBuklodAdRemoteFeatures,isBuklodPassiveAdAllowed,canWarmBuklodFullScreenAd,acquireBuklodAdSafetyLock})';
  return vm.runInNewContext(factory, {
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    Platform: { OS: 'android' },
    INTERSTITIAL_MIN_EVENT_COUNT: 2,
    AD_SLOT_REMOUNT_COOLDOWN_MS: 120000,
    Math, Date, String, Number, Object, Promise,
  });
}

test('Existing loaded native/large creative survives mounted scrolling and weak transport without duplicate native requests', () => {
  assert.ok(native.includes('const hasLoadedCreative = Boolean(nativeAd || bannerLoaded)'));
  assert.ok(native.includes('(eligible || hasLoadedCreative)'));
  assert.ok(native.includes('(adNetworkAvailable || hasLoadedCreative)'));
  assert.ok(native.includes("if ((!eligible && !hasLoadedCreative) ||"));
  assert.ok(native.includes('!sdkReady || (!adNetworkAvailable && !hasLoadedCreative)'));
  assert.ok(native.includes("const FIRST_VIEW_AD_LOAD_TIMEOUT_MS = 16_000"));
  assert.ok(native.includes('const AD_LOAD_TIMEOUT_MS = 12_000'));
  assert.ok(native.includes('createdAd?.destroy()'));
  assert.ok(native.includes('NativeAdEventType.IMPRESSION'));
  assert.ok(native.includes('reserveBuklodPassiveAdRequest(placementId, requestKey)'));
  assert.ok(native.includes('BannerAdSize.MEDIUM_RECTANGLE'));
  assert.ok(native.includes('NativeMediaView'));
});

test('Loaded adaptive banner stays mounted offscreen, with no-fill wait and bounded recovery', () => {
  assert.ok(banner.includes('const viewportReady = !requireViewport || eligible || loaded'));
  assert.ok(banner.includes('const BANNER_LOAD_TIMEOUT_MS = 14_000'));
  assert.ok(banner.includes("code.includes('no-fill')"));
  assert.ok(banner.includes('getBuklodPassiveAdRequestWaitMs(stablePlacementId, requestKey)'));
  assert.ok(banner.includes('if (!routeSafe || !unitId || failed)'));
  assert.ok(banner.includes('AD_SLOT_REMOUNT_COOLDOWN_MS'));
});

test('Focus faculty landing accepts only passive focus ad, never grade/quiz descendants or fullscreen on that page', () => {
  const c = controller();
  c.setBuklodAdRoute('/profile/buklod-faculty');
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'faculty_focus_generic', placement: 'focus',
  }), true);
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'faculty_home_generic', placement: 'home',
  }), false);
  assert.equal(c.canWarmBuklodFullScreenAd('interstitial_abc_lesson_completed'), false);
  c.setBuklodAdRoute('/profile/buklod-faculty/grades');
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'faculty_focus_generic', placement: 'focus',
  }), false);
  c.setBuklodAdRoute('/quiz');
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'faculty_focus_generic', placement: 'focus',
  }), false);
  c.setBuklodAdRoute('/buklod');
  const releaseTyping = c.acquireBuklodAdSafetyLock('typing');
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'public_wall_entry', placement: 'community',
  }), false);
  releaseTyping();
  c.setBuklodAdRemoteFeatures({ ads_all: false });
  assert.equal(c.isBuklodPassiveAdAllowed({
    placementId: 'public_wall_entry', placement: 'community',
  }), false);
});

test('Interstitial prewarm never auto-displays on navigation and respects feature and route gates', () => {
  assert.ok(bridge.includes("Platform.OS !== 'android' || !config?.features"));
  assert.ok(bridge.includes('isBuklodAdRouteSensitive(pathname)'));
  assert.ok(bridge.includes("warmBuklodInterstitial('interstitial_generic')"));
  assert.ok(!bridge.includes('maybeShowBuklodInterstitial('));
  assert.ok(interstitial.includes('await reserveBuklodFullScreenAd(reason, placementId)'));
  assert.ok(interstitial.includes('!canWarmBuklodFullScreenAd(placementId)'));
  assert.ok(interstitial.includes('isBuklodAdLightPassActive()'));
  assert.ok(interstitial.includes("interstitial.addAdEventListener(AdEventType.OPENED"));
  assert.ok(interstitial.includes("'ad_rendered'"));
  assert.ok(interstitial.includes('cleanupInterstitialListeners();\n    interstitial = null;'));
  assert.ok(interstitial.includes('void prepareInterstitial(placementId).catch(error =>'));
  assert.ok(!interstitial.includes("'ad_impression',\n        undefined,\n        { route }"));
  assert.match(read('src/lib/buklodAdMonetizationPolicy.shared.ts'), /INTERSTITIAL_MIN_EVENT_COUNT = 2/);
});

test('Home, Wall, Reels, Profile, Connect, Cluster, large rectangle and optional rewarded inventories remain wired', () => {
  const fixtures = [
    ['src/app/(tabs)/hub.tsx','placement="home" placementId="new_home_first_view"'],
    ['src/app/(tabs)/me.tsx','placement="profile" placementId="profile_first_view"'],
    ['src/app/(tabs)/messages.tsx','connect_personal_first_view'],
    ['src/app/clusters/index.tsx','BuklodFirstViewAd'],
    ['src/app/(tabs)/buklod.tsx','BuklodFirstViewAd'],
    ['src/app/igpat/index.tsx','BuklodReelsInlineAd'],
    ['src/components/BuklodVideoCompanionAd.tsx','placement="video_companion"'],
    ['src/components/home/BuklodBahayAds.native.tsx','showBuklodRewardedAd'],
    ['src/components/BuklodAdLightRewardCard.android.tsx','showBuklodRewardedAd'],
  ];
  for (const [file, fragment] of fixtures) {
    assert.ok(read(file).includes(fragment), file + ' lost its inventory');
  }
  const header = read('src/components/BuklodHeaderSponsor.tsx');
  assert.ok(header.includes("Platform.OS === 'android' && width < 680"));
  assert.ok(header.includes('width >= 680'));
  assert.ok(!read('src/components/BuklodNativeSponsoredCard.tsx').includes('react-native-google-mobile-ads'));
});

test('Frozen production RC requires valid live EAS ad settings before publishing, never prints IDs', () => {
  const gate = "npx eas-cli@latest env:exec production 'node scripts/verify-production-ads-env.cjs'";
  assert.ok(release.includes(gate));
  assert.ok(release.indexOf(gate) < release.indexOf("npx eas-cli@latest env:exec production 'npx expo export"));
  assert.ok(release.indexOf('node --test tests/production-ota-ads-regression.test.mjs') < release.indexOf(gate));
  const script = 'scripts/verify-production-ads-env.cjs';
  const valid = {
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS: 'true',
    EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID: 'ca-app-pub-3448515158880100/1111111111',
    EXPO_PUBLIC_ADMOB_COMMUNITY_BANNER_UNIT_ID: 'ca-app-pub-3448515158880100/2222222222',
    EXPO_PUBLIC_ADMOB_MESSAGES_BANNER_UNIT_ID: 'ca-app-pub-3448515158880100/3333333333',
    EXPO_PUBLIC_ADMOB_CONTENT_BANNER_UNIT_ID: 'ca-app-pub-3448515158880100/4444444444',
    EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: 'ca-app-pub-3448515158880100/5555555555',
    EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID: 'ca-app-pub-3448515158880100/6666666666',
  };
  const success = spawnSync(process.execPath, [script], { encoding: 'utf8', env: valid });
  assert.equal(success.status, 0, success.stderr);
  assert.ok(!success.stdout.includes('3448515158880100'), 'unit IDs must be redacted');
  const broken = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: { ...valid, EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS: 'false' },
  });
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /LIVE_IDS/);
  const sample = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: { ...valid, EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: 'ca-app-pub-3940256099942544/1033173712' },
  });
  assert.equal(sample.status, 1);
  assert.match(sample.stderr, /interstitial requires/);
});
