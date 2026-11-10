import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Kingdom Hall and Treasury native ads do not monetize invalid or duplicate claims',()=>{
 const legacy=read('src/app/games/legacy.tsx');
 const shop=read('src/app/games/rewards.tsx');
 assert.match(legacy,/if \(verified\) \{[\s\S]*verifiedNewClaim = true/);
 assert.match(legacy,/if \(verifiedNewClaim && accountRef\.current === original\.uid/);
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
