import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
