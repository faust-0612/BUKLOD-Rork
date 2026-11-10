import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Kingdom Hall and Treasury native ads do not monetize invalid or duplicate claims',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 const shop=read('src/app/games/rewards.tsx');
 assert.match(legacy,/if \(verified\) \{[\s\S]*pendingClaimAd\.current/);
 assert.match(legacy,/if \(verified && accountRef\.current === verified\.owner/);
 assert.match(shop,/verifiedUnlock = Boolean\(receipt\.purchased\)/);
 assert.match(shop,/if\(verifiedUnlock\) void maybeShowBuklodInterstitial/);
 assert.match(legacy,/kingdom_legacy_native/);
 assert.match(shop,/kingdom_treasury_native/);
});
test('Dedicated Kingdom routes retain global ad safety and two-completion cadence',()=>{
 const gate=read('src/lib/buklodGlobalAdController.ts');
 for(const id of ['kingdom_practice_hint','kingdom_legacy_native','kingdom_treasury_native',
  'interstitial_kingdom_legacy_claim','interstitial_kingdom_power_unlocked'])
  assert.ok(gate.includes(id),id+' missing');
 assert.match(gate,/Math\.max\(2, INTERSTITIAL_MIN_EVENT_COUNT\)/);
});

test('Optional rewarded video unlocks only local hints when SDK confirms earned reward and same account',()=>{
 const s=read('src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx');
 assert.match(s,/isBuklodRewardedAdAllowed\('kingdom_practice_hint'\)/);
 assert.match(s,/ad\.earned && accountKey === keyRef\.current/);
 assert.match(s,/setRewardedHintIndex\(0\)/);
 assert.match(s,/phase === 'playing' && allowOptInHint/);
 assert.match(s,/kingdom_practice_complete_banner/);
 assert.match(read('src/lib/buklodRewardedAds.web.ts'),/earned: false/);
});

test('Kingdom native ad wrapper uses exact route-safe placement override',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 const shop=read('src/app/games/rewards.tsx');
 assert.match(legacy,/placementIdOverride="kingdom_legacy_native"/);
 assert.match(shop,/placementIdOverride="kingdom_treasury_native"/);
});
