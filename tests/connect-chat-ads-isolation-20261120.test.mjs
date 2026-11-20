import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const thread = read('src/components/BuklodConnectThread.tsx');
const bubble = read('src/components/connect/ConnectMessageBubble.tsx');
const scope = read('src/app/scope/index.tsx');

test('Connect density does not introduce ad or reward effects', () => {
  assert.match(thread, /ConnectMessageBubble/);
  assert.match(thread, /connectBubbleGrouping/);
  assert.match(thread, /roomCursorCoversMessage/);
  assert.match(thread, /readersForMessageWindow/);
  assert.match(scope, /BuklodCommunitySponsoredAd/);
  assert.match(scope, /section === 'home'/);
  assert.match(scope, /section === 'community'/);
  // The bubble must remain a visual renderer, not an ad or economy gateway.
  assert.doesNotMatch(bubble, /AdsProvider|adUnitId|AdMob|impressionEvent|QMP|payout|awardPoints|grantRewards/);
});

test('Chat timestamp data stays sourced from existing message records, not ad counters', () => {
  assert.match(thread, /microTimeLabel=\{formatConnectMessageMicroTime\(item\.created_at\)\}/);
  assert.match(bubble, /\{!!deliveryLabel && \(/);
  assert.doesNotMatch(thread, /onAdImpression|rewardPointsForMessage|interstitialAfterMessage/);
});
