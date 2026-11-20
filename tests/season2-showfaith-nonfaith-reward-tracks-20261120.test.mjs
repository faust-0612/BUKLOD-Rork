import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {S2_RULES} from '../src/lib/season2/buklodSeason2RewardContractR1.ts';
import {
 S2_TRACK_ROLLOUT,S2_TRACKS,S2_TRACK_SOURCES,S2_TRACK_LEARNING_BP,
 S2_TRACK_BADGE_PREVIEWS,S2_TRACK_SEASONAL_AWARD_VARIANTS,S2_BOTH_TRACK_LIMITS,S2_SHARED_FINANCIAL_POLICY,
 previewTrackForScope,previewS2TrackEvidence,previewS2TrackFoundation,
 sourceAvailableInTrack,sourceKeyAcrossTracks,
} from '../src/lib/season2/buklodSeason2RewardTracksR1.ts';

const uid='synthetic-user',scopeFaith={scope_id:'faith-scope',show_faith_content:true,scope_status:'ACTIVE'};
const scopeNon={scope_id:'nonfaith-scope',show_faith_content:false,scope_status:'ACTIVE'};
const receipt=(scope,source,sourceId,extras={})=>({
 userId:uid,scopeId:scope.scope_id,source,sourceId,
 scopeModeAtEvent:scope.show_faith_content?'show_faith':'non_show_faith',
 serverVerified:true,accepted:true,originalEventTimeVerified:true,
 memberOfScopeAtEvent:true,isMainApp:true,...extras,
});

