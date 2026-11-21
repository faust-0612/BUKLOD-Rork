import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {COMMUNITY_FACILITY_ZONES,getCommunityZones,listCommunityFacilities,communityFacilitySummary} from '../src/features/season2/world/communityFacilityDirectory.mjs';
const source=p=>readFileSync(join(process.cwd(),p),'utf8');

test('complete community coverage stays partitioned by real village and personal home',()=>{
  const village=communityFacilitySummary('village');
  const home=communityFacilitySummary('home');
  assert.ok(village.total>=100);
  assert.ok(home.total>=30);
  assert.equal(village.linked+village.planned,village.total);
  assert.equal(home.linked+home.planned,home.total);
  assert.ok(COMMUNITY_FACILITY_ZONES.length>=15);
  assert.equal(listCommunityFacilities({world:'village',showFaith:true}).find(x=>x.id==='prayer').route,null);
  assert.deepEqual(listCommunityFacilities({world:'unknown'}),[]);
  const ids=new Set();
  for(const f of [...listCommunityFacilities({world:'village'}),...listCommunityFacilities({world:'home'})]){
    assert.ok(!ids.has(f.id),'duplicate community ID: '+f.id);
    ids.add(f.id);
    assert.equal(f.status==='linked',Boolean(f.route));
    if(f.route)assert.match(f.route,/^\/(?!\/)[a-z0-9/\-]+$/);
    assert.doesNotMatch(f.route??'',/admin|system|withdraw|delete-account/i);
  }
});
test('planned facilities never impersonate operational features or route into economy',()=>{
  for(const term of ['bridge','recycling','cooperative','property','treasury']){
    const results=listCommunityFacilities({world:'village',query:term});
    assert.ok(results.length>0,term+' missing');
    assert.ok(results.some(f=>f.status==='planned'&&f.route===null),term+' route unexpectedly active');
  }
  assert.equal(listCommunityFacilities({world:'village',query:'roads'}).length,1);
  assert.equal(listCommunityFacilities({world:'village',query:'roads'})[0].route,null);
  assert.equal(listCommunityFacilities({world:'village',query:'marketplace'})[0].route,'/profile/buklod-market');
});
test('faith-off results exclude faith-only membership hints but preserve all generic education',()=>{
  const off=listCommunityFacilities({world:'village',showFaith:false});
  const on=listCommunityFacilities({world:'village',showFaith:true});
  assert.ok(on.length>off.length);
  assert.ok(off.every(f=>!f.faithOnly));
  assert.ok(on.some(f=>f.id==='faith'));
  assert.ok(off.some(f=>f.id==='learning'));
  assert.ok(off.some(f=>f.id==='children'));
  assert.equal(getCommunityZones('home',false).length,4);
});
test('search, category isolation, bounds, and empty queries are deterministic',()=>{
  const all=listCommunityFacilities({world:'village'});
  assert.equal(listCommunityFacilities({world:'village',query:'  '} ).length,all.length);
  const results=listCommunityFacilities({world:'village',zone:'infrastructure',query:'street'});
  assert.equal(results.length,1);assert.equal(results[0].id,'streetlights');
  assert.equal(listCommunityFacilities({world:'home',zone:'infrastructure'}).length,0);
  assert.deepEqual(listCommunityFacilities({world:'village',query:'unlikely-random-string-xyz'}),[]);
  assert.deepEqual(listCommunityFacilities({world:'village',query:'x'.repeat(500)}),[]);
});
test('optional directory adds linked one-tap access without modifying approved entry art or authorities',()=>{
  const world=source('src/features/season2/world/Season2DevelopmentMap.tsx');
  const directory=source('src/features/season2/world/Season2CommunityFacilities.tsx');
  const guide=source('src/features/season2/world/guideDestinations.ts');
  const map=source('src/app/buklod-map.tsx');
  assert.match(world,/<Season2CommunityFacilities world=\{world\}\/>/);
  assert.ok(world.indexOf('<Season2CommunityFacilities')>world.indexOf('styles.mapNote'));
  assert.match(directory,/expanded\?listCommunityFacilities/);
  assert.match(directory,/if\(!route\)return/);
  assert.match(directory,/now-lastNavigation\.current<650/);
  assert.match(directory,/results\.slice\(0,limit\)/);
  assert.match(directory,/maxLength=\{80\}/);
  assert.match(guide,/kalsada\|tulay\|bridge/);
  assert.match(map,/GenesisValleyMap/);
  assert.doesNotMatch(directory,/(supabase|awardPoints|mintBp|spendBp|service_role|withdrawQMP)/i);
  assert.doesNotMatch(world,/Season2CommunityFacilities.*(?:mintBp|spendBp)/);
});

test('Learning Grove resolves a previously missing map route without exposing restricted/faith screens',()=>{
 const learning=source('src/app/learn/index.tsx');
 assert.match(learning,/isGenesisPreviewBuild\(\)/);
 assert.match(learning,/requiresAcceptance/);
 assert.match(learning,/!session/);
 assert.match(learning,/faithOnly.*showFaith/);
 assert.match(learning,/\/profile\/focus-apps/);
 assert.match(learning,/\/children-stories/);
 assert.doesNotMatch(learning,/(supabase\.from|supabase\.rpc|mintBp|awardPoints|spendBp)/i);
});

test('guide differentiates health, public services, infrastructure and faith without dead doors',async()=>{
 const {resolveBuklodGuideDestination}=await import('../src/features/season2/world/guideDestinations.ts');
 const cases=[
  ['health center',false,'/profile/buklod-health'],
  ['kalusugan',false,'/profile/buklod-health'],
  ['gobyerno',false,'/profile/focus-apps'],
  ['kalsada',false,'/season2/community-village'],
  ['tulay',false,'/season2/community-village'],
  ['Bible verse',false,'/learn'],
  ['Bible verse',true,'/bible'],
 ];
 for(const [input,faith,expected] of cases)assert.equal(resolveBuklodGuideDestination(input,faith).route,expected,input);
});
