#!/usr/bin/env node
'use strict';
// Source/staging gate only. Never touches network, Expo, Supabase or Season1.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ids=Object.freeze(["rise_together_campaign","journey_token_wallet","character_mastery_1300","weekly_performance_class","four_season_awards","kingdom_cooperative_missions","foundation_momentum_grace_antifarm","kl_progressive_pending_bp","seasonal_archival_carryover","qualified_referral_rank_reward"]);
const f=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=()=>JSON.parse(f('contracts/season2-owner-approved-exclusives-20261119.json'));
function validate(x){
 const errors=[];
 if(x?.season!==2||x?.schemaVersion!==1||x?.ownerGitHubLogin!=='faust-0612')errors.push('INVALID_SCOPE_IDENTITY');
 if(x?.ownerDecision!=='APPROVED_EXACTLY_ITEMS_1_THROUGH_10')errors.push('MISSING_EXACT_OWNER_SCOPE');
 if(x?.productionAuthorized!==false||x?.backendRewardWritesAllowed!==false||x?.mayModifySeason1!==false)errors.push('UNAUTHORIZED_ACTIVATION');
 if(x?.automaticDec6Launch!==false||x?.explicitSeparateOwnerApprovalRequired!==true||x?.productionShaBoundApprovalRequired!==true)errors.push('UNSAFE_PRODUCTION_LAUNCH');
 if(x?.firstPossibleProductionManila!=='2026-12-06T00:00:00+08:00')errors.push('EMBARGO_CHANGED');
 if(x?.stagingTarget!=='staging-user'||x?.stagingPackage!=='org.mzbministry.buklod.staging')errors.push('STAGING_IDENTITY_CHANGED');
 if(x?.allowUnrequestedFeatureInsertion!==false||x?.allowUnrequestedFeatureRemoval!==false||x?.themeWorkAuthorized!==false)errors.push('UNAPPROVED_SCOPE_CHANGE');
 if(!Array.isArray(x?.approvedFeatureIds)||JSON.stringify(x.approvedFeatureIds)!==JSON.stringify(ids))errors.push('FEATURE_SET_DRIFT');
 if(!Array.isArray(x?.featureEntries)||x.featureEntries.length!==10||x.featureEntries.some((e,i)=>e.number!==i+1||e.id!==ids[i]||typeof e.name!=='string'||!e.name.trim()))errors.push('FEATURE_RECORD_DRIFT');
 return {valid:errors.length===0,errors};
}
function checkRepo(){
 const result=validate(data());assert.equal(result.valid,true,result.errors.join(', '));
 const code=f('src/lib/season2/buklodSeason2ApprovedScopeR1.ts');
 const ui=f('src/components/points/BuklodSeason2ApprovedExclusivePreview.tsx');
 const screen=f('src/components/points/BuklodSeasonJourneyPreview.tsx');
 const marker=f('.buklod/releases/season2-conso-staging-20261119.json');
 const rollout=f('src/lib/season2/buklodSeason2RewardContractR1.ts');
 const embargo=f('scripts/buklod-season2-production-embargo.cjs');
 for(const id of ids)assert.ok(code.includes("id:'"+id+"'"),'Missing UI entry: '+id);
 assert.equal(code.split("Object.freeze({id:'").length-1,10,'Unexpected extra feature in UI');
 assert.match(code,/productionAuthorized:false/);assert.match(code,/backendRewardsLive:false/);
 assert.match(code,/chapterBpCredits:false/);assert.match(code,/referralDoubleGrant:false/);
 assert.ok(code.includes('canActivateSeason2Exclusive():false'));
 assert.match(screen,/BuklodSeason2ApprovedExclusivePreview/);
 assert.match(ui,/S2_EXCLUSIVE_FEATURES/);
 const rel=JSON.parse(marker);
 for(const key of ['productionAuthorized','backendRewardsLive','season2RewardDbWritesAuthorized'])assert.equal(rel[key],false,'Stage preview cannot activate '+key);
 assert.equal(rel.mode,'preview_only_rewards_off');assert.equal(rel.target,'staging-user');
 assert.ok(rollout.includes('journeyTokenMint: false'));
 assert.ok(rollout.includes('season2BadgeGrant: false'));
 assert.ok(embargo.includes("NOT_BEFORE_UTC='2026-12-05T16:00:00.000Z'"));
 return {ok:true,scopeCount:ids.length,preview:true,productionAuthorized:false};
}
if(require.main===module){try{console.log('SEASON2 TEN SCOPE LOCK PASS',JSON.stringify(checkRepo()));}catch(e){console.error('SEASON2 TEN SCOPE LOCK FAIL',e.message);process.exitCode=1;}}
module.exports={approvedIds:ids,validate,checkRepo};
