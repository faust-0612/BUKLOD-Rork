import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');

test('Kingdom native and interstitial ads retain dedicated per-route safety exemptions', () => {
 const gate=read('src/lib/buklodGlobalAdController.ts');
 assert.match(gate,/kingdom_legacy_native/);
 assert.match(gate,/kingdom_treasury_native/);
 assert.match(gate,/kingdom_practice_complete_banner/);
 assert.match(gate,/interstitial_kingdom_legacy_claim/);
 assert.match(gate,/interstitial_kingdom_power_unlocked/);
 assert.match(gate,/kingdom_practice_hint/);
 assert.match(gate,/Math\.max\(2, INTERSTITIAL_MIN_EVENT_COUNT\)/);
 assert.match(gate,/fullScreenCadencePersistenceFailed/);
});
test('Optional rewarded hint and verified Kingdom operations never credit money or points via ads', () => {
 const legacy=read('src/app/games/legacy.tsx');
 const rewards=read('src/app/games/rewards.tsx');
 const practice=read('src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx');
 assert.match(legacy,/pendingClaimAd\.current/);
 assert.match(legacy,/onRequestClose=\{dismissRewardReveal\}/);
 assert.match(rewards,/verifiedUnlock = Boolean\(receipt\.purchased\)/);
 assert.match(practice,/ad\.earned && accountKey === keyRef\.current/);
 assert.match(practice,/setRewardedHintIndex\(0\)/);
 assert.match(read('src/lib/buklodRewardedAds.web.ts'),/earned: false/);
});

test('Kingdom native ad wrapper uses exact route-safe placement override',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 const shop=read('src/app/games/rewards.tsx');
 assert.match(legacy,/placementIdOverride="kingdom_legacy_native"/);
 assert.match(shop,/placementIdOverride="kingdom_treasury_native"/);
});

test('Kingdom native placements never render the web AdSense fallback',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 const rewards=read('src/app/games/rewards.tsx');
 assert.match(legacy,/Platform\.OS === 'android' \? <BuklodCommunityInlineAd/);
 assert.match(rewards,/Platform\.OS === 'android' \? <BuklodCommunityInlineAd/);
});

test('Equipping previously redeemed collectibles never causes another fullscreen ad',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 assert.match(legacy,/const wasPreviouslyClaimed = collection\.items\.some/);
 assert.match(legacy,/if \(!wasPreviouslyClaimed\) \{[\s\S]*pendingClaimAd\.current/);
});
