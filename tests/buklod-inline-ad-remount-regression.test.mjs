import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('Native feed rows defer requests on cooldown instead of discarding fallback', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /getBuklodPassiveAdRequestWaitMs\(placementId, requestKey\)/);
 assert.match(s, /setReservationTick\(value => value \+ 1\)/);
 assert.doesNotMatch(s, /if \(!reserveBuklodPassiveAdRequest\(placementId, requestKey\)\) \{\s*setNativeFailed\(true\)/);
});

test('Native ad arriving after timeout is destroyed, not rendered over fallback', () => {
 const s=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.match(s, /let timedOut = false/);
 assert.match(s, /timedOut = true/);
 assert.match(s, /if \(cancelled \|\| timedOut\) \{\s*\/\/ The slot/);
 assert.match(s, /ad.destroy\(\)/);
});
