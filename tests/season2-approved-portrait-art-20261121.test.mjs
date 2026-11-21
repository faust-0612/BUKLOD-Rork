import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const component=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
const entry=read('src/app/buklod-map.tsx');
const guide=read('src/features/season2/world/BuklodMapGuideDock.tsx');
const doors=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json')).hotspots;
test('Approved full portrait and compact map are real SHA-verified bundled assets',()=>{
 const assets=[
 ['buklod-genesis-portrait-welcome-720x995.webp',202914,'e8a2ee3f7d6f00b2ce657f0d4662dfd0258da018f4131d740e90414b56076f1a'],
 ['buklod-genesis-portrait-9doors-720x670.webp',160272,'eff12f78b11b7d45286647a128a438a0065fe61777e5fe39cc1f3d18ff7123d4'],
 ];
 for(const [name,length,digest] of assets){
  const bytes=readFileSync(new URL('../assets/season2/genesis/world/'+name,import.meta.url));
  assert.equal(bytes.length,length);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);
 }
 const reliable=read('src/features/season2/genesis/GenesisReliablePortraitImage.tsx');
 assert.match(component,/<GenesisReliablePortraitImage/);
 assert.match(reliable,/buklod-genesis-portrait-welcome-720x995\.jpg/);
 assert.match(reliable,/buklod-genesis-portrait-9doors-720x670\.jpg/);
 assert.match(reliable,/onError=\{onFailed\}/);
 assert.match(reliable,/GENESIS_PORTRAIT_RESCUE_URI/);
 assert.match(reliable,/GENESIS_COMPACT_RESCUE_URI/);
 assert.match(reliable,/setTimeout/);
 assert.match(reliable,/mode==='safe'/);
 assert.match(reliable,/styles\.safeWorld/);
 assert.match(reliable,/zIndex:mode==='safe'\?10:0/);
 assert.match(reliable,/doors\.map/);
 for(const jpeg of ['buklod-genesis-portrait-welcome-720x995.jpg','buklod-genesis-portrait-9doors-720x670.jpg']){
   const bytes=readFileSync(new URL('../assets/season2/genesis/world/'+jpeg,import.meta.url));
   assert.ok(bytes.length>100000);
   assert.deepEqual([...bytes.subarray(0,3)],[0xff,0xd8,0xff]);
   assert.deepEqual([...bytes.subarray(-2)],[0xff,0xd9]);
 }
 const rescue=read('src/features/season2/genesis/genesisPortraitFallback.generated.ts');
 for(const key of ['GENESIS_PORTRAIT_RESCUE_URI','GENESIS_COMPACT_RESCUE_URI']){
   const data=rescue.match(new RegExp(key+"='data:image/jpeg;base64,([^']+)'"))?.[1];
   assert.ok(data&&data.length>100000,'JS-bundled offline fallback missing');
   assert.deepEqual([...Buffer.from(data,'base64').subarray(0,3)],[0xff,0xd8,0xff]);
 }
});
test('Exactly nine special doors, no duplicate main navigation and safe faith alternative',()=>{
 assert.equal(doors.length,9);
 assert.equal(new Set(doors.map(d=>d.route)).size,9);
 for(const d of doors)assert.ok(!['/hub','/buklod','/messages','/clusters','/me'].includes(d.route),d.id);
 assert.equal(doors.find(d=>d.id==='special-events').route,'/season2/special-events');
 assert.equal(doors.find(d=>d.id==='church').fallbackRoute,'/season2/learnings');
 assert.match(component,/DOORS\.map/);
 assert.match(component,/onPress=\{\(\)=>onOpen\(door/);
 assert.match(component,/!showFaith&&door.faithOnly/);
});
test('Baked four suggestion bubbles are tappable without redrawing duplicate buttons',()=>{
 for(const route of ['/clusters','/season2/games','/season2/learnings','/buklod'])assert.ok(component.includes("route:'"+route+"'"),route);
 assert.match(component,/PROMPTS\.map/);
 assert.match(component,/x:\.475,y:\.842/);
 assert.match(component,/x:\.810,y:\.842/);
 assert.match(component,/x:\.475,y:\.939/);
 assert.match(component,/x:\.810,y:\.939/);
 assert.match(guide,/artworkEmbedded/);
 assert.match(entry,/<BuklodMapGuideDock active=\{focused\} artworkEmbedded \/>/);
});
test('Animation follows focus and reduced-motion safeguards; no financial writes',()=>{
 assert.match(component,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(component,/!active\|\|reduceMotion/);
 assert.match(component,/cycle\.stop\(\)/);
 assert.match(component,/GenesisOriginalGuideMotion/);
 assert.match(read('src/features/season2/genesis/GenesisOriginalGuideMotion.tsx'),/ORIGINAL_GUIDE_IN_MAP/);
 assert.match(component,/specialLandmark/);
 assert.doesNotMatch(component,/supabase\.rpc|service_role|awardBp|mintBp/i);
 assert.match(entry,/BuklodAdMobBanner/);
 assert.doesNotMatch(entry,/toggleMusic|awardBp|mintBp/i);
});
