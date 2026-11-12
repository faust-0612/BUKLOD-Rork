import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The protected-feature classifier matches the "ad" in BuklodConnectThread's
// "read" filename. A Seen fix must not introduce an ad or reward side effect.
const thread = readFileSync('src/components/BuklodConnectThread.tsx', 'utf8');
const bubble = readFileSync('src/components/connect/ConnectMessageBubble.tsx', 'utf8');

test('Cluster read receipts never request ads, impressions, or reward credits', () => {
  const monetizationCall = /AdMob|showInterstitialAd|rewardedAd|adRequest|adPlacement|buklodGlobalAdController|creditPoints|rewardPoints|pointsLedger/i;
  assert.doesNotMatch(thread, monetizationCall);
  assert.doesNotMatch(bubble, monetizationCall);
  assert.match(thread, /mode === 'scope' && isClusterConnect/);
  assert.match(thread, /AppState\.currentState !== 'active'/);
});
