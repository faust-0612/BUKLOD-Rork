import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewport = readFileSync('src/lib/buklodAdViewport.ts', 'utf8');
const banner = readFileSync('src/components/BuklodAdMobBanner.tsx', 'utf8');
const sponsored = readFileSync('src/components/BuklodCommunityInlineAd.android.tsx', 'utf8');
const policy = readFileSync('src/lib/buklodAdMonetizationPolicy.shared.ts', 'utf8');

test('mounted ad slots share a single viewport clock and foreground listener', () => {
  assert.match(viewport, /const viewportProbes = new Set<ViewportProbe>\(\)/);
  assert.match(viewport, /viewportProbes\.add\(probe\)/);
  assert.match(viewport, /viewportProbes\.delete\(probe\)/);
  assert.match(viewport, /viewportProbes\.size !== 0/);
  assert.match(viewport, /clearInterval\(viewportPollTimer\)/);
  assert.match(viewport, /viewportAppState\?\.remove\(\)/);
  assert.equal((viewport.match(/setInterval\(/g) ?? []).length, 1);
  assert.equal((viewport.match(/AppState\.addEventListener\(/g) ?? []).length, 1);
  assert.doesNotMatch(viewport, /const poll = setInterval\(sample,/);
});

test('native ad reservation still requires viewport settle, second visibility measurement and foreground', () => {
  assert.match(viewport, /const SETTLE_MS = 400/);
  assert.match(viewport, /const POLL_MS = 1200/);
  assert.equal((viewport.match(/measureInWindow\(/g) ?? []).length, 2);
  assert.match(viewport, /generation !== generationRef\.current/);
  assert.match(viewport, /if \(eligible \|\| !isForeground\(\)\) return/);
  assert.match(viewport, /setEligible\(true\)/);
  assert.match(banner, /reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
  assert.match(banner, /routeSafe && reservationReady &&/);
  assert.match(sponsored, /useBuklodAdViewportGate/);
  assert.match(sponsored, /NativeAdEventType\.IMPRESSION/);
});

test('no-fill recovery, monetization policy and existing video playback are not changed', () => {
  assert.match(banner, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(banner, /code\.includes\('no-fill'\)/);
  assert.match(policy, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(sponsored, /nativeRequestStarted/);
  assert.match(sponsored, /bannerRequestStarted/);
  assert.doesNotMatch(viewport, /expo-video|VideoView|player\.play|router\./);
});
