'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/lib/season2/buklodSeason2CompleteRewardIndexR1.ts');
const ui=read('src/components/points/BuklodS2CompleteRewardIndex.tsx');
const parent=read('src/components/points/BuklodS2CompleteRewardsReference.tsx');
const assets=read('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
const catalog=JSON.parse(read('contracts/season2-dec6-complete-reward-inventory-20261119.json'));
function rows(prefix,end){
 const start=source.indexOf(prefix);
 assert.ok(start>=0);
 const stop=source.indexOf(end,start+prefix.length);
 assert.ok(stop>start);
 const raw=source.slice(start+prefix.length,stop);
 const ids=[...raw.matchAll(/\{id:'([^']+)'/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
 return ids;
}
test('all seven currencies represented with explicit separate authority',()=>{
 const ids=rows('export const S2_REWARD_CURRENCIES=Object.freeze([',']);\nexport const S2_REWARD_STATUS_LEGEND');
 assert.deepEqual(ids,catalog.currencies.map(x=>x.id));
 assert.match(source,/financial finalization OFF/i);
 assert.match(source,/not a fixed peso/i);
});
test('complete reward index covers every major award family and all asset classes',()=>{
 const ids=rows('export const S2_REWARD_FAMILY_INDEX=Object.freeze([',']);\nexport const S2_REWARD_AWARD_CATEGORIES');
 assert.equal(ids.length,19);
 for(const id of ['community_bp','learning_bp','ministry_bp','game_bp','achievement_bp','qmp_events','qmp_missions','kl_progressive','tokens','weekly','momentum','referral','character','badges','rank','kingdom','awards','bonus','finance'])assert.ok(ids.includes(id));
 const awards=rows('export const S2_REWARD_AWARD_CATEGORIES=Object.freeze([',']);');
 assert.equal(awards.length,7);
 assert.match(assets,/BUKLOD_CHARACTER_WORLD_IDS\.map/);
 assert.match(assets,/getS2CollectibleGuide\(charId,level,i\+1\)/);
 assert.match(assets,/plannedS2BadgeCriteria\(badgeKind,i,en\)/);
 assert.match(assets,/S2_KINGDOM_SHARD_EARNING_SOURCES\.map/);
});
test('guide is default but remains lazy and collapsed, with no reward mint',()=>{
 assert.match(parent,/useState<Tab>\('all'\)/);
 assert.match(parent,/tab==='all'\?<BuklodS2CompleteRewardIndex\/>/);
 assert.match(parent,/\{expanded\?<View/);
 assert.match(ui,/S2_REWARD_FAMILY_INDEX\.map/);
 for(const s of [source,ui])for(const pattern of [/\.rpc\s*\(/,/\.insert\s*\(/,/\.update\s*\(/,/\.upsert\s*\(/,/supabase/i])assert.doesNotMatch(s,pattern);
});
test('1,300 items, 469 badges, 40 ranks and four seasonal awards are not confused',()=>{
 for(const s of ['1,300','469','40 rank','Four seasonal awards','four Journey Token','Kingdom'])assert.ok(source.includes(s));
 assert.match(source,/S2 mastery NOT LIVE/);
 assert.match(source,/S2 badge criteria NOT LIVE/);
 assert.match(source,/S2 LOCKED/);
});
test('earned, pending, proposed, retired and active catalog statuses distinguished',()=>{
 const ids=rows('export const S2_REWARD_STATUS_LEGEND=Object.freeze([',']);\nexport const S2_REWARD_FAMILY_INDEX');
 assert.deepEqual(ids,['active','pending','earned','preview','inactive']);
 assert.match(source,/No automatic grant|no automatic grant/i);
});
