import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('First-view banners reserve space only while loading and collapse on no-fill', () => {
 const banner = read('src/components/BuklodAdMobBanner.tsx');
 const first = read('src/components/BuklodFirstViewAd.tsx');
 assert.match(banner, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.doesNotMatch(first, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
 assert.match(banner, /if \(!routeSafe \|\| !unitId \|\| failed\) \{\s*return null;/);
 assert.match(banner, /if \(noFill && adNetworkAvailable\) \{[\s\S]*?setFailed\(true\)/);
 assert.match(banner, /One bounded retry after the shared quiet period/);
 assert.match(banner, /reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
});

test('Native feed cards expand only for a real creative and never reserve a blank 392dp banner', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /const FEED_AD_CARD_HEIGHT = 392/);
 assert.match(s, /nativeShell:\s*\{[\s\S]*?height: FEED_AD_CARD_HEIGHT/);
 assert.match(s, /viewportProbe:\s*\{[\s\S]*?height: 8/);
 assert.doesNotMatch(s, /bannerOnlyFrame/);
 assert.doesNotMatch(s, /bannerShell:\s*\{[\s\S]*?height: FEED_AD_CARD_HEIGHT/);
 assert.match(s, /pendingArea:\s*\{[\s\S]*?minHeight: 8/);
 assert.match(s, /if \(nativeFailed && \(!bannerUnitId \|\| bannerFailed\)\) return null;/);
 assert.match(s, /bannerFailedAt.current = Date.now\(\)/);
 assert.match(s, /<NativeMediaView/);
 assert.match(s, /BannerAdSize.MEDIUM_RECTANGLE/);
 assert.match(s, /height: 250/);
});

test('AdMob startup skips artificial delay and does not block returning users on UMP refresh', () => {
 const provider = read('src/providers/AdsProvider.tsx');
 const admob = read('src/lib/adMob.ts');
 assert.doesNotMatch(provider, /setTimeout\(/);
 assert.match(provider, /void initializeBuklodAds\(\)/);
 assert.match(provider, /result.consentRefreshPending/);
 assert.match(admob, /previousConsent.canRequestAds/);
 assert.match(admob, /consentRefreshPending: true/);
 assert.match(admob, /await gatherConsentOnce\(\)/);
});

test('Small banners keep a measurable probe without reserving space after terminal failure', () => {
 const banner=read('src/components/BuklodAdMobBanner.tsx');
 assert.match(banner, /<View style=\{styles.pendingShell\}/);
 assert.match(banner, /if \(!routeSafe \|\| !unitId \|\| failed\) \{\s*return null;/);
 assert.match(banner, /failedAt.current = Date.now\(\)/);
 assert.match(banner, /if \\(noFill && adNetworkAvailable\\) \\{[\\s\\S]*?setFailed\\(true\\)/);
});

test('Native banner fallback has a tiny pending frame and collapses after failure', () => {
 const inline=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(inline, /const \[bannerRequestReady, setBannerRequestReady\] = useState\(false\)/);
 assert.match(inline, /bannerRequestStarted.current = true;\s*setBannerRequestReady\(true\)/);
 assert.match(inline, /!nativeFailed \|\| !bannerUnitId \|\| !bannerRequestReady/);
 assert.match(inline, /minHeight: 8/);
 assert.match(inline, /if \(nativeFailed && \(!bannerUnitId \|\| bannerFailed\)\) return null;/);
 assert.doesNotMatch(inline, /height: FEED_AD_CARD_HEIGHT,\s*marginTop: 10,\s*marginBottom: 14/);
});
