#!/usr/bin/env node
'use strict';
/**
 * Season2 staging order gate. DATE embargo applies to production only.
 * Refuses staging unless the previously verified non-Season2 Train A OTA
 * is still served by the ACTUAL production Expo channel.
 * No rewards, notifications or user data are mutated here.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const PROOF_PATH='.buklod/releases/train-a-production-verified-20261118.json';
const STAGING_BRANCH='staging/season2-rise-together-20261118';
const EXPECTED_PROD={
 sourceSha:'404c87e55c62a88c95c7389ac8665f237149702a',
 updateId:'01a1ee79-b1f1-7295-9d48-0238ffe0202a',
 groupId:'5a9265e1-64d1-4a71-905c-cdc60b8191ea',
 runtime:'1.3.2',package:'org.mzbministry.buklod',
 projectId:'23dad7d0-389a-406e-8dec-08965dab85d8',
 releaseRun:'https://github.com/faust-0612/BUKLOD-Rork/actions/runs/44296995482'
};
function validateProductionProof(p,live){
 if(!p||p.contractVersion!==1||p.status!=='VERIFIED_PRODUCTION_SERVER_SIDE')return false;
 if(p.sourceSha!==EXPECTED_PROD.sourceSha||p.updateId!==EXPECTED_PROD.updateId||
    p.groupId!==EXPECTED_PROD.groupId||p.runtimeVersion!==EXPECTED_PROD.runtime||
    p.package!==EXPECTED_PROD.package||p.projectId!==EXPECTED_PROD.projectId||
    p.releaseRunUrl!==EXPECTED_PROD.releaseRun||p.channel!=='production')return false;
 if(p.season2Included!==false||p.manualDeviceVerificationWaivedByOwner!==true||
   p.physicalAdMobFillVerified!==false||p.physicalInstantNavigationVerified!==false)return false;
 if(p.servedLaunchAssetHash!=='a1GAHWNOFebVZwjWvRA74eb5cZ0y2KztRek2gXdnjP4')return false;
 if(p.frozenAndroidBundleSha256!=='6b51801d634e15e6d56708d6bd103be1e6f9719d32d8aced45e9368177678cfe')return false;
 return live?.id===p.updateId&&live?.runtimeVersion==='1.3.2'&&
   live?.extra?.expoClient?.android?.package==='org.mzbministry.buklod';
}
async function main(){
 assert.equal(process.env.APP_VARIANT,'staging','Must not publish the Season2 preview to production');
 assert.equal(process.env.EXPO_PUBLIC_APP_ENV,'staging');
 assert.equal(process.env.BUKLOD_APP_TARGET,'main');
 assert.equal(process.env.GITHUB_REF,'refs/heads/'+STAGING_BRANCH);
 const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(process.env.GITHUB_SHA,source,'Git checkout does not match staged source');
 const proof=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',PROOF_PATH),'utf8'));
 const {manifest}=await import('./navigation-v2-owner-staging-policy.mjs');
 const live=await manifest('production');
 assert.ok(validateProductionProof(proof,live),
   'Current fixes production source/update is not verified LIVE; reconcile before staging Season2');
 console.log(JSON.stringify({gate:'PASS',target:'staging-user',source,
   verifiedProductionUpdate:live.id,
   manualDeviceVerificationWaived:true,physicalDeviceTestsPassed:false,
   season2ProductionAuthorized:false}));
}
if(require.main===module)main().catch(e=>{console.error('SEASON2 STAGING ORDER BLOCK:',e.message);process.exitCode=1;});
module.exports={PROOF_PATH,STAGING_BRANCH,EXPECTED_PROD,validateProductionProof};
