import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEASON_V2_ROLLOUT,SEASON_CHAPTER_PREVIEWS,SEASON_JOURNEY_TRACKS,
  deriveBuklodSeasonState,manilaCalendarDay,previewSeasonNotice,
  canClientFinalizeOrDeleteSeason} from '../src/lib/buklodSeasonJourneyR2.ts';
const S={id:'season-1',number:1,title:'BUKLOD Season 1',
  starts_on:'2026-08-01',ends_on:'2026-10-31',points:120};
const plan=(extras={})=>previewSeasonNotice({
  season:S,manilaDay:'2026-07-18',serverSnapshotVerified:true,
  voluntaryOptIn:true,pushAllowed:true,quietHours:false,
  pendingOfflineOperations:false,deliveredKeys:[],...extras,
});
test('read-only visible preview; finalization, reward and push mutations OFF',()=>{
  assert.equal(SEASON_V2_ROLLOUT.readOnlyJourneyPreview,true);
  for(const [name,value] of Object.entries(SEASON_V2_ROLLOUT))
    if(name!=='readOnlyJourneyPreview')assert.equal(value,false,name);
  assert.equal(canClientFinalizeOrDeleteSeason(),false);
});
test('expired active Season 1 is NOT currently live or automatically finalized',()=>{
  const state=deriveBuklodSeasonState(S,'2026-11-18',true);
  assert.equal(state.phase,'ENDED_AWAITING_CLOSE');
  assert.equal(state.progressPercent,100);
  assert.equal(state.rewardEligible,false);
  assert.match(state.label,/unverified/i);
});
test('server schedule produces real countdown but never implied claim eligibility',()=>{
  const x=deriveBuklodSeasonState(S,'2026-07-18',true);
  assert.equal(x.phase,'PREPARATION');
  assert.equal(x.daysUntilStart,14);
  assert.equal(x.rewardEligible,false);
});
test('opening and closing dates inclusive; calendar progression is bounded',()=>{
  const a=deriveBuklodSeasonState(S,'2026-08-01',true);
  const b=deriveBuklodSeasonState(S,'2026-10-31',true);
  assert.equal(a.phase,'LIVE');assert.equal(a.daysRemaining,92);
  assert.equal(b.phase,'LIVE');assert.equal(b.daysRemaining,1);
  assert.equal(b.progressPercent,100);
});
test('no snapshot or no confirmed active Season is not a launch',()=>{
  assert.equal(deriveBuklodSeasonState(S,'2026-09-01',false).phase,'UNVERIFIED');
  assert.equal(deriveBuklodSeasonState(null,'2026-09-01',true).phase,'NO_ACTIVE_SEASON');
  assert.equal(deriveBuklodSeasonState({...S,ends_on:'2026-07-01'},'2026-09-01',true).phase,'INVALID_SEASON');
  assert.equal(deriveBuklodSeasonState({...S,id:''},'2026-09-01',true).phase,'INVALID_SEASON');
});
test('invalid dates fail closed rather than inventing countdown',()=>{
  assert.throws(()=>deriveBuklodSeasonState(S,'2026-02-30',true));
  assert.equal(deriveBuklodSeasonState({...S,starts_on:'2026-13-01'},'2026-09-01',true).phase,'INVALID_SEASON');
});
test('Manila calendar changes at 16:00Z, view-only',()=>{
  assert.equal(manilaCalendarDay(new Date('2026-11-17T15:59:59Z')),'2026-11-17');
  assert.equal(manilaCalendarDay(new Date('2026-11-17T16:00:00Z')),'2026-11-18');
});
test('milestone notices are phase-specific, deterministic, and never delivered',()=>{
  const events=[
    ['2026-07-18','REVEAL_14D'],
    ['2026-07-25','CHOOSE_7D'],
    ['2026-07-29','PREPARE_3D'],
    ['2026-07-31','COUNTDOWN_1D'],
    ['2026-08-01','OPENING'],
    ['2026-10-25','FINAL_WEEK'],
    ['2026-10-31','FINAL_DAY'],
    ['2026-11-01','AWAITING_RESULTS'],
  ];
  for(const [day,stage] of events){
    const n=plan({manilaDay:day});
    assert.equal(n?.stage,stage,day);
    assert.equal(n?.live,false);
    assert.equal(n?.key,'season-v2:season-1:'+stage);
  }
  assert.equal(plan({manilaDay:'2026-07-26'}),null);
});
test('no notifications on missing authority, season, consent or pending offline sync',()=>{
  for(const patch of [
    {serverSnapshotVerified:false},{voluntaryOptIn:false},
    {season:null},{pendingOfflineOperations:true},
  ])assert.equal(plan(patch),null);
});
test('repeated notice keys blocked; quiet hours and denied push respected',()=>{
  assert.equal(plan()?.channel,'push');
  assert.equal(plan({pushAllowed:false})?.channel,'in_app');
  assert.equal(plan({quietHours:true})?.channel,'in_app');
  assert.equal(plan({deliveredKeys:['season-v2:season-1:REVEAL_14D']}),null);
});
test('chapter and track previews have no authoritative unlock or ledger effects',()=>{
  assert.deepEqual(SEASON_CHAPTER_PREVIEWS.map(x=>x.code),[
    'DISCOVER','CREATE','UNITE','FINALE']);
  assert.equal(SEASON_JOURNEY_TRACKS.length,3);
  assert.equal(new Set(SEASON_JOURNEY_TRACKS.map(x=>x.id)).size,3);
});
test('read-only Points integration retains existing RPC and ad placement',()=>{
  const points=readFileSync('src/components/points/BuklodPointsRewardsScreen.tsx','utf8');
  const card=readFileSync('src/components/points/BuklodSeasonJourneyPreview.tsx','utf8');
  assert.match(points,/BuklodSeasonJourneyPreview\s+season=\{rankDashboard\?\.season\s*\?\?\s*null\}/);
  assert.match(points,/verified=\{rankDashboard\s*!==\s*null\}/);
  assert.match(points,/get_my_buklod_rank_dashboard/);
  assert.match(points,/points_redeem_transition_native/);
  assert.match(card,/Preview only — not enrolled/);
  assert.match(card,/Notifications are not enabled by this preview/);
  assert.doesNotMatch(card,/supabase|\.rpc\(|\.insert\(|\.update\(|\.delete\(|setInterval/i);
});
