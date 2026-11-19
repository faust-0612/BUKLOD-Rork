#!/usr/bin/env node
'use strict';
// READ-ONLY inventory and release-readiness audit. Does not load .env,
// call Supabase/EAS, mutate the database, grant rewards or publish OTA.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const INVENTORY='contracts/season2-dec6-complete-reward-inventory-20261119.json';
const OWNER_SCOPE='contracts/season2-owner-approved-exclusives-20261119.json';
const EXPECTED_IDS=Object.freeze([
  'rise_together_campaign','journey_token_wallet','character_mastery_1300',
  'weekly_performance_class','four_season_awards','kingdom_cooperative_missions',
  'foundation_momentum_grace_antifarm','kl_progressive_pending_bp',
  'seasonal_archival_carryover','qualified_referral_rank_reward'
]);
function load(p){return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}
function fail(c,msg){if(!c)throw Error(msg);}
function unique(rows,key='id'){return rows.length===new Set(rows.map(x=>x[key])).size;}
function validateInventory(i,scope){
  const problems=[];
  const check=(ok,msg)=>{if(!ok)problems.push(msg);};
  check(i?.schemaVersion===1&&i?.asOfManilaDay==='2026-11-19','INVALID_INVENTORY_VERSION');
  check(i?.policyStatus==='SOURCE_ONLY_PREP_NO_ECONOMY_ACTIVATION','PREMATURE_IMPLEMENTATION_CLAIM');
  check(i?.release?.earliestProductionPHT==='2026-12-06T00:00:00+08:00','EMBARGO_DRIFT');
  check(i?.release?.automaticLaunch===false&&i?.release?.ownerExactShaApprovalRequired===true,'AUTOMATIC_OR_UNSIGNED_LAUNCH');
  check(i?.release?.productionAuthorized===false&&i?.release?.backendRewardWritesAllowed===false&&i?.release?.season1RulesMutable===false,'PROD_OR_S1_WRITE_ENABLED');
  check(i?.release?.stagingPackage==='org.mzbministry.buklod.staging','WRONG_STAGING_PACKAGE');
  check(scope?.ownerDecision==='APPROVED_EXACTLY_ITEMS_1_THROUGH_10'&&scope?.productionAuthorized===false&&scope?.backendRewardWritesAllowed===false,'SCOPE_PERMISSION_DRIFT');
  check(JSON.stringify(i?.approvedExclusiveIds)===JSON.stringify(EXPECTED_IDS),'INVENTORY_EXCLUSIVE_DRIFT');
  check(JSON.stringify(scope?.approvedFeatureIds)===JSON.stringify(EXPECTED_IDS),'OWNER_EXCLUSIVE_DRIFT');
  check(Array.isArray(i?.approvedExclusives)&&i.approvedExclusives.length===10 &&
    i.approvedExclusives.every((f,n)=>f.number===n+1&&f.id===EXPECTED_IDS[n]&&f.backendVerified===false&&f.androidVerified===false),
    'FEATURE_LIST_OR_VERIFICATION_FALSE_CLAIM');
  const bp=i?.season1BP;
  check(bp?.dataStatus==='LIVE_CONFIG_AS_OF_2026-11-19_NOT_TRIGGER_PROOF','BP_SNAPSHOT_NOT_LABELED');
  check(Array.isArray(bp?.activeCatalog)&&bp.activeCatalog.length===46&&unique(bp.activeCatalog),'S1_BP_CATALOG_GAP_OR_DUPLICATE');
  check(Array.isArray(bp?.inactiveCatalog)&&bp.inactiveCatalog.length===16&&unique(bp.inactiveCatalog),'S1_BP_INACTIVE_CATALOG_DRIFT');
  const getBP=k=>bp?.activeCatalog.find(r=>r.id===k)?.baseBP;
  for(const [k,v] of [['community_post',5],['community_comment',2],['community_reaction',1],['formation_lesson',25],['event_attendance',10],
  ['bible_quiz_easy',3],['bible_quiz_medium',6],['bible_quiz_hard',12],['referral_rank_bonus',10],
  ['verified_volunteer_service',20],['prayer_response',2]]) check(getBP(k)===v,'LEGACY_BP_CHANGED:'+k);
  check(!bp.activeCatalog.some(r=>r.id==='kl_episode'||r.id==='kl_season'),'INACTIVE_KL_REACTIVATED');
  check(bp.activeCatalog.every(r=>Number.isSafeInteger(r.baseBP)&&r.baseBP>=0&&
    (r.dayCapBP===null||(Number.isSafeInteger(r.dayCapBP)&&r.dayCapBP>=0))),'INVALID_BP_RATE');
  const q=i?.qmp;
  check(q?.base?.usefulPost===5&&q?.base?.qualifiedVideo===10&&q?.base?.meaningfulReply===3,'QMP_BASE_CHANGED');
  check(q?.base?.creatorUniqueReactionBonus===1&&q?.base?.internalShareConfigured===2,'QMP_ENGAGEMENT_CHANGED');
  check(q?.qualifications?.postMinCharactersOrApprovedMedia===40&&q?.qualifications?.replyMinCharacters===20
    &&q?.qualifications?.duplicateReplyDays===7&&q?.qualifications?.velocityHoldEventsPerHour===30,'QMP_ANTIFARM_CHANGED');
  check(q?.bonusCaps?.monthly===250&&q?.bonusCaps?.perContent===25,'QMP_CAPS_CHANGED');
  check(q?.missionBonuses?.length===4&&q.missionBonuses.reduce((s,m)=>s+m.qmp,0)===60,'QMP_MISSIONS_CHANGED');
  check(q?.providerUserPoolBps===3000&&q?.fixedPesoPerQmp===false,'QMP_MONEY_CONVERSION');
  const t=i?.season2;
  const tok=t?.tokenSources??[];
  check(tok.length===4&&unique(tok)&&JSON.stringify(tok.map(s=>[s.id,s.amount,s.dailyCount]))===
    JSON.stringify([['today_dugtong',2,1],['kl_verified_chapter',3,1],['wall_original_post',2,1],['wall_meaningful_comment',1,2]]),'S2_TOKEN_GRANT_DRIFT');
  check(t?.verifiedModeledDailyMax===9&&t?.tokenDailyCeiling===12&&
    tok.reduce((sum,s)=>sum+s.amount*s.dailyCount,0)===9,'S2_DAILY_TOKEN_MATH_DRIFT');
  check(t?.unverifiedNoTokenSources?.includes('private_prayer')&&t?.unverifiedNoTokenSources?.includes('children_story_milestone'),'SENSITIVE_TOKEN_GRANT');
  check(t?.pricesOwnerFinalApproved===false,'UNAPPROVED_COSMETIC_PRICES_LOCKED');
  check(t?.kl?.bpFormula?.base===5&&t.kl.bpFormula.perChapterNumber===1&&t.kl.chaptersPerSeries===30,'SUPERSEDED_KL_RATE');
  check(t?.kl?.delayReleaseUntilNextChapterVerified===true&&t.kl.lastChapterUntilNextSeriesFirstVerified===true&&
    t.kl.sequenceAllPreviousRequired===true,'KL_SEQUENCE_OR_ESCROW_BROKEN');
  check(t?.kl?.chapterComment?.awardBP===5&&t.kl.chapterComment.minCharacters===20&&t.kl.chapterComment.maxCreditedPerChapter===1,'KL_COMMENT_REWARD_DRIFT');
  check(t?.kl?.seriesReflection?.minCharacters===50&&t.kl.seriesReflection.awardBP===50&&t.kl.photoOptional===true
    &&t.kl.quizVerifiedNoMinimumReadingMinutes===true,'KL_COMPLETION_BROKEN');
  const sum=Array.from({length:30},(_,n)=>5+n+1).reduce((a,b)=>a+b,0);
  check(sum===615&&t.kl.chapterPointsPotentialFull30===sum&&t.kl.grandPotentialWithAllComments===sum+50+30*5,'KL_TOTAL_MATH');
  check(t?.referral?.qualifiedReferrerTargetBP===20&&t.referral.referredNewMemberTargetBP===10
    &&t.referral.notYetReconciledWithLiveBP10===true,'REFERRAL_20_VS_10_UNRECONCILED');
  check(t?.foundation?.p0LearningReceipts===1&&t.foundation.p0SeparateCommunityReceipts===1
    &&t.foundation.normalDays===7&&t.foundation.automaticGraceDays===3
    &&t.foundation.flexCreditsPerSeason===2&&t.foundation.daysEachFlex===7,'FOUNDATION_GRACE_DRIFT');
  check(t?.foundation?.uncompletedBlocksOnly==='OPTIONAL_S2_MISSION_BONUS','COERCIVE_FOUNDATION_LOCK');
  check(t?.momentum?.enabled===false&&t.momentum.optInRequired===true&&t.momentum.finalDeductionsApproved===false
    &&t.momentum.dailyMaximumMinus===9&&t.momentum.floor===0,'MOMENTUM_PREMATURE_DEDUCTION');
  check(t?.momentum?.neverDeduct?.includes('BP')&&t.momentum.neverDeduct.includes('QMP')
    &&t.momentum.neverDeduct.includes('cash'),'LIFETIME_DEDUCTION_DRIFT');
  check(t?.weeklyPerformance?.totalCap===100&&
    JSON.stringify(t.weeklyPerformance.tiers.map(z=>[z.name,z.score,z.minActiveDays,z.minCategories]))===
    JSON.stringify([['Unrated',0,0,0],['Emerging',1,1,1],['Active',25,2,1],['Thrive',60,3,2],['Exceptional',85,4,2]]),'WEEKLY_TIER_DRIFT');
  check(t?.itemPrerequisites?.total===1300&&t.itemPrerequisites.characters*
    t.itemPrerequisites.levelsPerCharacter*t.itemPrerequisites.itemsPerLevel===1300
    &&t.itemPrerequisites.cannotMintFromImages===true,'COLLECTIBLE_MASTER_RULE_DRIFT');
  check(t?.awards?.length===4&&unique(t.awards),'FOUR_AWARD_DRIFT');
  check(t?.seasonRollover?.requireSignedS1Results===true&&t.seasonRollover.hallOfFameImmutable===true&&
    t.seasonRollover.preserve.includes('finalized pesos'),'CARRYOVER_GAP');
  check(t?.finance?.earmarkedPercent===30&&t.finance.withdrawalMinimumPHP===200&&
    t.finance.requiresVerifiedLegalIdentity===true&&t.finance.requiresMatchingPayoutBeneficiary===true,'WITHDRAWAL_SECURITY_GAP');
  check(t?.antiFarm?.length>=10&&t.antiFarm.some(x=>x.includes('rule upgrades')),'REPLAY_GUARD_GAP');
  check(t?.optionalRewardedAds?.pointsGrantedBP===0&&t.optionalRewardedAds.qmpGranted===0&&
    t.optionalRewardedAds.cashGrantedPHP===0&&t.optionalRewardedAds.journeyTokensAutomaticallyGranted===0&&
    t.optionalRewardedAds.requiresOptIn===true&&t.optionalRewardedAds.requiresProviderEarnedCallback===true,
    'REWARDED_AD_DIRECT_POINTS_OR_CASH_VIOLATION');
  check(t?.badgeTitleCandidates?.approval==='CANDIDATE_NAMES_ONLY_NOT_SERVER_GRANTS'&&
    t.badgeTitleCandidates.names.length===6,'UNVERIFIED_BADGE_TITLES_MARKED_EARNED');
  check(i?.nonExclusiveApprovedSupplement?.length===1&&
    i.nonExclusiveApprovedSupplement[0].id==='daily_proverbs_show_faith_wall'&&
    i.nonExclusiveApprovedSupplement[0].tokens===0,'UNAPPROVED_ELEVENTH_REWARD');
  check(Array.isArray(t?.releaseGates)&&t.releaseGates.length>=20&&unique(t.releaseGates) &&
    t.releaseGates.every(g=>typeof g.requirement==='string'&&typeof g.status==='string'&&typeof g.passed==='boolean'),
    'RELEASE_GATE_COVERAGE_GAP');
  if(t?.releaseGates?.some(g=>g.passed===true&&!Array.isArray(g.evidence)))problems.push('UNSUPPORTED_GATE_PASS');
  return {valid:problems.length===0,problems};
}
function readiness(i){
  const pending=(i?.season2?.releaseGates||[]).filter(g=>g.passed!==true).map(g=>({id:g.id,status:g.status,requirement:g.requirement}));
  return {state:'HOLD',productionAuthorized:false,earliestProductionPHT:'2026-12-06T00:00:00+08:00',
   pendingCount:pending.length,pending,reason:'Readiness review only; cannot authorize OTA or backend activation'};
}
function inspectRepo(){
  const inventory=load(INVENTORY),scope=load(OWNER_SCOPE);
  const check=validateInventory(inventory,scope);
  if(!check.valid)throw Error('S2 DEC6 INVENTORY DRIFT: '+check.problems.join(', '));
  const rollout=fs.readFileSync(path.join(root,'src/lib/season2/buklodSeason2RewardContractR1.ts'),'utf8');
  const exclusive=fs.readFileSync(path.join(root,'src/lib/season2/buklodSeason2ApprovedScopeR1.ts'),'utf8');
  if(!rollout.includes('productionAuthorized: false')||!rollout.includes('journeyTokenMint: false')||
    !rollout.includes('journeyTokenSpend: false')||!rollout.includes('optionalMomentum: false'))throw Error('UNSAFE_SOURCE_ROLLOUT_SWITCH');
  if(!exclusive.includes('canActivateSeason2Exclusive():false'))throw Error('APPROVED_EXCLUSIVE_ACTIVATION_DRIFT');
  return {inventory:check,readiness:readiness(inventory)};
}
if(require.main===module){
  try{const result=inspectRepo();console.log('BUKLOD S2 DEC6 PREPARATION AUDIT',JSON.stringify(result));if(process.argv.includes('--require-ready'))process.exitCode=2;}
  catch(e){console.error('BUKLOD S2 DEC6 PREPARATION AUDIT FAIL',e.message);process.exitCode=1;}
}
module.exports={EXPECTED_IDS,validateInventory,readiness,inspectRepo};
