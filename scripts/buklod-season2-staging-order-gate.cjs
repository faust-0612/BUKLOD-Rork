#!/usr/bin/env node
'use strict';
/*
 * Only BUKLOD Season2 read-only preview staging is allowed.
 * Current Train A production update must be actually served and its
 * official publisher must have succeeded. No manual device tests
 * are pretended to exist; the owner waived them for Train A only.
 * This guard cannot issue any EAS update or mutation.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EXPECTED=Object.freeze({
  productionSourceSha:'404c87e55c62a88c95c7389ac8665f237149702a',
  productionUpdateId:'01a1ee79-b1f1-7295-9d48-0238ffe0202a',
  officialReleaseRunId:44296995482,
  platform:'android',
  runtimeVersion:'1.3.2',
  productionPackage:'org.mzbministry.buklod',
  stagingPackage:'org.mzbministry.buklod.staging',
  stagingBranch:'staging/season2-rise-together-preview-20261118',
  physicalDeviceVerification:'WAIVED_BY_OWNER_FOR_TRAIN_A_ONLY'
});
function evaluateOrder({manifest,release,variant,environment,ref,campaign}){
  const errors=[];
  if(variant!=='staging'||environment!=='staging')errors.push('TARGET_NOT_STAGING');
  if(ref!=='refs/heads/'+EXPECTED.stagingBranch)errors.push('WRONG_SOURCE_BRANCH');
  if(manifest?.id!==EXPECTED.productionUpdateId||
     manifest?.runtimeVersion!==EXPECTED.runtimeVersion||
     manifest?.extra?.expoClient?.android?.package!==EXPECTED.productionPackage)
    errors.push('CURRENT_PRODUCTION_UPDATE_NOT_VERIFIED');
  if(release?.id!==EXPECTED.officialReleaseRunId||
     release?.status!=='completed'||release?.conclusion!=='success'||
     release?.head_sha!==EXPECTED.productionSourceSha)
    errors.push('OFFICIAL_PRODUCTION_PUBLISH_NOT_VERIFIED');
  if(campaign?.officialOpeningPublished!==false||
     campaign?.redemptionLive!==false||
     campaign?.missionAwardsLive!==false||
     campaign?.inactivityDeductionsLive!==false||
     campaign?.chapterPublishingLive!==false)
    errors.push('PREVIEW_MUST_NOT_PUBLISH_GAMEPLAY');
  return {allowed:errors.length===0,errors};
}
async function main(){
  const token=process.env.GH_TOKEN;
  assert.ok(token,'GitHub run authentication unavailable');
  const {manifest}=await import('./navigation-v2-owner-staging-policy.mjs');
  const prod=await manifest('production');
  const r=await fetch('https://api.github.com/repos/faust-0612/BUKLOD-Rork/actions/runs/'+EXPECTED.officialReleaseRunId,{
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json'},
    signal:AbortSignal.timeout(20000)
  });
  assert.equal(r.status,200,'Official production release evidence unavailable');
  const release=await r.json();
  const src=fs.readFileSync(path.join(__dirname,'../src/lib/buklodSeason2CampaignR1.ts'),'utf8');
  const flag={
    officialOpeningPublished:/officialOpeningPublished:\s*false/.test(src)?false:null,
    redemptionLive:/redemptionLive:\s*false/.test(src)?false:null,
    missionAwardsLive:/missionAwardsLive:\s*false/.test(src)?false:null,
    chapterPublishingLive:/chapterPublishingLive:\s*false/.test(src)?false:null,
    inactivityDeductionsLive:/inactivityDeductionsLive:\s*false/.test(src)?false:null
  };
  const result=evaluateOrder({
    manifest:prod,release,variant:process.env.APP_VARIANT,
    environment:process.env.EXPO_PUBLIC_APP_ENV,ref:process.env.GITHUB_REF,
    campaign:flag
  });
  assert.ok(result.allowed,'SEASON2 STAGING ORDER BLOCK: '+result.errors.join(','));
  console.log('SEASON2 STAGING ORDER VERIFIED',JSON.stringify({
    productionUpdateId:prod.id,
    productionSourceSha:EXPECTED.productionSourceSha,
    previewOnly:true,gameplayLive:false,physicalDeviceVerification:EXPECTED.physicalDeviceVerification
  }));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={EXPECTED,evaluateOrder};
