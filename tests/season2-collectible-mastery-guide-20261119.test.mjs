import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const guide=read('src/lib/season2/buklodSeason2CollectibleGuideR1.ts');
const ui=read('src/components/points/BuklodS2CollectibleGuidePanel.tsx');
const selector=read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const campaign=read('src/components/points/BuklodSeasonJourneyPreview.tsx');
const server=read('docs/season2/sql/BUKLOD_S2_COLLECTIBLE_MASTERY_DRAFT_NOT_DEPLOY.sql');
const mainCatalog=read('src/lib/buklodCharacterWorldCatalog.ts');
const s2=read('src/lib/season2/buklodSeason2RewardContractR1.ts');

test('all 13 canonical characters x 20 levels x 5 items have deterministic guides',()=>{
  assert.match(mainCatalog,/characters: 13/);
  assert.match(mainCatalog,/stagesPerCharacter: 20/);
  assert.match(mainCatalog,/itemsPerStage: 5/);
  assert.match(guide,/S2_COLLECTIBLE_TOTAL = 13 \* 20 \* 5/);
  assert.match(guide,/BUKLOD_CHARACTER_WORLD_IDS\.flatMap/);
  assert.match(guide,/Array\.from\(\{length:20\}/);
  assert.match(guide,/Array\.from\(\{length:5\}/);
  assert.match(guide,/buklodCollectibleName\(characterId,level,slot\)/);
  assert.match(guide,/s2:\$\{characterId\}:l\$\{validLevel\(level\)\}:i\$\{validSlot\(index\)\}/);
  assert.match(guide,/if\(!Number\.isInteger\(level\)\|\|level<1\|\|level>20\)/);
});
test('mastery tasks have evidence and explain member benefits without fake economic value',()=>{
  for(const key of ['character','level','learning','community','foundation','prior_items'])
    assert.ok(guide.includes(`key:'${key}'`),`missing ${key}`);
  for(const event of ['kl_verified_chapter','today_dugtong','wall_original_post','wall_meaningful_comment'])
    assert.ok(guide.includes(event),event);
  assert.match(guide,/notForSale:true,notFinancial:true,legacyItemsUnaffected:true/);
  assert.match(guide,/grantsEnabled: false/);
  assert.match(guide,/PREVIEW_ONLY/);
  assert.doesNotMatch(guide,/(?:\.rpc\(|supabase|setState\()/);
});
test('full guides are discoverable, Filipino/English-aware and do not claim preview awards',()=>{
  assert.match(ui,/useBuklodI18n/);
  assert.match(ui,/serverSnapshot=null/);
  assert.match(ui,/PREVIEW · SERVER CLAIMS DISABLED/);
  assert.match(ui,/Existing owned Character items remain owned/);
  assert.match(ui,/Nananatiling sa iyo ang dating owned Character items/);
  assert.match(ui,/guide\.steps\.map/);
  assert.match(campaign,/masteryGuideOpen\?<BuklodS2CollectibleGuidePanel/);
  assert.match(selector,/SEASON 2 · HOW & WHY\?/);
});
test('fix false-owned artifact: level eligibility cannot masquerade as redemption',()=>{
  assert.match(selector,/const owned = Boolean\(saved\?\.redeemedAt\)/);
  assert.doesNotMatch(selector,/Boolean\(saved\?\.redeemedAt\) \|\| collectionLevel <= availableLevel/);
  assert.match(selector,/owned \? 'use' : 'claim'/);
  assert.doesNotMatch(selector,/Auto-earn may already own it/);
  assert.match(selector,/await useMyCharacterCollectible\(draft, collectionLevel, itemIndex\)/);
});
test('server certification is isolated, idempotent and claims only existing validated evidence',()=>{
  for(const p of ['create table if not exists buklod_s2.collectible_mastery',
    'alter table buklod_s2.collectible_mastery enable row level security',
    'unique(user_id,request_nonce)','unique(user_id,source_receipt_id)',
    'unique(user_id,foundation_week)','for update','CHARACTER_NOT_ACTIVE',
    'LOCKED_LEVEL','RECEIPT_ALREADY_USED','FOUNDATION_ALREADY_USED',
    'PRIOR_FOUR_ITEMS_REQUIRED','OFFICIAL_SYSTEM_ADMIN_EXCLUDED',
    'private.buklod_character_progress_v3',
    'buklod_s2.weekly_claim','buklod_s2.badge_grant'])
    assert.ok(server.includes(p),p);
  assert.match(server,/revoke all on function buklod_s2\.claim_collectible_mastery/);
  assert.match(server,/to service_role/);
  assert.match(server,/tokens_minted',0/);
  assert.match(server,/legacy_inventory_mutated',false/);
  assert.doesNotMatch(server,/\b(public\.buklod_character_collectible_state|public\.buklod_user_points_balances)\s+(?:set|update|delete)/i);
});
test('S2 rollout remains disabled and no production automatic enablement',()=>{
  assert.match(s2,/missionSettlement: false, journeyTokenMint: false/);
  assert.match(s2,/productionAuthorized: false/);
  assert.match(server,/DRAFT\. NEVER APPLY TO PRODUCTION/);
  assert.match(guide,/existingCharacterInventoryImmutable: true/);
});
