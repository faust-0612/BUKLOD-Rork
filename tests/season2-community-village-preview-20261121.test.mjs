import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const world=read('src/features/season2/world/Season2DevelopmentMap.tsx');
const guard=read('src/features/season2/world/GuardedSeason2DevelopmentWorld.tsx');
const village=read('src/app/season2/community-village.tsx');
const home=read('src/app/season2/my-world.tsx');
const hotspots=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
const entry=read('src/app/buklod-map.tsx');

test('Community Village and My Home have distinct in-app one-tap routes from approved art',()=>{
 assert.ok(existsSync(resolve(root,'src/app/season2/community-village.tsx')));
 assert.ok(existsSync(resolve(root,'src/app/season2/my-world.tsx')));
 assert.equal(hotspots.hotspots.find(x=>x.id==='community-village').route,'/season2/community-village');
 assert.equal(hotspots.hotspots.find(x=>x.id==='my-home').route,'/season2/my-world');
 assert.match(entry,/<GenesisApprovedEntryMap/);
 assert.match(entry,/router\.push\(route as any\)/);
 assert.match(village,/world="village"/);
 assert.match(home,/world="home"/);
});

test('Separate premium nature scenes preserve real member service destinations',()=>{
 for(const art of ['buklod-community-village-stage1.webp','buklod-my-home-stage1.webp'])
  assert.ok(world.includes(art),art);
 for(const id of ['lot','house','garden','cluster','org','market','bayanihan'])
  assert.ok(world.includes("id:'"+id+"'"),id);
 for(const route of ['/personal-home','/clusters','/profile/buklod-market'])
  assert.ok(world.includes("route:'"+route+"'"),route);
 assert.match(world,/doors\.map/);
 assert.match(world,/router\.push\(door\.route as any\)/);
 assert.equal(hotspots.hotspots.length,12);
});

test('Five progressive construction stages and independent Levels 1–10 are preview only',()=>{
 for(const label of ['Materials','Posts / Foundation','Framework','Structure','Finishing'])
  assert.ok(world.includes(label),label);
 assert.match(world,/clampDevelopmentLevel/);
 assert.match(world,/previewLevels,setPreviewLevels/);
 assert.match(world,/previewStages,setPreviewStages/);
 assert.match(world,/visual previews only/);
 assert.doesNotMatch(world,/(?:supabase|service_role|\.rpc\(|awardBp|claimBp|awardDiamond|sendBp|withdraw|fetch\()/i);
});

test('World deep links enforce login, consent, update, pilot and onboarding',()=>{
 for(const token of ['!isGenesisPreviewBuild()','!session','requiresAcceptance','maintenance_mode',
  'update_required','pilot_access_required','!profile','onboarding'])
  assert.ok(guard.includes(token),token);
 assert.match(world,/router\.replace\('\/buklod-map'/);
 assert.match(world,/getDevelopmentAsset/);
 assert.doesNotMatch(guard,/(?:supabase|awardBp|claimBp|withdraw|\.rpc\()/i);
});
