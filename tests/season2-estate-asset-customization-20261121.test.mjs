import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {
 FINISHES,ROOFS,GROUNDS,FENCES,WINDOWS,LIGHTS,DOORS,PATHS,YARDS,
 safeCosmetics,visualDevelopmentFeatures,
} from '../src/features/season2/world/constructionPlan.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=read('src/features/season2/world/developmentAssetManifest.ts');
const map=read('src/features/season2/world/Season2DevelopmentMap.tsx');
const renderer=read('src/features/season2/world/DevelopmentStructurePreview.tsx');
const tiers=read('src/features/season2/world/EstateTierArtwork.tsx');
const client=read('src/features/season2/world/estateProgressClient.ts');
const sql=read('supabase/migrations/20261121134500_buklod_estate_authoritative_progression_v1.sql');
const groups=['lot','house','cluster'];
function titles(group){
 const m=manifest.match(new RegExp(group+':\\[([\\s\\S]*?)\\]'));
 assert.ok(m,'missing '+group+' asset titles');
 return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
test('30 catalog assets are all represented by installed SVG tier artwork',()=>{
 for(const group of groups){
  assert.equal(titles(group).length,10,group+' must have exactly 10 levels');
  assert.match(tiers,new RegExp("track==='"+group+"'"));
  const piece=tiers.split("track==='"+group+"'")[1].split("track==='")[0];
  for(let level=1;level<=10;level++)assert.ok(piece.includes('c('+level+')'),'missing '+group+' artwork tier '+level);
 }
 assert.match(manifest,/renderStatus:'svg-integrated'/);
 assert.match(manifest,/renderer:'EstateTierArtwork'/);
 assert.match(manifest,/stageRenderer:'DevelopmentStructurePreview'/);
 assert.match(manifest,/stageAssetIds:Object.freeze/);
 assert.match(manifest,/getDevelopmentStageAsset/);
 assert.match(map,/getDevelopmentStageAsset\(previewTrack,level,stage\)/);
 assert.doesNotMatch(map,/require\([^)]*buklod_assets\/png/);
});
test('all 150 stages are separately identified with installed renderer and remain cumulative',()=>{
 const ids=new Set();
 for(const track of groups)for(let level=1;level<=10;level++)for(let stage=0;stage<5;stage++){
  const id=track+':'+level+':'+stage;
  assert.ok(!ids.has(id));ids.add(id);
  const visual=visualDevelopmentFeatures(track,level,stage,0,false);
  const earned=visualDevelopmentFeatures(track,level,stage,0,true);
  assert.ok(visual.length>=earned.length);
  assert.equal(earned.length,stage===4?level:level-1,'completed finishing must render the earned current tier');
 }
 assert.equal(ids.size,150);
 assert.equal(visualDevelopmentFeatures('house',10,0,1,true).length,10);
 assert.match(renderer,/completedTier>0/);
 assert.match(renderer,/earnedProgress/);
 assert.match(renderer,/<EstateTierArtwork/);
 assert.match(map,/earnedProgress=\{liveView&&!!verified\}/);
});
test('world underpaintings are bundled, not broken catalog references',()=>{
 for(const path of [
  'assets/season2/genesis/world/buklod-community-village-stage1.webp',
  'assets/season2/genesis/world/buklod-my-home-stage1.webp',
 ]){
  const file=new URL('../'+path,import.meta.url);
  assert.ok(existsSync(file),path);
  assert.ok(statSync(file).size>10000,'asset is missing image data: '+path);
  assert.ok(map.includes(path.split('/').at(-1)),'bundled image is actually referenced: '+path);
 }
 assert.match(map,/VILLAGE_ART/);assert.match(map,/HOME_ART/);
 assert.match(map,/renderStatus|stageAsset/);
});
test('every user-selectable customization has schema, application and visual output',()=>{
 const lists={finish:FINISHES,roof:ROOFS,ground:GROUNDS,fence:FENCES,windows:WINDOWS,lights:LIGHTS,door:DOORS,path:PATHS,yard:YARDS};
 assert.equal(Object.keys(lists).length,9);
 assert.equal(Object.values(lists).reduce((n,a)=>n+a.length,0),30);
 for(const [field,values] of Object.entries(lists)){
  assert.ok(values.length>=3,field);
  assert.match(client,new RegExp(field+':isChoice'));
  assert.match(sql,new RegExp("p_design->>'"+field+"'"));
  assert.match(map,new RegExp("design\\."+field));
  assert.match(renderer+tiers,new RegExp("(cosmetics\\."+field+"|\\b"+field+"===|\\b"+field+"\\})"));
 }
 assert.deepEqual(safeCosmetics({}),{
  finish:'stone',roof:'gable',ground:'grass',fence:'wood',windows:'classic',
  lights:'warm',door:'wood',path:'gravel',yard:'bench',
 });
});
test('real progress and local preview remain different, scoped, with one-tap editor',()=>{
 assert.match(map,/world\+'\.'\+\(world==='home'\?previewTrack/);
 assert.match(map,/previousCosmeticKey/);
 assert.match(map,/liveView&&verified\?verified.cosmetics:design/);
 assert.match(map,/studioPosition.current/);
 assert.match(map,/buildPosition.current/);
 assert.match(map,/LIVE DESIGN SHOWROOM/);
 assert.match(map,/Visual sample only/);
 assert.match(map,/previewCustomize/);
 assert.match(map,/disabled=\{previewTrack==='lot'&&item.id==='structure'\}/);
 assert.match(renderer,/opacity:reveal/);
 assert.match(map,/save_buklod_estate_design_v1|EstateConstructionConsole/);
 assert.match(sql,/v_door not in/);assert.match(sql,/v_path not in/);assert.match(sql,/v_yard not in/);
});

test('nine customization families cover all 30 choices, apply through the studio, and persist in the server RPC',()=>{
 const lists={finish:FINISHES,roof:ROOFS,ground:GROUNDS,fence:FENCES,windows:WINDOWS,lights:LIGHTS,door:DOORS,path:PATHS,yard:YARDS};
 for(const [field,choices] of Object.entries(lists)){
  for(const option of choices)assert.equal(safeCosmetics({[field]:option})[field],option,field+' '+option);
  assert.equal(safeCosmetics({[field]:'invalid'})[field],safeCosmetics({})[field]);
  assert.match(map,new RegExp(field==='finish'?'previewCustomize\\(\\{finish:next\\}\\)':'previewCustomize\\(\\{'+field+':item.id\\}\\)'));
  assert.match(client,new RegExp(field+':isChoice'));
  assert.match(sql,new RegExp("v_"+field+":=p_design->>'"+field+"'"));
 }
 assert.match(map,/visualDesign:EstateCosmetics=liveView&&verified\?verified.cosmetics:design/);
 assert.match(map,/setLiveView\(false\)/);
 assert.match(sql,/Unsupported cosmetic choice/);
});
