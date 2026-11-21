import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const source = path => readFileSync(join(process.cwd(),path),'utf8');
test('new community and home destinations use separate, staged, one-tap routes',()=>{
  const map=JSON.parse(source('src/features/season2/genesis/genesisValleyHotspots.json'));
  const village=map.hotspots.find(x=>x.id==='cluster-village');
  const home=map.hotspots.find(x=>x.id==='family-homes');
  const arena=map.hotspots.find(x=>x.id==='empire-arena');
  const kingdom=map.hotspots.find(x=>x.id==='character-kingdom');
  assert.equal(village.route,'/season2/community-village');
  assert.equal(home.route,'/season2/my-world');
  assert.equal(arena.route,'/games/empire-arena');
  assert.equal(kingdom.route,'/games');
  assert.notEqual(arena.route,kingdom.route);
  for(const p of ['src/app/season2/my-world.tsx','src/app/season2/community-village.tsx'])
    assert.match(source(p),/isGenesisPreviewBuild\(\)/);
  assert.match(source('src/features/season2/world/Season2DevelopmentMap.tsx'),
    /onPress=\{\(\)=>router\.push\(door\.route as any\)\}/);
});
test('character guide is out of image, not an overlay over landmarks',()=>{
  const map=source('src/app/buklod-map.tsx');
  assert.ok(map.indexOf('</ScrollView>')<map.indexOf('<BuklodMapGuideDock'));
  assert.match(source('src/features/season2/world/BuklodMapGuideDock.tsx'),/isReduceMotionEnabled/);
  assert.match(map,/BuklodFirstViewAd/);
});
test('construction remains visual-only and user-scoped, not a reward ledger',()=>{
  const map=source('src/features/season2/world/Season2DevelopmentMap.tsx');
  for(const name of ['Materials','Posts / Foundation','Framework','Structure','Finishing'])assert.ok(map.includes(name));
  assert.match(map,/Math\.min\(10,Math\.max\(1/);
  assert.match(map,/world-look\.\x27\+ownerId/);
  assert.ok(!/(mintBp|awardPoints|spendBp|supabase\.from\()/i.test(map));
  assert.ok(map.includes("elesur-village-builder")&&map.includes("phan-enterprise-builder"));
  assert.match(map,/visual previews only/);
});

test('premium Village and My Home backing landscapes have pinned bytes',()=>{
  for(const [path,bytes,digest] of [
    ['assets/season2/genesis/world/buklod-community-village-stage1.webp',398830,'0538c6998152c1fd7a09f61b1d95ae283ba330ae1b92a8c4b4970179c5bc9972'],
    ['assets/season2/genesis/world/buklod-my-home-stage1.webp',225624,'149c8441f3c164cbf1b135885a33a187fcb8ded04932e26b489635749930c5ce'],
  ]){
    const data=readFileSync(join(process.cwd(),path));
    assert.equal(data.length,bytes);
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(createHash('sha256').update(data).digest('hex'),digest);
  }
  const map=source('src/features/season2/world/Season2DevelopmentMap.tsx');
  assert.match(map,/buklod-community-village-stage1.webp/);
  assert.match(map,/buklod-my-home-stage1.webp/);
});
test('independent Lot House Cluster catalogs and local previews do not conflate reward authority',()=>{
  const manifest=source('src/features/season2/world/developmentAssetManifest.ts');
  const map=source('src/features/season2/world/Season2DevelopmentMap.tsx');
  for(const prefix of ["lot:'LOT'","house:'HOU'","cluster:'COM'"])assert.ok(manifest.includes(prefix));
  assert.match(map,/previewLevels,setPreviewLevels/);
  assert.match(map,/previewStages,setPreviewStages/);
  assert.match(map,/getDevelopmentAsset\(previewTrack,level\)/);
  assert.match(manifest,/stagingStatus:'catalog-only'/);
  assert.doesNotMatch(map,/(?:supabase\.from|supabase\.rpc|mintBP|awardBP|claimBp|withdrawQMP)/i);
});
test('landscape first view preserves map and ad side-by-side; guide has local help',()=>{
  const entry=source('src/app/buklod-map.tsx');
  const guide=source('src/features/season2/world/BuklodMapGuideDock.tsx');
  assert.match(entry,/landscapeFirstRow/);
  assert.match(entry,/landscapeAdColumn/);
  assert.match(entry,/new_home_first_view/);
  assert.match(guide,/resolveBuklodGuideDestination/);
  assert.match(guide,/TextInput/);
  assert.match(guide,/isReduceMotionEnabled/);
});

test('real offline guide routes Filipino/English requests without transmitting messages',async()=>{
 const {resolveBuklodGuideDestination}=await import('../src/features/season2/world/guideDestinations.ts');
 const cases=[
  ['Gusto kong magpost sa Wall',false,'/buklod'],
  ['Paano lumaban sa Empire Arena?',false,'/games/empire-arena'],
  ['Anong kailangan sa Cluster?',false,'/season2/community-village'],
  ['Bahay at lote ko',false,'/season2/my-world'],
  ['Bible reading',false,'/learn'],
  ['Bible reading',true,'/bible'],
  ['Mag-message at call',false,'/messages'],
  ['QMP points and rewards',false,'/points/progression'],
  ['Unknown question',false,'/buklod-map'],
 ];
 for(const [question,faith,route] of cases)assert.equal(resolveBuklodGuideDestination(question,faith).route,route,question);
});
test('real BUKLOD V2 30-level catalog has independent correct keys and safe clamping',async()=>{
 const {DEVELOPMENT_ASSET_CATALOG,getDevelopmentAsset}=await import('../src/features/season2/world/developmentAssetManifest.ts');
 assert.equal(DEVELOPMENT_ASSET_CATALOG.length,30);
 assert.equal(new Set(DEVELOPMENT_ASSET_CATALOG.map(x=>x.assetId)).size,30);
 const keys={lot:'LOT',house:'HOU',cluster:'COM'};
 for(const [track,prefix] of Object.entries(keys)){
  const levels=DEVELOPMENT_ASSET_CATALOG.filter(x=>x.track===track);
  assert.equal(levels.length,10);
  for(let level=1;level<=10;level++){
   const entry=getDevelopmentAsset(track,level);
   assert.equal(entry.assetId,prefix+'_L'+String(level).padStart(2,'0'));
   assert.match(entry.catalogPath,/^buklod_assets\/png\//);
   assert.equal(entry.stagingStatus,'catalog-only');
  }
  assert.equal(getDevelopmentAsset(track,-1).level,1);
  assert.equal(getDevelopmentAsset(track,999).level,10);
 }
});
