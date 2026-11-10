import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = file => readFileSync(file, 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const igpat = read('src/app/igpat/index.tsx');
const reel = read('src/components/BuklodReelsInlineAd.tsx');
const controller = read('src/lib/buklodGlobalAdController.ts');
const adPolicy = read('src/lib/buklodAdPlacements.ts');
const viewer = wall.slice(wall.indexOf('{/* BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_SWIPE_R4 */}'),
  wall.indexOf('{/* PATCH_161H_PHOTO_VIEWER */}'));

test('Android fullscreen video uses existing Reels native ad cadence and does not insert ads without consent', () => {
  assert.match(wall, /buildReelsFeedWithInlineAds\(videoViewerPosts\)/);
  assert.match(wall, /isReelsFeedInlineAdRow\(rows\[rows\.length-1\]\)/);
  assert.match(wall, /if\(!videoViewerAdsEnabled\)return videoViewerPosts/);
});

test('fullscreen ad source and review are correctly gated and stable across swipes', () => {
  assert.match(wall, /Platform\.OS==='android' && reelAdsReady && reelAdConsent/);
  assert.match(wall, /setVideoViewerAdsEnabled\(/);
  assert.match(wall, /setVideoViewerAdStates\(\{\}\)/);
  assert.match(viewer, /data=\{videoViewerFeedRows\}/);
  assert.match(viewer, /isReelsFeedInlineAdRow\(item\)/);
  assert.match(viewer, /slotId=\{item\.id\}/);
  assert.match(viewer, /prepare=\{videoViewerOpen&&index===videoViewerIndex\+1\}/);
  assert.match(viewer, /active=\{videoViewerOpen&&isActive\}/);
  assert.match(viewer, /preload=\{index===videoViewerNextVideoIndex\}/);
  assert.match(viewer, /videoViewerActiveIsAd \? 'Sponsored'/);
  assert.match(viewer, /!videoViewerActiveIsAd&&!!videoViewerActiveRow/);
  assert.match(viewer, /videoViewerContentPosition/);
  assert.match(adPolicy, /idPrefix: '__buklod_reels_ad_'/);
});

test('no-fill sponsorship automatically skips without stopping normal video playback', () => {
  assert.match(wall, /state==='unavailable'\?120:3000/);
  assert.match(wall, /if\(state==='ready'\)return/);
  assert.match(wall, /scrollToIndex\(\{index:target,animated:false\}\)/);
  assert.match(viewer, /Continue watching/);
  assert.match(viewer, /Preparing sponsored content…/);
  assert.match(viewer, /paddingTop:Math\.max\(communityInsets\.top\+112,140\)/);
  assert.match(viewer, /paddingBottom:Math\.max\(communityInsets\.bottom\+34,46\)/);
  assert.match(viewer, /onLoadStateChange=\{state=>/);
  assert.doesNotMatch(viewer, /onPlaybackError=\{\(\)=>\{\s*void refreshVideoViewerUrl\(item\s*\)/);
});

test('IGPAT also preserves native Reels ads and can avoid an empty no-fill page', () => {
  assert.match(igpat, /buildReelsFeedWithInlineAds\(rows\)/);
  assert.match(igpat, /isReelsFeedInlineAdRow\(feed\[feed\.length-1\]\)/);
  assert.match(igpat, /prepare=\{index===activeIndex\+1\}/);
  assert.match(igpat, /onLoadStateChange=\{next=>/);
  assert.match(igpat, /status==='unavailable'\?120:3000/);
  assert.match(igpat, /ref=\{reelsListRef\}/);
  assert.match(igpat, /active=\{active\}/);
  assert.match(igpat, /index === activeIndex \|\| index === nextPlayableIndex/);
});

test('Reels native inventory honours consent, remote gates, request spacing and genuine impressions', () => {
  assert.match(reel, /useAds\(\)/);
  assert.match(reel, /useNetwork\(\)/);
  assert.match(reel, /ready && canRequestAds/);
  assert.match(reel, /isBuklodPassiveAdAllowed\(\{/);
  assert.match(reel, /placement: 'reels'/);
  assert.match(reel, /reserveBuklodPassiveAdRequest\('reels_inline', requestKey\)/);
  assert.match(reel, /NativeAdEventType\.IMPRESSION/);
  assert.match(reel, /NativeAdView/);
  assert.match(reel, /NativeMediaView/);
  assert.match(reel, /Sponsored/);
  assert.match(reel, /AD_LOAD_TIMEOUT_MS = 8000/);
  assert.match(reel, /setRequested\(true\)/);
  assert.match(reel, /impressionSub\?\.remove\(\)/);
  assert.match(reel, /createdAd\?\.destroy\(\)/);
  assert.match(reel, /getBuklodBannerUnitId\('reels'\)/);
  assert.doesNotMatch(reel, /maybeShowBuklodInterstitial\(/);
});

test('Reels passive gate is narrowly allowed in IGPAT; other sensitive placements and interstitials remain blocked', () => {
  const code = stripTypeScriptTypes(
    controller.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, ''),
    { mode: 'strip' },
  ).replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');
  const c = vm.runInNewContext(code + '\n({setBuklodAdRoute,isBuklodPassiveAdAllowed,canWarmBuklodFullScreenAd})', {
    AsyncStorage: {getItem:async()=>null,setItem:async()=>{}},
    Platform: {OS:'android'}, INTERSTITIAL_MIN_EVENT_COUNT:2,
    AD_SLOT_REMOUNT_COOLDOWN_MS:120000,
    Math,Date,String,Number,Object,Promise,
  });
  c.setBuklodAdRoute('/igpat');
  assert.equal(c.isBuklodPassiveAdAllowed({ placementId:'reels_inline',placement:'reels' }),true);
  assert.equal(c.isBuklodPassiveAdAllowed({ placementId:'home',placement:'home' }),false);
  assert.equal(c.canWarmBuklodFullScreenAd('interstitial_generic'),false);
  c.setBuklodAdRoute('/quiz');
  assert.equal(c.isBuklodPassiveAdAllowed({ placementId:'reels_inline',placement:'reels' }),false);
});
