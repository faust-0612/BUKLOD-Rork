#!/usr/bin/env node
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {EXPECTED_IDS,validateInventory,readiness,inspectRepo}=require('../scripts/season2-dec6-economy-audit.cjs');
const root=path.join(__dirname,'..');
const base=JSON.parse(fs.readFileSync(path.join(root,'contracts/season2-dec6-complete-reward-inventory-20261119.json'),'utf8'));
const scope=JSON.parse(fs.readFileSync(path.join(root,'contracts/season2-owner-approved-exclusives-20261119.json'),'utf8'));
const mutate=fn=>{const i=JSON.parse(JSON.stringify(base));fn(i);return validateInventory(i,scope);};
test('full 10 approved Season2 exclusives match owner allowlist, no 11th reward',()=>{
 assert.deepEqual(base.approvedExclusiveIds,EXPECTED_IDS);
 assert.equal(validateInventory(base,scope).valid,true);
 assert.equal(base.nonExclusiveApprovedSupplement.length,1);
 assert.equal(base.nonExclusiveApprovedSupplement[0].tokens,0);
 assert.equal(base.approvedExclusives.every(f=>f.backendVerified===false),true);
});
test('46 active / 16 inactive legacy BP policies are a read-only snapshot, not new grants',()=>{
 assert.equal(base.season1BP.activeCatalog.length,46);
 assert.equal(base.season1BP.inactiveCatalog.length,16);
 assert.equal(base.season1BP.activeCatalog.find(x=>x.id==='referral_rank_bonus').baseBP,10);
 assert.equal(base.season1BP.activeCatalog.some(x=>x.id==='kl_episode'),false);
});
test('owner-scope change or pre-Dec6 activation fails closed',()=>{
 assert.ok(mutate(i=>i.release.productionAuthorized=true).problems.includes('PROD_OR_S1_WRITE_ENABLED'));
 assert.ok(mutate(i=>i.release.automaticLaunch=true).problems.includes('AUTOMATIC_OR_UNSIGNED_LAUNCH'));
 assert.ok(mutate(i=>i.approvedExclusiveIds.push('unrequested_rewards')).problems.includes('INVENTORY_EXCLUSIVE_DRIFT'));
 assert.ok(mutate(i=>i.release.earliestProductionPHT='2026-11-19T00:00:00+08:00').problems.includes('EMBARGO_DRIFT'));
});
test('S1 BP/QMP effective rates cannot be silently overwritten by S2',()=>{
 assert.ok(mutate(i=>i.season1BP.activeCatalog.find(x=>x.id==='community_post').baseBP=10).problems.includes('LEGACY_BP_CHANGED:community_post'));
 assert.ok(mutate(i=>i.qmp.base.meaningfulReply=9).problems.includes('QMP_BASE_CHANGED'));
 assert.ok(mutate(i=>i.qmp.fixedPesoPerQmp=1).problems.includes('QMP_MONEY_CONVERSION'));
});
test('chapter reward is 5+n, escrow to next, +5 20-character comment, +50 50-character series reflection',()=>{
 const kl=base.season2.kl;
 assert.deepEqual([1,5,30].map(n=>kl.bpFormula.base+n*kl.bpFormula.perChapterNumber),[6,10,35]);
 assert.equal(Array.from({length:30},(_,n)=>5+n+1).reduce((a,b)=>a+b,0),615);
 assert.equal(kl.grandPotentialWithAllComments,815);
 assert.equal(kl.lastChapterUntilNextSeriesFirstVerified,true);
 assert.ok(mutate(i=>i.season2.kl.chapterComment.minCharacters=1).problems.includes('KL_COMMENT_REWARD_DRIFT'));
 assert.ok(mutate(i=>i.season2.kl.delayReleaseUntilNextChapterVerified=false).problems.includes('KL_SEQUENCE_OR_ESCROW_BROKEN'));
 assert.ok(mutate(i=>i.season2.kl.seriesReflection.minCharacters=20).problems.includes('KL_COMPLETION_BROKEN'));
});
test('Journey Tokens total 9 configured/day, cap 12, prayer and children never mint',()=>{
 const token=base.season2;
 assert.equal(token.tokenSources.reduce((s,x)=>s+x.amount*x.dailyCount,0),9);
 assert.equal(token.tokenDailyCeiling,12);
 assert.ok(mutate(i=>i.season2.tokenSources[3].dailyCount=20).problems.includes('S2_TOKEN_GRANT_DRIFT'));
 assert.ok(mutate(i=>i.season2.unverifiedNoTokenSources=[]).problems.includes('SENSITIVE_TOKEN_GRANT'));
});
test('weekly classification score tiers, capped variation and highest weekly noncash award',()=>{
 const r=base.season2.weeklyPerformance;
 assert.equal(r.totalCap,100);
 assert.deepEqual(r.tiers.map(x=>x.score),[0,1,25,60,85]);
 assert.equal(r.rewardsOnlyHighestClosedWeek,true);
 assert.ok(mutate(i=>i.season2.weeklyPerformance.tiers[4].score=70).problems.includes('WEEKLY_TIER_DRIFT'));
});
test('required 7+3+2x7 flexibility and only optional bonus lock',()=>{
 const f=base.season2.foundation;
 assert.deepEqual([f.normalDays,f.automaticGraceDays,f.flexCreditsPerSeason,f.daysEachFlex],[7,3,2,7]);
 assert.equal(f.uncompletedBlocksOnly,'OPTIONAL_S2_MISSION_BONUS');
 assert.ok(mutate(i=>i.season2.foundation.uncompletedBlocksOnly='BP').problems.includes('COERCIVE_FOUNDATION_LOCK'));
});
test('Momentum deductions disabled; no persistent BP/QMP/cash/item penalties',()=>{
 const m=base.season2.momentum;
 assert.equal(m.enabled,false);assert.equal(m.finalDeductionsApproved,false);
 assert.equal(m.dailyMaximumMinus,9);assert.ok(m.neverDeduct.includes('BP'));
 assert.ok(mutate(i=>i.season2.momentum.enabled=true).problems.includes('MOMENTUM_PREMATURE_DEDUCTION'));
});
test('1,300 items are server-owned with distinct per-stage slot prerequisites',()=>{
 const x=base.season2.itemPrerequisites;
 assert.equal(x.characters*x.levelsPerCharacter*x.itemsPerLevel,1300);
 assert.equal(x.cannotMintFromImages,true);assert.equal(x.neverReplaceExistingInventory,true);
 assert.match(x.slot5,/1-4/);
 assert.ok(mutate(i=>i.season2.itemPrerequisites.cannotMintFromImages=false).problems.includes('COLLECTIBLE_MASTER_RULE_DRIFT'));
});
test('referral S1=10 remains isolated from S2 target 20 and referred 10',()=>{
 const s1=base.season1BP.activeCatalog.find(x=>x.id==='referral_rank_bonus');
 assert.equal(s1.baseBP,10);
 assert.equal(base.season2.referral.qualifiedReferrerTargetBP,20);
 assert.equal(base.season2.referral.referredNewMemberTargetBP,10);
 assert.ok(mutate(i=>i.season2.referral.notYetReconciledWithLiveBP10=false).problems.includes('REFERRAL_20_VS_10_UNRECONCILED'));
});
test('optional rewarded ads never buy BP/QMP/cash/tokens; candidate badges are not earned',()=>{
 const ad=base.season2.optionalRewardedAds;
 assert.deepEqual([ad.pointsGrantedBP,ad.qmpGranted,ad.cashGrantedPHP,ad.journeyTokensAutomaticallyGranted],[0,0,0,0]);
 assert.equal(ad.requiresOptIn,true);
 assert.equal(ad.requiresProviderEarnedCallback,true);
 assert.equal(base.season2.badgeTitleCandidates.approval,'CANDIDATE_NAMES_ONLY_NOT_SERVER_GRANTS');
 assert.ok(mutate(i=>i.season2.optionalRewardedAds.pointsGrantedBP=5).problems.includes('REWARDED_AD_DIRECT_POINTS_OR_CASH_VIOLATION'));
 assert.ok(mutate(i=>i.season2.badgeTitleCandidates.approval='GRANTED').problems.includes('UNVERIFIED_BADGE_TITLES_MARKED_EARNED'));
});
test('readiness remains HOLD until external server, finance, security and runtime proofs exist',()=>{
 const r=readiness(base);
 assert.equal(r.state,'HOLD');
 assert.equal(r.productionAuthorized,false);
 assert.equal(r.pendingCount,base.season2.releaseGates.length);
 assert.ok(r.pending.some(x=>x.id==='independent_staging_backend'));
 assert.ok(r.pending.some(x=>x.id==='ads_and_ui_regression'));
 assert.ok(r.pending.some(x=>x.id==='dec6_embargo_and_signed_approval'));
});
test('repository flags stay OFF, owner scope remains identical',()=>{
 const a=inspectRepo();
 assert.equal(a.inventory.valid,true);
 assert.equal(a.readiness.state,'HOLD');
});
