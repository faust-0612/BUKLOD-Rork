const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('src/lib/buklodNativeAdRecovery.ts');

function health() {
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Map, Set, Math, Date, Object }, { timeout: 1000 });
  return exports;
}

test('one repeatedly failing native placement retains scoped banner fallback without muting healthy peers', () => {
  const h = health();
  const start = 1_000_000;
  h.noteNativeRequestFailed('profile_first_view', start);
  h.noteNativeRequestFailed('profile_first_view', start + 1_000);
  h.noteNativeRequestFailed('profile_first_view', start + 2_000);
  assert.equal(h.preferBannerAfterNativeFailures('profile_first_view', start + 2_001), true);
  assert.equal(h.preferBannerAfterNativeFailures('new_home_first_view', start + 2_001), false);
});

test('three distinct short-window native failures choose quick banner fallback across first-view placements', () => {
  const h = health();
  const start = 1_000_000;
  h.noteNativeRequestFailed('profile_first_view', start);
  h.noteNativeRequestFailed('new_home_first_view', start + 5_000);
  assert.equal(h.preferBannerAfterNativeFailures('connect_personal_first_view', start + 5_001), false);
  h.noteNativeRequestFailed('cluster_directory_first_view', start + 10_000);
  assert.equal(h.preferBannerAfterNativeFailures('connect_personal_first_view', start + 10_001), true);
  assert.equal(h.preferBannerAfterNativeFailures('public_wall_feed', start + 10_001), true);
});

test('shared fallback automatically recovers after two minutes, without resetting local safety', () => {
  const h = health();
  const start = 1_000_000;
  for (const [index, placement] of ['new_home_first_view', 'profile_first_view', 'cluster_directory_first_view'].entries()) {
    h.noteNativeRequestFailed(placement, start + index * 500);
  }
  assert.equal(h.preferBannerAfterNativeFailures('connect_personal_first_view', start + 20_000), true);
  assert.equal(h.preferBannerAfterNativeFailures('connect_personal_first_view', start + 121_001), false);
  h.noteNativeRequestFailed('profile_first_view', start + 121_002);
  h.noteNativeRequestFailed('cluster_directory_first_view', start + 122_002);
  assert.equal(h.preferBannerAfterNativeFailures('public_wall_feed', start + 122_003), false);
});

test('real successful SDK native load reopens shared inventory immediately', () => {
  const h = health();
  const start = 1_000_000;
  h.noteNativeRequestFailed('home', start);
  h.noteNativeRequestFailed('profile', start + 1000);
  h.noteNativeRequestFailed('connect', start + 2000);
  assert.equal(h.preferBannerAfterNativeFailures('wall', start + 2001), true);
  h.noteNativeRequestSucceeded('home');
  assert.equal(h.preferBannerAfterNativeFailures('wall', start + 2002), false);
});

test('stale failures cannot accumulate into a false global circuit', () => {
  const h = health();
  h.noteNativeRequestFailed('a', 1_000_000);
  h.noteNativeRequestFailed('b', 1_061_000);
  h.noteNativeRequestFailed('c', 1_122_000);
  assert.equal(h.preferBannerAfterNativeFailures('d', 1_122_001), false);
});

test('new circuit preserves original consent, cooldown, SDK impression and bounded prewarm contracts', () => {
  const warm = read('src/components/BuklodDashboardAdWarmup.android.tsx');
  const inline = read('src/components/BuklodCommunityInlineAd.android.tsx');
  const ads = read('src/lib/buklodGlobalAdController.ts');
  assert.match(source, /NATIVE_SHARED_FAILURE_THRESHOLD = 3/);
  assert.match(warm, /MAX_WARM_CREATIVES = 2/);
  assert.match(warm, /canRequestAds/);
  assert.match(warm, /reserveBuklodPassiveAdRequest/);
  assert.match(warm, /NativeAd\.createForAdRequest/);
  assert.match(inline, /NativeAdEventType\.IMPRESSION/);
  assert.match(inline, /getBuklodPassiveAdRequestWaitMs/);
  assert.match(inline, /onAdImpression/);
  assert.match(ads, /isBuklodAdRouteSensitive/);
  assert.doesNotMatch(source, /ad_impression|NativeAd\.createForAdRequest|recordBuklodAdEvent/);
});
