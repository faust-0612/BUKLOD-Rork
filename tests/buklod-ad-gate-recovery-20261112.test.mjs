import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p,'utf8');
const gate = read('src/lib/buklodGlobalAdController.ts');
const ads = [
  'src/components/BuklodAdMobBanner.tsx',
  'src/components/BuklodCommunityInlineAd.android.tsx',
  'src/components/BuklodReelsInlineAd.tsx',
];

test('Safety state is observable; release of the last interaction lock wakes ad slots', () => {
  assert.match(gate, /let adSafetyRevision = 0/);
  assert.match(gate, /subscribeBuklodAdSafety\(listener/);
  assert.match(gate, /if \(!wasLocked\) notifyBuklodAdSafetyChange\(\)/);
  assert.match(gate, /if \(locks\[kind\] === 0\) notifyBuklodAdSafetyChange\(\)/);
  assert.match(gate, /if \(foreground === value\) return/);
  assert.match(gate, /if \(changed\) notifyBuklodAdSafetyChange\(\)/);
  for (const path of ads) {
    assert.match(read(path), /useSyncExternalStore\(\s*subscribeBuklodAdSafety,\s*getBuklodAdSafetyRevision,/);
  }
});

test('Existing monetization gates, no-fill cooldown, and user actions are not bypassed', () => {
  assert.match(gate, /enabled\('ads_passive'\)/);
  assert.match(gate, /!hasInteractionLock\(\)/);
  assert.match(gate, /!isBuklodAdRouteSensitive\(route\)/);
  assert.match(gate, /reserveBuklodPassiveAdRequest\(/);
  const banner = read(ads[0]);
  assert.match(banner, /ready && canRequestAds/);
  assert.match(banner, /reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
  assert.match(banner, /onAdImpression/);
  assert.match(banner, /BANNER_LOAD_TIMEOUT_MS/);
  assert.doesNotMatch(gate, /Math\.random\(|fake_impression|forceImpression/);
});
