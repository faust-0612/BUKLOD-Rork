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
test('Shard mint sources agree with canonical SQL: +1 verified first game mastery and +2 redeemed collectible exactly once',()=>{
 const sql=read('supabase/migrations/20261111014500_buklod_kingdom_shards_game_only_v1.sql');
 assert.match(sql,/1::integer as reward/);
 assert.match(sql,/2::integer as reward/);
 assert.match(sql,/a\.status='credited'/);
 assert.match(sql,/l\.activity_type='game_first_qualified'/);
 assert.match(sql,/l\.points=2/);
 assert.match(sql,/c\.redeemed_at is not null/);
 assert.match(sql,/on conflict \(user_id,source_key\) do nothing/);
 assert.match(snapshot,/S2_KINGDOM_SHARD_EARNING_SOURCES/);
 assert.match(snapshot,/id:'first_verified_game_mastery',shards:1/);
 assert.match(snapshot,/id:'redeemed_canonical_character_collectible',shards:2/);
 assert.match(memberView,/S2_KINGDOM_SHARD_EARNING_SOURCES\.map/);
});
test('Kingdom guide is read-only, no eager Supabase, cannot grant BP/QMP/Tokens/cash',()=>{
 assert.equal(snapshot.split('\n').some(s=>s.trim().startsWith('import ')),false);
 assert.match(snapshot,/CANONICAL_CATALOG_SNAPSHOT_SERVER_REQUIRED/);
 assert.doesNotMatch(memberView,/@\/lib\/buklodKingdomShards|@\/lib\/supabase|\.rpc\(/);
 assert.match(memberView,/not BP, QMP, cash or S2 Journey Tokens/i);
});
