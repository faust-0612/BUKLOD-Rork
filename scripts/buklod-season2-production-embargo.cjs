#!/usr/bin/env node
'use strict';
/*
 * BUKLOD Season2 production-only package embargo. No runtime/network writes.
 * Staging is intentionally unaffected. This source guard is not an Expo
 * organization permission or a substitute for Android AdMob/device RC gates.
 */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const REPO=path.resolve(__dirname,'..');
const NOT_BEFORE_UTC='2026-12-05T16:00:00.000Z'; // Dec 6, midnight Manila
const APPROVAL_PATH='.buklod/releases/season2-production-authorization.json';
const FORBIDDEN_PATHS=Object.freeze([
  'src/lib/buklodSeason2CampaignR1.ts',
  'src/lib/buklodSeasonJourneyR2.ts',
  'src/components/points/BuklodSeasonJourneyPreview.tsx',
  'src/lib/buklodEngagementPolicyR1.ts',
  'src/lib/buklodZeroMomentumNoticePolicyR1.ts',
  'src/lib/buklodDailyCommitmentPolicyR1.ts',
  'src/lib/buklodSeason2Campaign.ts',
  'src/components/season2',
  'src/app/season2',
  'src/features/season2/genesis'
]);
const FORBIDDEN_IMPORT_MARKERS=Object.freeze([
  'BUKLOD_SEASON2_CAMPAIGN',
  'BUKLOD_SEASON2_ACTS',
  'BUKLOD_SEASON2_PROLOGUE_INITIAL',
  'BUKLOD_SEASON2_CHARACTER_CAST',
  'SEASON_V2_ROLLOUT',
  'SEASON2_OPENING_TARGET',
  'buklodSeasonJourneyR2',
  'buklodSeason2CampaignR1',
  'BuklodSeasonJourneyPreview'
]);
const REQUIRED_APPROVAL_EVIDENCE=Object.freeze([
  'season1SignedFinalResultsId',
  'season2PublishedScheduleId',
  'stagingRcVerifiedUpdateId',
  'adMobAndroidDeviceEvidenceId',
  'navigationAndroidDeviceEvidenceId',
  'characterAndFinanceReconciliationId',
  'ownerAuthorizationId'
]);
function runtimeEvidence(root=REPO){
  const evidence=[];
  for(const file of FORBIDDEN_PATHS){
    if(fs.existsSync(path.join(root,file)))evidence.push({file,reason:'package-file'});
  }
  const src=path.join(root,'src');
  let count=0;
  const traverse=dir=>{
    if(!fs.existsSync(dir))return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink())continue;
      const abs=path.join(dir,entry.name);
      if(entry.isDirectory()){traverse(abs);continue;}
      if(!/\.(?:js|jsx|ts|tsx)$/.test(entry.name))continue;
      if(++count>25000)throw Error('Runtime source audit bound exceeded');
      const content=fs.readFileSync(abs,'utf8');
      const marker=FORBIDDEN_IMPORT_MARKERS.find(x=>content.includes(x));
      if(marker)evidence.push({file:path.relative(root,abs).split(path.sep).join('/'),
        reason:'season2-import',marker});
    }
  };
  traverse(src);
  return [...new Map(evidence.map(e=>[e.file,e])).values()];
}
function approvedRecord(record,sha){
  if(!record||record.version!==1||record.authorized!==true||
    record.sourceSha!==sha||record.productionScope!=='season2')return false;
  return REQUIRED_APPROVAL_EVIDENCE.every(k=>typeof record[k]==='string'&&
    record[k].trim().length>=12);
}
function evaluateRelease({target,now,sourceSha='',season2Files=[],approval=null}){
  if(target==='staging')return {allowed:true,reason:'STAGING_NOT_EMBARGOED'};
  if(target!=='production')return {allowed:false,reason:'INVALID_RELEASE_TARGET'};
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
    return {allowed:false,reason:'INVALID_TIME'};
  if(!Array.isArray(season2Files))return {allowed:false,reason:'INVALID_SOURCE_SCAN'};
  if(season2Files.length===0)
    return {allowed:true,reason:'INDEPENDENT_NON_SEASON2_FIX_REQUIRES_NORMAL_GATES'};
  if(now.getTime()<Date.parse(NOT_BEFORE_UTC))
    return {allowed:false,reason:'SEASON2_PRODUCTION_EMBARGO_BEFORE_DEC_6'};
  if(!approvedRecord(approval,sourceSha))
    return {allowed:false,reason:'SEASON2_RELEASE_UNAUTHORIZED_EXACT_SHA_PROOFS_REQUIRED'};
  return {allowed:true,reason:'SEASON2_RECORD_VALID_NORMAL_RELEASE_GATES_STILL_REQUIRED'};
}
function verifyProductionCheckout({root=REPO,now=new Date(),sourceSha=null,gitRef=process.env.GITHUB_REF}={}){
  if(gitRef&&gitRef!=='refs/heads/main')throw Error('Production checkout must be main');
  const sha=sourceSha||execFileSync('git',['rev-parse','HEAD'],{
    cwd:root,encoding:'utf8',timeout:10000}).trim();
  if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Invalid source SHA');
  if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==sha)
    throw Error('Workflow and local checkout SHA mismatch');
  const files=runtimeEvidence(root);
  const authFile=path.join(root,APPROVAL_PATH);
  let approval=null;
  if(files.length&&fs.existsSync(authFile)){
    try{approval=JSON.parse(fs.readFileSync(authFile,'utf8'));}
    catch {throw Error('Invalid Season2 approval JSON; fail closed');}
  }
  const r=evaluateRelease({target:'production',now,sourceSha:sha,
    season2Files:files,approval});
  if(!r.allowed)throw Error('BUKLOD SEASON2 PRODUCTION BLOCK: '+r.reason+
    '; file evidence: '+files.map(x=>x.file).join(','));
  return {reason:r.reason,sourceSha:sha,season2FileCount:files.length,
    season2ProductionAutomaticallyAuthorized:false};
}
if(require.main===module){
  try{
    if(process.argv.length!==3||process.argv[2]!=='--production')
      throw Error('Usage: node scripts/buklod-season2-production-embargo.cjs --production');
    console.log('SEASON2 PRODUCTION GATE PASS',JSON.stringify(verifyProductionCheckout()));
  }catch(err){console.error(String(err.message||err));process.exitCode=1;}
}
module.exports={NOT_BEFORE_UTC,APPROVAL_PATH,FORBIDDEN_PATHS,
  FORBIDDEN_IMPORT_MARKERS,REQUIRED_APPROVAL_EVIDENCE,
  runtimeEvidence,approvedRecord,evaluateRelease,verifyProductionCheckout};
