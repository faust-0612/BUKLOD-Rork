import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const core=JSON.parse(read('content/kingdom-item-atlas-core-v2.json'));
const classics=JSON.parse(read('content/kingdom-item-classes-v1.json'));
const route=read('src/app/games/index.tsx');
const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
const collection=read('src/app/games/genesis-collection.tsx');
const scene=read('src/features/season2/genesis/GenesisCosmicSky.tsx');

test('20 original 3x2 class sheets are present, with 120 titled item crops',()=>{
 assert.equal(core.classCount,20);
 assert.equal(core.itemCount,120);
 assert.equal(core.classes.length,20);
 const ids=new Set();
 for(const group of core.classes){
  assert.equal(group.items.length,6);
  assert.ok(!ids.has(group.id)); ids.add(group.id);
  assert.ok(existsSync(new URL('../assets/images/kingdom-item-atlas/'+group.id+'.webp',import.meta.url)));
 }
 assert.equal(ids.size,20);
 assert.match(collection,/overflow:\s*'hidden'/);
 assert.match(collection,/left:-\(index%3\)\*width/);
 assert.match(collection,/top:-Math\.floor\(index\/3\)\*height/);
});
test('seven owner-supplied classic classes expose exactly 42 cropped originals',()=>{
 const groups=classics.groups.filter(g=>g.status==='art_supplied');
 assert.equal(groups.length,7);
 for(const group of groups){
  assert.equal(group.items.length,6);
  for(let i=1;i<=6;i++){
   assert.ok(existsSync(new URL('../assets/images/kingdom-classes/'+group.id+'-'+i+'.webp',import.meta.url)));
  }
 }
 assert.match(collection,/42 INDIVIDUAL CUTS/);
});
test('the 13 official Kingdom station routes remain selectable, without changing the backend',()=>{
 const routes=[...portal.matchAll(/id:'([^']+)'/g)].map(m=>m[1]);
 assert.equal(routes.length,13);
 assert.equal(new Set(routes).size,13);
 const previous=read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
 for(const id of routes) assert.ok(previous.includes("id: '"+id+"'"),id);
 assert.match(portal,/router\.push\(\('\/games\/'\+selected\.id\)/);
 assert.doesNotMatch(portal,/\.rpc\(|\.insert\(|\.update\(|\.upsert\(/);
});
test('prod retains legacy map and ad, and no deep-link enters the hidden gallery',()=>{
 assert.match(route,/isGenesisPreviewBuild\(\)/);
 assert.match(route,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(route,/placementId="kingdom_map_footer"/);
 assert.match(collection,/if \(!isGenesisPreviewBuild\(\)\) return <Redirect href="\/games"\/>/);
});
test('cinematic visuals stop when hidden and never play unapproved sound',()=>{
 assert.match(portal,/focused && foreground && !reduceMotion/);
 assert.match(scene,/useGenesisMotionAllowed\(active/);
 assert.match(scene,/loop\.stop\(\)/);
 assert.match(collection,/useGenesisMotionAllowed\(focused\)/);
 assert.match(collection,/if \(!motionAllowed\) return/);
 assert.doesNotMatch(scene,/Audio|playSound|setInterval/);
});
