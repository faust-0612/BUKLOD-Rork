import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.BUKLOD_RELIC_GUIDE_TEST_CHILD) {
  test('Kingdom badge/item guide has verified behavioral tests under TS stripping',()=>{
    const r=spawnSync(process.execPath,['--experimental-strip-types','--test',fileURLToPath(import.meta.url)],{
      env:{...process.env,BUKLOD_RELIC_GUIDE_TEST_CHILD:'1'},
      encoding:'utf8',timeout:15_000
    });
    assert.equal(r.status,0,(r.stdout||'')+(r.stderr||''));
    assert.match(r.stdout,/# pass 7/);
  });
} else {
const {getKingdomRelicGuide, characterRelicRequirement, legacyItemTransferPolicy,canOfferCosmeticTrade} =
 await import('../src/lib/buklodKingdomRewardGuide.ts');

test('every five claimed item kinds has a tangible use and is account bound',()=>{
  for(let i=1;i<=5;i++){
    const item=getKingdomRelicGuide(null,i);
    assert.ok(item.name.length>4);
    assert.ok(item.where.length>5);
    assert.ok(item.benefit.includes('Equip'));
    assert.equal(item.tradeRule,'BOUND');
  }
});
test('explicit type overrides index only for server-authored type',()=>{
  assert.equal(getKingdomRelicGuide('visual_effect',1).name,'Visual Effect');
  assert.throws(()=>getKingdomRelicGuide(null,6),/Unknown/);
});
test('core item eligibility discloses missing level and active character requirements',()=>{
  const base={requiredLevel:5,currentLevel:4,characterName:'Phan'};
  assert.match(characterRelicRequirement({...base,serverVerifiedActive:true}),/1 levels remaining/);
  assert.match(characterRelicRequirement({...base,serverVerifiedActive:false}),/Switch to Phan/);
  assert.match(characterRelicRequirement({...base,serverVerifiedActive:null}),/Checking/);
});
test('eligible user sees achieved requirement without inventing another achievement',()=>{
  assert.match(characterRelicRequirement({requiredLevel:5,currentLevel:5,characterName:'Phan',serverVerifiedActive:true}),/eligible to claim/);
  assert.throws(()=>characterRelicRequirement({requiredLevel:21,currentLevel:20,characterName:'Phan',serverVerifiedActive:true}),/Invalid/);
});
test('existing badge, story item and kingdom powers are never tradeable',()=>{
  assert.equal(legacyItemTransferPolicy(),'NOT_TRADABLE');
  for(const category of ['earned_badge','character_story_item','kingdom_power']){
    assert.equal(canOfferCosmeticTrade({category,verifiedQuantity:99,equippedQuantity:0,tradeFeatureEnabled:true,accountVerified:true}),false);
  }
});
test('future trades remain safely OFF even for duplicates until explicitly enabled',()=>{
  assert.equal(canOfferCosmeticTrade({category:'cosmetic_duplicate',verifiedQuantity:3,equippedQuantity:0,tradeFeatureEnabled:false,accountVerified:true}),false);
  assert.equal(canOfferCosmeticTrade({category:'cosmetic_duplicate',verifiedQuantity:3,equippedQuantity:0,tradeFeatureEnabled:true,accountVerified:false}),false);
});
test('even future enabled trade needs two spare verified cosmetic copies, never invalid counts',()=>{
  const b={category:'cosmetic_duplicate',tradeFeatureEnabled:true,accountVerified:true};
  assert.equal(canOfferCosmeticTrade({...b,verifiedQuantity:2,equippedQuantity:1}),false);
  assert.equal(canOfferCosmeticTrade({...b,verifiedQuantity:3,equippedQuantity:1}),true);
  assert.equal(canOfferCosmeticTrade({...b,verifiedQuantity:NaN,equippedQuantity:0}),false);
  assert.equal(canOfferCosmeticTrade({...b,verifiedQuantity:-1,equippedQuantity:0}),false);
});
}
