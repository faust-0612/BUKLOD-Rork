'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const source=read('src/lib/buklodCharacterWorldCatalog.ts');
const catalog=read('docs/season2/BUKLOD_ALL_1300_ITEMS_469_BADGES_40_RANKS_20261119.md');
const guide=read('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
const view=read('src/components/points/BuklodS2CompleteRewardsReference.tsx');
const journey=read('src/components/points/BuklodSeasonJourneyPreview.tsx');
const kingdomPure=read('src/lib/season2/buklodS2KingdomShardGuideSnapshotR1.ts');
const kingdomCanonical=read('src/lib/buklodKingdomShards.ts');
function between(start,end){
 const i=catalog.indexOf(start),j=catalog.indexOf(end);
 assert.ok(i>=0&&j>i,'missing table section '+start);
 return catalog.slice(i,j);
}
function tableRows(part){return part.split('\n').filter(s=>s.startsWith('| ')&&!s.startsWith('|---'));}
test('all 1,300 named items occupy exactly 260 character/level rows',()=>{
 const rows=tableRows(between('## A. Every named collectible item','## B. Character badge groups'));
 assert.equal(rows.length,261); // header + 260 rows
 assert.match(source,/collectiblesTotal: 1300/);
 assert.match(guide,/selectedItemTotal=BUKLOD_CHARACTER_WORLD_IDS\.length\*20\*5/);
 assert.match(guide,/Array\.from\(\{length:5\}/);
 assert.match(guide,/getS2CollectibleGuide\(charId,level,i\+1\)/);
 const charRows=new Map();
 for(const row of rows.slice(1)){
  const cols=row.split('|').slice(1,-1).map(x=>x.trim());
  assert.equal(cols.length,8);
  assert.ok(cols.slice(3).every(Boolean));
  const [char,level]=cols;
  const seq=charRows.get(char)||[];
  seq.push(Number(level));charRows.set(char,seq);
 }
 assert.equal(charRows.size,13);
 for(const levels of charRows.values())assert.deepEqual(levels,Array.from({length:20},(_,i)=>i+1));
});
test('all 469 names are covered: 461 character badges + eight series',()=>{
 const charPart=between('## B. Character badge groups','## C. Shared series');
 const allCharacter=tableRows(charPart).filter(x=>!x.includes('Badge group |'));
 assert.equal(allCharacter.length,461);
 const series=tableRows(between('## C. Shared series','## D. Full Circle Rank'));
 assert.equal(series.length,9); // one header + 8 shared
 assert.match(source,/badgesTotal: 469/);
 assert.match(guide,/BUKLOD_CHARACTER_BADGES/);
 assert.match(guide,/BUKLOD_SERIES_BADGES/);
 assert.match(guide,/namesByBadgeCategory\.map/);
 assert.match(guide,/CATALOG \/ PREVIEW ONLY/);
});
test('all 40 Circle Rank classes and exact special unlock rank orders',()=>{
 const ranks=tableRows(between('## D. Full Circle Rank classifications','## E. Special Character unlock gates'));
 assert.equal(ranks.length,41);
 const specials=tableRows(between('## E. Special Character unlock gates','## F. Other rewards'));
 assert.equal(specials.length,9);
 for(const name of ['Ace','ELESUR','Jawo','Mitch','Niel','Angel','Vhen','Trudice'])assert.ok(specials.some(x=>x.includes(name)));
 assert.match(guide,/BUKLOD_CIRCLE_RANK_FAMILIES/);
 assert.match(guide,/BUKLOD_CIRCLE_RANK_LEVELS/);
 assert.match(guide,/requiredRank/);
});
test('item badge catalog is lazy inside the collapsible Season Journey and never mints',()=>{
 assert.match(view,/\['assets',t\('ITEMS \/ BADGES','ITEMS \/ BADGES'\)\]/);
 assert.match(view,/tab==='assets'\?<BuklodS2AllItemsBadgesGuide\/>/);
 assert.match(journey,/\{open\?\(/);
 assert.match(journey,/<BuklodS2CompleteRewardsReference\s*\/>/);
 assert.match(guide,/getS2CollectibleGuide/);
 for(const forbidden of [/@\/lib\/supabase/,/@\/lib\/buklodKingdomShards/,/\.rpc\s*\(/,/\.functions\.invoke\s*\(/,/\.upsert\s*\(/,/\.insert\s*\(/,/\.delete\s*\(/])
   assert.doesNotMatch(guide,forbidden);
});
test('pure Kingdom prices exactly match existing authoritative Shard item catalog',()=>{
 const prices=[['wisdom_lens','Wisdom Lens',2],['guardian_shield','Guardian Shield',3],['explorer_compass','Explorer Compass',2],['aura_emerald','Emerald Aura',10]];
 for(const [key,name,price] of prices){
  assert.ok(kingdomCanonical.includes("key:'"+key+"'"));
  assert.ok(kingdomCanonical.includes("name:'"+name+"'"));
  assert.ok(kingdomPure.includes("key:'"+key+"'"));
  assert.ok(kingdomPure.includes("name:'"+name+"'"));
  const locate=(src)=>{const i=src.indexOf("key:'"+key+"'");return src.slice(i,i+300);};
  assert.match(locate(kingdomCanonical),new RegExp('price:'+price+'\\b'));
  assert.match(locate(kingdomPure),new RegExp('price:'+price+'\\b'));
 }
 assert.equal(kingdomPure.split('\n').some(line=>line.trim().startsWith('import ')),false);
});
test('full Season 2 weekly mission guide and separate catalog-only seasonal awards',()=>{
 assert.match(view,/BUKLOD_SEASON2_WEEKLY_BEATS\.map/);
 assert.match(view,/PREVIEW ONLY/);
 assert.match(catalog,/Beacon Trail Frame/);
 assert.match(catalog,/Maker Ribbon/);
 assert.match(catalog,/Alliance Crest/);
 assert.match(catalog,/Constellation Finale Scene/);
 assert.match(catalog,/Owner/);
});
