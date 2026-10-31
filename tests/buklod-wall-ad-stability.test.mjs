import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('First view and banner keep a stable 68px sponsored area during startup and no fill', () => {
 const banner = read('src/components/BuklodAdMobBanner.tsx');
 const first = read('src/components/BuklodFirstViewAd.tsx');
 assert.match(banner, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.match(first, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.match(banner, /if \(noFill && online\) \{[\s\S]*?return;/);
 assert.doesNotMatch(banner, /if \(!online \|\| noFill \|\| attempt >= MAX_RETRIES\)/);
 assert.match(banner,/reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
});

test('Native post-sized ad and banner fallback share one reserved feed frame', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /const FEED_AD_CARD_HEIGHT = 392/);
 assert.match(s, /height: FEED_AD_CARD_HEIGHT/g);
 assert.match(s, /<NativeMediaView/);
 assert.match(s, /height: 200/);
 assert.match(s, /bannerOnlyFrame/);
 assert.match(s, /BannerAdSize.MEDIUM_RECTANGLE/);
 assert.match(s, /usePostRectangle/);
 assert.match(s, /height: 250/);
 assert.ok(s.includes("if (!errorCode.includes('no-fill'))"));
 assert.ok(s.includes('!nativeFailed || !bannerUnitId || bannerFailed'));
 assert.match(s, /Sponsored/);
 assert.match(s, /NativeAdEventType.IMPRESSION/);
 assert.match(s, /getBuklodPassiveAdRequestWaitMs/);
});

test('AdMob init never waits on perpetually active interactions', () => {
 const s=read('src/providers/AdsProvider.tsx');
 assert.doesNotMatch(s,/InteractionManager.runAfterInteractions/);
 assert.match(s,/setTimeout\(\(\) => \{/);
 assert.match(s,/initializeBuklodAds\(\)/);
 assert.match(s,/clearTimeout\(task\)/);
});
