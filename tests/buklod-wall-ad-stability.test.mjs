import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('Android first-view uses native inventory first and preserves the first-view placement identity', () => {
 const first = read('src/components/BuklodFirstViewAd.android.tsx');
 const bannerFirst = read('src/components/BuklodFirstViewAd.tsx');
 const banner = read('src/components/BuklodAdMobBanner.tsx');
 assert.match(first, /BuklodCommunityInlineAd/);
 assert.match(first, /placementIdOverride=\{placementId\}/);
 assert.match(first, /diagnosticName=\{diagnosticPlacementFor\(placement\)\}/);
 assert.match(first, /firstView/);
 assert.doesNotMatch(bannerFirst, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.match(banner, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.match(banner, /if \(noFill && adNetworkAvailable\) \{[\s\S]*?setFailed\(true\)/);
 assert.match(banner, /BANNER_LOAD_TIMEOUT_MS = 8_000/);
 assert.match(banner, /BANNER_AD_LOAD_TIMEOUT/);
 assert.match(banner,/reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
});

test('Native creative keeps its full frame but pending banner and viewport slots stay compact', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /const FEED_AD_CARD_HEIGHT = 392/);
 assert.match(s, /nativeShell:[\s\S]*?height: FEED_AD_CARD_HEIGHT/);
 assert.match(s, /viewportProbe:[\s\S]*?minHeight: AD_PENDING_SLOT_HEIGHT/);
 assert.doesNotMatch(s, /viewportProbe:\s*\{[^}]*height:\s*FEED_AD_CARD_HEIGHT/);
 assert.doesNotMatch(s, /bannerShell:\s*\{[^}]*height:\s*FEED_AD_CARD_HEIGHT/);
 assert.match(s, /pendingBannerShell/);
 assert.match(s, /compactBannerShell/);
 assert.match(s, /rectangleBannerShell/);
 assert.match(s, /<NativeMediaView/);
 assert.match(s, /height: 200/);
 assert.match(s, /BannerAdSize.MEDIUM_RECTANGLE/);
 assert.match(s, /usePostRectangle/);
 assert.match(s, /height: 250/);
 assert.match(s, /bannerFailedAt.current = Date.now\(\)/);
 assert.ok(s.includes('if (!bannerUnitId || bannerFailed) return null;'));
 assert.match(s, /NativeAdEventType.IMPRESSION/);
 assert.match(s, /getBuklodPassiveAdRequestWaitMs/);
});

test('AdMob init never waits on perpetually active interactions', () => {
 const s=read('src/providers/AdsProvider.tsx');
 assert.doesNotMatch(s,/InteractionManager.runAfterInteractions/);
 assert.doesNotMatch(s,/setTimeout\(/);
 assert.match(s,/initializeBuklodAds\(\)/);
 assert.match(s,/consentRefreshPending/);
});

test('Small banners keep the SDK surface visible during initial load and no-fill', () => {
 const banner=read('src/components/BuklodAdMobBanner.tsx');
 assert.match(banner, /<View style=\{\[styles.shell, compact && styles.compactShell\]\}>/);
 assert.match(banner, /<Animated.View style=\{\[styles.labelRow, \{ opacity \}\]\}>/);
 assert.doesNotMatch(banner, /opacity: compact \? opacity : 1/);
});

test('First-view native timeout is bounded and failed banner fallbacks collapse instead of leaving a full-height blank', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /const FIRST_VIEW_AD_LOAD_TIMEOUT_MS = 8_000/);
 assert.match(s, /firstView \? FIRST_VIEW_AD_LOAD_TIMEOUT_MS : AD_LOAD_TIMEOUT_MS/);
 assert.match(s, /if \(!bannerUnitId \|\| bannerFailed\) return null/);
});
