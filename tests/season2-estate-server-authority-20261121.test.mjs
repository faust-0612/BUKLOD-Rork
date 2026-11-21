import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 constructionPlan,nextMilestone,safeCosmetics,safeMastery,visualDevelopmentFeatures,
} from '../src/features/season2/world/constructionPlan.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261121134500_buklod_estate_authoritative_progression_v1.sql');
const screen=read('src/features/season2/world/Season2DevelopmentMap.tsx');
const consoleSource=read('src/features/season2/world/EstateConstructionConsole.tsx');
const api=read('src/features/season2/world/estateProgressClient.ts');
const drawing=read('src/features/season2/world/DevelopmentStructurePreview.tsx');

test('all three estate tracks have five stages and harder but bounded Mastery milestones',()=>{
 for(const track of ['lot','house','cluster']){
  const early=constructionPlan(track,1,0,0);
  const late=constructionPlan(track,10,4,0);
  const master100=constructionPlan(track,10,4,100);
  const master10000=constructionPlan(track,10,4,10000);
  assert.ok(late.estimatedDevelopmentXp>early.estimatedDevelopmentXp);
  assert.ok(master100.estimatedDevelopmentXp>late.estimatedDevelopmentXp);
  assert.ok(master10000.estimatedDevelopmentXp>master100.estimatedDevelopmentXp);
  assert.ok(master10000.estimatedBuildMinutes<20000,'effort grows gradually and remains feasible');
  for(let level=1;level<=10;level++)for(let stage=0;stage<5;stage++){
   const plan=constructionPlan(track,level,stage);
   assert.ok(Number.isSafeInteger(plan.estimatedTimber));
   assert.equal(plan.cannotCommitClientSide,true);
   assert.equal(visualDevelopmentFeatures(track,level,4).length,level);
  }
 }
 assert.deepEqual(nextMilestone(10,4,99),{level:10,stage:0,mastery:100});
 assert.deepEqual(nextMilestone(10,0,100),{level:10,stage:1,mastery:100});
 assert.equal(visualDevelopmentFeatures('lot',10,0,100).length,10);
 assert.equal(safeMastery(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);
});
test('nine-part customization rejects unknown values and retains approved styles',()=>{
 assert.deepEqual(safeCosmetics({finish:'bad',roof:'bad',ground:'bad',fence:'bad',windows:'bad',lights:'bad'}),{
  finish:'stone',roof:'gable',ground:'grass',fence:'wood',windows:'classic',lights:'warm',door:'wood',path:'gravel',yard:'bench',
 });
 assert.deepEqual(safeCosmetics({finish:'light',roof:'terrace',ground:'stone',fence:'hedge',windows:'panorama',lights:'garden'}),{
  finish:'light',roof:'terrace',ground:'stone',fence:'hedge',windows:'panorama',lights:'garden',door:'wood',path:'gravel',yard:'bench',
 });
 for(const symbol of ['cosmetics.fence','cosmetics.windows','cosmetics.lights','cosmetics.door','cosmetics.path','cosmetics.yard'])
  assert.ok(drawing.includes(symbol),symbol);
});
test('read and write paths require server authority and preserve household isolation',()=>{
 assert.match(screen,/EstateConstructionConsole/);
 assert.match(screen,/earnedByProperty/);
 assert.match(screen,/liveView&&verified/);
 assert.match(screen,/BLUEPRINT/);
 assert.match(screen,/PanResponder/);
 assert.match(screen,/pan.getTranslateTransform/);
 assert.match(screen,/router.push\(door.route as any\)/);
 assert.match(api,/server_verified!==true/);
 assert.match(api,/owner_id!==id.ownerId/);
 assert.match(api,/start_buklod_estate_construction_v1/);
 assert.match(api,/complete_buklod_estate_construction_v1/);
 assert.match(api,/save_buklod_estate_design_v1/);
 assert.match(consoleSource,/if\(!verified\|\|!verified.can_build\)return/);
 assert.match(consoleSource,/pending_key/);
 assert.match(consoleSource,/actionSeq.current/);
 assert.match(consoleSource,/inFlight.current/);
 assert.match(consoleSource,/if\(startKey.current===operationKey\)/);
 assert.match(consoleSource,/enoughEstateMaterials/);
 assert.match(read('src/components/home/BuklodPersonalHomeE2E.tsx'),/BuklodBahayHome/);
});
test('database migration protects resources, debits atomically and denies client grants',()=>{
 for(const table of ['buklod_estate_wallet_v1','buklod_estate_progress_v1','buklod_estate_event_v1','buklod_estate_build_v1']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(sql,/revoke all on public.buklod_estate_wallet_v1/);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete|all) on public\.buklod_estate_wallet_v1 to authenticated/i);
 assert.match(sql,/get_buklod_estate_snapshot_v1/);
 assert.match(sql,/buklod_estate_private.allowed/);
 assert.match(sql,/membership_status='ACTIVE'/);
 assert.match(sql,/lower\(r.role_key\) in/);
 assert.match(sql,/for update/g);
 assert.match(sql,/on conflict\(source_key\) do nothing/);
 assert.match(sql,/operation_key text primary key/);
 assert.match(sql,/if s.pending_key is not null/);
 assert.match(sql,/if s.build_finish_at>now\(\)/);
 assert.match(sql,/award_buklod_estate_resources_v1.*?to service_role/s);
 assert.doesNotMatch(sql,/grant execute on function public.award_buklod_estate_resources_v1.*?to authenticated/i);
 assert.match(sql,/new.claim_state='claimed'/);
 assert.match(sql,/new.direction='credit'/);
 assert.match(sql,/new.activity_type in/);
 assert.match(sql,/scope_attendance/);
 assert.match(sql,/abc_growth_lesson/);
 assert.match(sql,/daily_bible/);
 assert.match(sql,/source_key='scope-donate:'/);
 assert.match(sql,/when s.stage=4 and s.level=10 then s.mastery\+1/);
});
test('server cost quote is reused during debit and never fabricated by the app',()=>{
 assert.match(sql,/create or replace function buklod_estate_private.cost/);
 assert.match(sql,/'next_cost',buklod_estate_private.cost/);
 assert.match(sql,/q:=buklod_estate_private.cost\(p_track,s.level,s.stage,s.mastery\)/);
 assert.match(api,/next_cost:raw.next_cost/);
 assert.match(consoleSource,/verified\?\.next_cost/);
 assert.doesNotMatch(sql,/(?:update|insert into)\s+public\.buklod_points_ledger/i);
});
