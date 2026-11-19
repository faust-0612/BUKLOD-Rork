'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const authoritative=read('src/lib/buklodKingdomShards.ts');
const snapshot=read('src/lib/season2/buklodS2KingdomShardGuideSnapshotR1.ts');
const memberView=read('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
test('all four exact Kingdom Shard prices agree with existing authenticated Kingdom store',()=>{
 const prices=[['wisdom_lens','Wisdom Lens',2],['guardian_shield','Guardian Shield',3],['explorer_compass','Explorer Compass',2],['aura_emerald','Emerald Aura',10]];
 for(const [key,label,price] of prices){
  const raw=(s)=>{const i=s.indexOf("key:'"+key+"'");assert.ok(i>0);return s.slice(i,i+300)};
  for(const source of [authoritative,snapshot]){
   const entry=raw(source);
   assert.ok(entry.includes("name:'"+label+"'"));
   assert.ok(entry.includes('price:'+price));
  }
 }
 assert.match(memberView,/S2_KINGDOM_SHARD_REFERENCE\.map/);
});
test('Kingdom guide is read-only, no eager Supabase, cannot grant BP/QMP/Tokens/cash',()=>{
 assert.equal(snapshot.split('\n').some(s=>s.trim().startsWith('import ')),false);
 assert.match(snapshot,/CANONICAL_CATALOG_SNAPSHOT_SERVER_REQUIRED/);
 assert.doesNotMatch(memberView,/@\/lib\/buklodKingdomShards|@\/lib\/supabase|\.rpc\(/);
 assert.match(memberView,/not BP, QMP, cash or S2 Journey Tokens/i);
});
