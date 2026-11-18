import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),g=require('../scripts/season2-governance.cjs');
const p=JSON.parse(fs.readFileSync('contracts/season2-governance.json','utf8'));
const l=JSON.parse(fs.readFileSync('contracts/season2-implementation-ledger.json','utf8'));
const proposal=changes=>({id:'change-owner-123',season:2,changes});
test('complete policy and protected Season1, finances and production',()=>{
 assert.equal(g.validatePolicy(p).ok,true);
 for(const k of ['season1.production_logic','qmp_finance.season_rollover','season2.production_launch'])
   assert.equal(p.decisions[k].severity,'HARD_BOUNDARY');
});
test('aligned instructions pass DEV design only',()=>{
 const x=g.proposalReview(proposal({'seasonal_rank.rollover':'archive_then_reset'}),p);
 assert.equal(x.allowedForDesign,true);assert.equal(x.readyForProduction,false);
});
test('misaligned season rank creates warning and no silent permission',()=>{
 const x=g.proposalReview(proposal({'seasonal_rank.rollover':'retain'}),p);
 assert.equal(x.allowedForDesign,false);assert.equal(x.warnings[0].code,'POLICY_CONFLICT');
});
test('owner approval only counts for reviewed matching SHA256 digest and keys',()=>{
 const x=proposal({'seasonal_rank.rollover':'retain'});
 x.approval={proposalDigest:g.digest(x),ownerGitHubLogin:'faust-0612',
 decisionId:'owner-approval-123',reason:'Owner consciously revises the design policy',
 acceptedKeys:['seasonal_rank.rollover']};
 assert.equal(g.proposalReview(x,p).allowedForDesign,false);
 assert.equal(g.proposalReview(x,p,{ownerReviewed:true}).allowedForDesign,true);
 assert.equal(g.proposalReview(x,p,{ownerReviewed:true}).warnings.length,1);
 x.changes['seasonal_rank.rollover']='delete_history';
 assert.equal(g.proposalReview(x,p,{ownerReviewed:true}).allowedForDesign,false);
});
test('no design override can bypass hard boundaries or new unknown policy',()=>{
 for(const k of ['season1.production_logic','qmp_finance.season_rollover','season2.production_launch']){
  const x=proposal({[k]:'unsafe'});
  x.approval={proposalDigest:g.digest(x),ownerGitHubLogin:'faust-0612',
    decisionId:'owner-approval-123',reason:'A proposed unsafe exception',acceptedKeys:[k]};
  assert.equal(g.proposalReview(x,p,{ownerReviewed:true}).allowedForDesign,false,k);
 }
 assert.equal(g.proposalReview(proposal({'unknown.deduction':1}),p).allowedForDesign,false);
});
test('planned is not implemented; launch fails and dishonest verification fails',()=>{
 const x=g.readiness(l);assert.equal(x.valid,true);assert.equal(x.readyForLaunch,false);
 assert.ok(x.pending.length>=8);
 const b=structuredClone(l);b.workstreams[0].evidence=[];
 assert.equal(g.readiness(b).valid,false);
 const c=structuredClone(l);c.productionAuthorized=true;
 assert.equal(g.readiness(c).valid,false);
});
const meta={sourceSha:'a'.repeat(40),appVersion:'1.3.6',runtimeVersion:'1.3.2',otaId:'test-ota'};
const win=minutes=>({minutes,...meta,sessions:200,crashRate:0,navigationP95Ms:180,
 adFirstViewReadyRate:0.95,adFillRelativeDecline:0,securityIncidents:0,
 financeMismatches:0,season1UnexpectedWrites:0,rankMismatches:0,stuckOfflineSubmissions:0});
test('version segmented 15/30/60 health can be green only on complete supplied evidence',()=>{
 const x=g.health({meta,windows:[15,30,60].map(win)},p);
 assert.equal(x.color,'GREEN');assert.equal(x.liveVerified,false);assert.equal(x.autoFix,false);
});
test('mixed OTA, finance incident and bad AdMob/nav metrics are red',()=>{
 const mixed=win(15);mixed.otaId='mixed';
 assert.equal(g.health({meta,windows:[mixed,win(30),win(60)]},p).color,'RED');
 const fin=win(30);fin.financeMismatches=1;
 assert.equal(g.health({meta,windows:[win(15),fin,win(60)]},p).color,'RED');
 const ad=win(15);ad.adFirstViewReadyRate=0.1;
 const nav=win(30);nav.navigationP95Ms=1800;
 const res=g.health({meta,windows:[ad,nav,win(60)]},p);
 assert.equal(res.color,'RED');
 assert.ok(res.alerts.some(a=>a.code==='FIRST_VIEW_AD_LOSS'));
});
test('missing telemetry or low sample is yellow, never false green',()=>{
 assert.equal(g.health({},p).color,'YELLOW');
 const a=win(15);a.sessions=5;
 assert.equal(g.health({meta,windows:[a,win(30),win(60)]},p).color,'YELLOW');
});
test('implementation ledger changes required for season runtime changes',()=>{
 assert.equal(g.auditPaths(['src/lib/buklodSeason2CampaignR1.ts']).allowed,false);
 assert.equal(g.auditPaths(['src/lib/buklodSeason2CampaignR1.ts',
  'contracts/season2-implementation-ledger.json']).allowed,false);
 assert.equal(g.auditPaths(['src/lib/buklodSeason2CampaignR1.ts',
  'contracts/season2-implementation-ledger.json',
  'contracts/season2-proposals/season2-rank.json']).allowed,true);
});
test('pure audit leaves previews and production embargo intact',()=>{
 const code=fs.readFileSync('scripts/season2-governance.cjs','utf8');
 assert.doesNotMatch(code,/supabase\.from|\.rpc\(|eas update|setInterval\(/);
 const campaign=fs.readFileSync('src/lib/buklodSeason2CampaignR1.ts','utf8');
 assert.match(campaign,/missionAwardsLive:false/);
 assert.match(campaign,/inactivityDeductionsLive:false/);
 const embargo=fs.readFileSync('scripts/buklod-season2-production-embargo.cjs','utf8');
 assert.match(embargo,/SEASON2_PRODUCTION_EMBARGO_BEFORE_DEC_6/);
});
