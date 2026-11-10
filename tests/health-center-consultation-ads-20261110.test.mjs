import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal=readFileSync('src/app/profile/buklod-health.tsx','utf8');
const strip=readFileSync('src/components/BuklodFocusAppAdStrip.tsx','utf8');
const nativeBanner=readFileSync('src/components/BuklodAdMobBanner.tsx','utf8');
const webBanner=readFileSync('src/components/BuklodAdMobBanner.web.tsx','utf8');
const routing=readFileSync('src/lib/buklodGlobalAdController.ts','utf8');

test('Ads use existing BUKLOD AdMob / web consent infrastructure, no new unit IDs',()=>{
  assert.match(portal, /import BuklodAdMobBanner from '@\/components\/BuklodAdMobBanner'/);
  assert.match(portal, /placement="focus"/);
  assert.match(portal, /placementId="health_consultation_safe_info_banner"/);
  assert.match(portal, /showLabel/);
  assert.match(nativeBanner,/useAds/);
  assert.match(nativeBanner,/useBuklodAdViewportGate/);
  assert.match(webBanner,/BuklodWebAdSlot/);
  assert.match(routing,/isBuklodPassiveAdAllowed/);
  assert.doesNotMatch(portal,/TestIds|AdMobBannerId|adUnitId=|adsbygoogle|rewarded|interstitial/i);
});

test('Only nonurgent screened flow has banner; neither emergency nor unanswered has an ad opportunity',()=>{
  assert.match(portal,/const urgent = urgency === 'urgent'/);
  assert.match(portal, /{urgency === 'none' \? \(\s*<View style={styles\.adPlacement}/);
  assert.match(portal, /requireViewport/);
  assert.equal((portal.match(/<BuklodAdMobBanner/g)||[]).length,1);
  assert.doesNotMatch(strip,/^\s*'\/profile\/buklod-health',/m);
  assert.doesNotMatch(portal,/acquireBuklodAdSafetyLock\('critical_admin'\)/);
});

test('Ad slot does not control help, critical flow, AI referral or provider authorization',()=>{
  assert.ok(portal.indexOf('Seek immediate medical help') < portal.indexOf('<BuklodAdMobBanner'));
  assert.ok(portal.indexOf('Open standalone Health Center') < portal.indexOf('<BuklodAdMobBanner'));
  assert.match(portal,/Advertisement is separate from health guidance/);
  assert.doesNotMatch(portal,/showBuklodRewardedAd|showBuklodInterstitialAd/);
});
