import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const read=p=>readFileSync(join(root,p),'utf8');
const engine=await import('../src/features/season2/world/worldWorkshopEngine.ts');
const {newWorkshop,restoreWorkshop,buildRequirements,buildWorkshopStage,startWorkshopGather,gatherTarget,chooseWorkshopGather,customizeWorkshop,visualPhaseForWorkshop}=engine;

test('one-tap approved My Home goes to guarded Season 2 map, while Bahay stays accessible',()=>{
 const metadata=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
 assert.equal(metadata.hotspots.find(x=>x.id==='my-home').route,'/season2/my-world');
 for(const route of ['my-world','community-village']){
  const path='src/app/season2/'+route+'.tsx';
  assert.ok(existsSync(join(root,path)));
  const text=read(path);
  for(const token of ['isGenesisPreviewBuild','requiresAcceptance','maintenance_mode','update_required','pilot_access_required','!session','!profile'])assert.ok(text.includes(token),token);
 }
 const canvas=read('src/features/season2/world/Season2DevelopmentMap.tsx');
 for(const token of ['buklod-my-home-stage1.webp','buklod-community-village-stage1.webp','WorldConstructionDiorama','useSafeAreaInsets','router.push(route as any)'])assert.ok(canvas.includes(token),token);
 assert.doesNotMatch(canvas,/(?:supabase\.from|supabase\.rpc|mintBP|awardBP|withdrawQMP)/i);
});

test('complete facilities remain permissioned and discoverable without invented live services',async()=>{
 const {communityFacilitySummary,listCommunityFacilities}=await import('../src/features/season2/world/communityFacilityDirectory.mjs');
 const home=communityFacilitySummary('home',false);
 const village=communityFacilitySummary('village',false);
 assert.ok(home.total>=30);
 assert.ok(village.total>=90);
 assert.equal(home.linked+home.planned,home.total);
 const planned=listCommunityFacilities({world:'home',query:'co-ownership'});
 assert.ok(planned.length>0&&planned.every(x=>x.route===null&&x.status==='planned'));
 assert.equal(listCommunityFacilities({world:'home',zone:'not-a-zone'}).length,0);
 const screen=read('src/features/season2/world/Season2CommunityFacilities.tsx');
 assert.match(screen,/disabled=\{!available\}/);
 assert.match(screen,/router.push\(route as any\)/);
 assert.match(read('src/features/season2/world/Season2DevelopmentMap.tsx'),/Season2CommunityFacilities world=\{world\}/);
});

test('offline work starts at true vacant level zero with strict bounds and no shared entitlement',()=>{
 const w=newWorkshop();
 assert.deepEqual(w.tracks.lot,{level:0,stage:0,mastery:0});
 assert.equal(w.stock.timber,0);
 assert.equal(buildRequirements(w,'lot').stage,1);
 assert.equal(buildWorkshopStage(w,'lot').ok,false);
 const broken=restoreWorkshop({schema:1,tracks:{lot:{level:999,stage:9,mastery:8}},stock:{timber:-4,stone:Infinity,supplies:1e30},rounds:Infinity});
 assert.deepEqual(broken.tracks.lot,{level:0,stage:0,mastery:0});
 assert.deepEqual(broken.stock,{timber:0,stone:0,supplies:0});
});

test('construction silhouette never degrades when a stage completes or resets',()=>{
 let last=0;
 for(let level=0;level<=10;level++){
  for(let stage=0;stage<=4;stage++){
   const phase=visualPhaseForWorkshop({level,stage,mastery:0});
   assert.ok(phase>=last, 'visual regression at level '+level+', stage '+stage);
   last=phase;
  }
 }
 assert.equal(visualPhaseForWorkshop({level:0,stage:0,mastery:0}),0);
 assert.equal(visualPhaseForWorkshop({level:1,stage:0,mastery:0}),1);
 assert.equal(visualPhaseForWorkshop({level:10,stage:0,mastery:5}),5);
 const svg=read('src/features/season2/world/WorldConstructionDiorama.tsx');
 assert.match(svg,/const stage=visualPhaseForWorkshop\(progress\)/);
 assert.match(svg,/progress.stage>=4/);
});

test('three-choice hunt respects a correct combo and never mints remote BP',()=>{
 let w=startWorkshopGather(newWorkshop(),'stone');
 for(let i=0;i<3;i++){
  const target=gatherTarget(w.gathering);
  const outcome=chooseWorkshopGather(w,target);
  assert.equal(outcome.correct,true);
  w=outcome.state;
  if(i<2)assert.equal(outcome.completed,false);
  else assert.equal(outcome.completed,true);
 }
 assert.ok(w.stock.stone>=8);
 assert.equal(w.gathering,null);
 let w2=startWorkshopGather(w,'timber');
 const wrong=(gatherTarget(w2.gathering)+1)%3;
 const failed=chooseWorkshopGather(w2,wrong);
 assert.equal(failed.correct,false);
 assert.equal(failed.state.gathering.step,0);
});

test('Lot, House, Community advance separately through fifty sequential steps and endless Mastery',()=>{
 let w=newWorkshop();
 const fill=()=>({ ...w,stock:{timber:1000000,stone:1000000,supplies:1000000}});
 w=fill();
 for(let step=0;step<50;step++){
  const result=buildWorkshopStage(w,'house');
  assert.equal(result.ok,true,'house build step '+step);
  w=result.state;
 }
 assert.equal(w.tracks.house.level,10);
 assert.equal(w.tracks.house.stage,0);
 assert.equal(w.tracks.lot.level,0);
 assert.equal(w.tracks.cluster.level,0);
 w=fill();
 for(let i=0;i<5;i++)w=buildWorkshopStage(w,'house').state;
 assert.equal(w.tracks.house.level,10);
 assert.equal(w.tracks.house.mastery,1);
 assert.equal(w.tracks.house.stage,0);
 assert.equal(w.tracks.lot.mastery,0);
});

test('building deducts local resources and cosmetic choices remain per-world',()=>{
 let w=newWorkshop();
 const price=buildRequirements(w,'lot').need;
 w={...w,stock:{timber:price.timber,stone:price.stone,supplies:price.supplies}};
 const r=buildWorkshopStage(w,'lot');assert.equal(r.ok,true);
 assert.equal(r.state.tracks.lot.stage,1);
 assert.deepEqual(r.state.stock,{timber:0,stone:0,supplies:0});
 const next=customizeWorkshop(r.state,'home',{style:'tropical',sky:'dawn',decor:'pond'});
 assert.equal(next.cosmetics.home.style,'tropical');
 assert.equal(next.cosmetics.village.style,'classic');
});
