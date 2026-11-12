import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reels = readFileSync('src/components/BuklodReelsInlineAd.tsx', 'utf8');
const gate = readFileSync('src/lib/buklodGlobalAdController.ts', 'utf8');

test('Reels ad slot is re-evaluated after global safety gate transition', () => {
  assert.match(reels, /useSyncExternalStore\(\s*subscribeBuklodAdSafety,\s*getBuklodAdSafetyRevision,/);
  assert.match(reels, /isBuklodPassiveAdAllowed/);
  assert.match(gate, /notifyBuklodAdSafetyChange\(\)/);
});

test('Reels ad inventory keeps native request reservation and consent intact', () => {
  assert.match(reels, /reserveBuklodPassiveAdRequest/);
  assert.match(reels, /canRequestAds/);
  assert.match(reels, /NativeAd/);
});