test('source-only: all grants disabled, Season1 BP/QMP/cash cannot change',()=>{
 assert.deepEqual(Object.values(S2_TRACK_ROLLOUT),Object.values(S2_TRACK_ROLLOUT).map(()=>false));
 assert.equal(S2_SHARED_FINANCIAL_POLICY.qmpRatesUnchanged,true);
 assert.equal(S2_SHARED_FINANCIAL_POLICY.earningsPoolUnchanged,true);
 assert.equal(S2_SHARED_FINANCIAL_POLICY.neverSplitOrMultiplyOriginalQmp,true);
 assert.equal(S2_BOTH_TRACK_LIMITS.oneBPWallet,true);
 assert.equal(S2_BOTH_TRACK_LIMITS.oneTokenWalletAcrossTracks,true);
});
test('all eleven S2 receipt kinds agree with original reward contract and token limits',()=>{
 assert.deepEqual(Object.keys(S2_TRACK_SOURCES).sort(),Object.keys(S2_RULES).sort());
 for(const kind of Object.keys(S2_RULES)){
  const a=S2_RULES[kind],b=S2_TRACK_SOURCES[kind];
  assert.equal(b.mode,a.mode,kind);
  assert.equal(b.tokens,a.tokens,kind);
  assert.equal(b.dailyCount,a.dailyLimit,kind);
 }
 assert.equal(Object.values(S2_TRACK_SOURCES).filter(x=>x.mode==='both').reduce((n,x)=>n+x.tokens*x.dailyCount,0),9);
 assert.equal(S2_BOTH_TRACK_LIMITS.globalDailyTokenCeiling,12);
});
test('private prayer and children never mint cash/tokens; faith-only does not leak',()=>{
 assert.equal(S2_TRACK_SOURCES.private_prayer.tokens,0);
 assert.equal(S2_TRACK_SOURCES.private_prayer.creditForFoundation,false);
 assert.equal(S2_TRACK_SOURCES.children_story_milestone.tokens,0);
 assert.equal(sourceAvailableInTrack('private_prayer','non_show_faith'),false);
 assert.equal(sourceAvailableInTrack('formation_verified_unit','non_show_faith'),false);
 assert.equal(sourceAvailableInTrack('main_bible_qualified_quiz','non_show_faith'),false);
 assert.equal(sourceAvailableInTrack('general_learning_verified_unit','show_faith'),false);
 assert.equal(sourceAvailableInTrack('community_verified_challenge','show_faith'),false);
 for(const track of ['show_faith','non_show_faith']){
  assert.equal(sourceAvailableInTrack('kl_verified_chapter',track),true);
  assert.equal(sourceAvailableInTrack('wall_original_post',track),true);
 }
});
test('scope-derived track is fail-closed on absent or suspended scope; no member mode toggle',()=>{
 assert.equal(previewTrackForScope(null),null);
 assert.equal(previewTrackForScope({scope_id:'x',show_faith_content:null}),null);
 assert.equal(previewTrackForScope({scope_id:'x',show_faith_content:undefined}),null);
 assert.equal(previewTrackForScope({...scopeFaith,scope_status:'SUSPENDED'}),null);
 assert.equal(previewTrackForScope(scopeFaith),'show_faith');
 assert.equal(previewTrackForScope(scopeNon),'non_show_faith');
});
test('faith and nonfaith mission IDs and badge names are distinct, NOT issued',()=>{
 assert.notEqual(S2_TRACKS.show_faith.missionKey,S2_TRACKS.non_show_faith.missionKey);
 assert.notEqual(S2_TRACKS.show_faith.weeklyBadgePreview,S2_TRACKS.non_show_faith.weeklyBadgePreview);
 assert.equal(S2_TRACK_BADGE_PREVIEWS.length,6);
 assert.equal(new Set(S2_TRACK_BADGE_PREVIEWS.map(x=>x.key)).size,6);
 for(const x of S2_TRACK_BADGE_PREVIEWS){
  assert.equal(x.status,'PREVIEW_NOT_LIVE');
  assert.equal(x.bp,0);assert.equal(x.tokens,0);
 }
});
test('faith legacy and proposed nonfaith learning opportunities are matched but never granted',()=>{
 const f=S2_TRACK_LEARNING_BP.show_faith,n=S2_TRACK_LEARNING_BP.non_show_faith;
 assert.equal(f.length,6);assert.equal(n.length,6);
 assert.deepEqual(f.map(x=>[x.comparisonKey,x.bp]),n.map(x=>[x.comparisonKey,x.bp]));
 assert.ok(f.every(x=>x.activeLegacyCatalog&&!x.backendVerifierReady));
 assert.ok(n.every(x=>!x.activeLegacyCatalog&&!x.backendVerifierReady&&x.ruleStatus==='PROPOSED_NOT_LIVE'));
});
test('four canonical award IDs remain four, with distinct mode variants but no extra grants',()=>{
 const f=S2_TRACK_SEASONAL_AWARD_VARIANTS.show_faith;
 const n=S2_TRACK_SEASONAL_AWARD_VARIANTS.non_show_faith;
 assert.equal(f.length,4);assert.equal(n.length,4);
 assert.deepEqual(f.map(x=>x.key),n.map(x=>x.key));
 assert.deepEqual(f.map(x=>x.key),[
  'beacon_trail_frame','maker_ribbon','alliance_crest','constellation_finale_scene'
 ]);
 assert.notDeepEqual(f.map(x=>x.variant),n.map(x=>x.variant));
 for(const x of [...f,...n]){
  assert.equal(x.bp,0);assert.equal(x.tokens,0);
  assert.equal(x.status,'PREVIEW_NOT_LIVE');
 }
});
test('unverified or spoofed context never generates BP or Tokens',()=>{
 for(const row of [
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k'),null,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k'),scopeNon,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{scopeModeAtEvent:'non_show_faith'}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{serverVerified:false}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{memberOfScopeAtEvent:false}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{originalEventTimeVerified:false}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{isMainApp:false}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'kl_verified_chapter','k',{userId:'attacker'}),scopeFaith,uid),
  previewS2TrackEvidence(receipt(scopeFaith,'private_prayer','p'),scopeFaith,uid),
 ]){
  assert.equal(row.creditedTokens,0);assert.equal(row.bonusBP,0);
  assert.equal(row.eligibleForPreview,false);
 }
});
test('a source ID never creates a second credit when the member changes scopes',()=>{
 const a=sourceKeyAcrossTracks(uid,'wall_original_post','same-source');
 const b=sourceKeyAcrossTracks(uid,'wall_original_post','same-source');
 assert.equal(a,b);
 const seen=new Set([a]);
 const result=previewS2TrackEvidence(receipt(scopeNon,'wall_original_post','same-source'),scopeNon,uid,seen);
 assert.equal(result.eligibleForPreview,false);
 assert.equal(result.reason,'INACTIVE_SOURCE');
 assert.equal(result.creditedTokens,0);
});
test('same receipt cannot satisfy learning and social; both tracks require two distinct eligible events',()=>{
 const forTrack=(scope,sources)=>previewS2TrackFoundation({
  weekStartManila:'2026-12-07',viewerUserId:uid,scopeId:scope.scope_id,
  track:scope.show_faith_content?'show_faith':'non_show_faith',
  scope,sources,
 });
 for(const scope of [scopeFaith,scopeNon]){
  const p=forTrack(scope,[receipt(scope,'kl_verified_chapter','one'),receipt(scope,'wall_original_post','two')]);
  assert.equal(p.completePreview,true);assert.equal(p.live,false);
  assert.equal(p.creditedTokens,0);
  const missing=forTrack(scope,[receipt(scope,'wall_original_post','two')]);
  assert.equal(missing.completePreview,false);
 }
});
test('nonfaith mission is NOT completed by a faith-only source',()=>{
 const p=previewS2TrackFoundation({
  weekStartManila:'2026-12-07',viewerUserId:uid,scopeId:scopeNon.scope_id,track:'non_show_faith',scope:scopeNon,
  sources:[receipt(scopeNon,'formation_verified_unit','f'),receipt(scopeNon,'wall_original_post','p')],
 });
 assert.equal(p.learning,false);assert.equal(p.community,true);
 assert.equal(p.completePreview,false);
});
test('wrong-scope and scope switch cannot move an old mission claim into new track',()=>{
 const p=previewS2TrackFoundation({
  weekStartManila:'2026-12-07',viewerUserId:uid,scopeId:scopeFaith.scope_id,track:'show_faith',scope:scopeNon,
  sources:[receipt(scopeFaith,'kl_verified_chapter','x'),receipt(scopeFaith,'wall_original_post','y')]
 });
 assert.equal(p.scopeTrackMatched,false);assert.equal(p.completePreview,false);
});
test('SQL candidate is fail-closed: no exposed API, no payout, no mode edits',()=>{
 const sql=readFileSync(new URL('../docs/season2/sql/BUKLOD_S2_FAITH_NONFAITH_TRACKS_DRAFT_NOT_DEPLOY.sql',import.meta.url),'utf8').toLowerCase();
 assert.match(sql,/check\(not enabled\)/);
 assert.match(sql,/check\(not server_event_mode_verified\)/);
 assert.match(sql,/check\(not approved_server_settlement\)/);
 assert.match(sql,/reward_track_evidence_use/);
 assert.match(sql,/receipt_id bigint primary key/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/enable row level security/);
 assert.doesNotMatch(sql,/security definer|grant execute on function|grant (?:insert|update|delete) .* to authenticated/);
 assert.match(sql,/foreign key\(receipt_id,user_id\) references buklod_s2\.source_receipt\(id,user_id\)/);
 assert.match(sql,/foreign key\(receipt_id,user_id\) references buklod_s2\.reward_track_attribution\(receipt_id,user_id\)/);
 assert.match(sql,/on delete cascade/);
 assert.doesNotMatch(sql,/references auth\.users\(id\) on delete restrict/);
 assert.match(sql,/do not apply to production/);
});
test('member UI renders scope-specific rules, informational comparison only',()=>{
 const ui=readFileSync(new URL('../src/components/points/BuklodS2RewardTracksGuide.tsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/components/points/BuklodS2CompleteRewardsReference.tsx',import.meta.url),'utf8');
 assert.match(ui,/useBuklodScope\(\)/);
 assert.match(ui,/previewTrackForScope\(activeScope\)/);
 assert.match(ui,/comparison\?\['show_faith','non_show_faith'\]/);
 assert.match(ui,/REWARDS NOT LIVE/);
 assert.match(parent,/useState<Tab>\('tracks'\)/);
 assert.match(parent,/tab==='tracks'\?<BuklodS2RewardTracksGuide\/>/);
 assert.doesNotMatch(ui,/supabase|\.rpc\s*\(/);
});
