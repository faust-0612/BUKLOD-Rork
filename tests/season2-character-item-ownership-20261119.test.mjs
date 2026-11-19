import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(file)=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const selector=read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const legacy=read('src/lib/buklodCharacterCollectibles.ts');
const guide=read('src/lib/season2/buklodSeason2CollectibleGuideR1.ts');
const sql=read('docs/season2/sql/BUKLOD_S2_COLLECTIBLE_MASTERY_DRAFT_NOT_DEPLOY.sql');
const tokens=read('src/components/points/BuklodS2RewardInstructions.tsx');
test('old character receipts stay canonical while the Season 2 mastery overlay remains separate',()=>{
  assert.match(legacy,/get_my_buklod_character_collectible_state_v1/);
  assert.match(legacy,/redeem_my_buklod_character_collectible_v1/);
  assert.match(selector,/Boolean\(saved\?\.redeemedAt\)/);
  assert.match(guide,/existingCharacterInventoryImmutable: true/);
  assert.match(sql,/create table if not exists buklod_s2\.collectible_mastery/);
  assert.doesNotMatch(sql,/update\s+public\.buklod_character_collectible_state/i);
});
test('Show cannot auto-mint a legacy character collectible',()=>{
  const show=selector.slice(selector.indexOf("if (action === 'use')"),selector.indexOf("if (action === 'remove')"));
  assert.match(show,/await useMyCharacterCollectible/);
  assert.doesNotMatch(show,/redeemMyCharacterCollectible/);
  assert.match(selector,/owned \? 'use' : 'claim'/);
});
test('earning guidance names proof of benefit and token anti-farming, not financial grants',()=>{
  for(const x of ['Season 2','guide.steps.map','serverSnapshot=null']){
    const target=x==='guide.steps.map'?read('src/components/points/BuklodS2CollectibleGuidePanel.tsx'):tokens;
    assert.ok(target.includes(x)||x==='Season 2'&&target.includes('SEASON 2'),x);
  }
  assert.match(sql,/unique\(user_id,source_receipt_id\)/);
  assert.match(sql,/unique\(user_id,foundation_week\)/);
  assert.match(sql,/LOCKED_LEVEL/);
  assert.match(guide,/notForSale:true/);
});
