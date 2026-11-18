#!/usr/bin/env node
'use strict';
/*
 * BUKLOD Season 2 staging entry gate. Staging is NOT embargoed by date.
 * The only ordering restriction: the already verified current Train A
 * staging fixes must be released and verified in production first.
 * This check does not publish an OTA, grant rewards or authorize production.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CURRENT_STAGING={
  sourceSha:'6a33d05e85121d3d8a0a6760ef6b2e84c6c6721e',
  updateId:'01a1ed41-f555-7bba-b0d3-1c2b3843ceca',
  groupId:'f31dfa68-b1ec-41bb-8112-a9ba405664fa',
  runtime:'1.3.2'
};
const PRODUCTION_BEFORE='01a1e2e2-cb65-7733-bcb6-3519230c9cf4';
const PROOF_FILE='.buklod/releases/current-fixes-production-verified.json';
function validateProof(record,live){
  if(!record||record.version!==1||record.status!=='VERIFIED_PRODUCTION'||
    record.sourceSha!==CURRENT_STAGING.sourceSha||
    record.stagingSourceUpdateId!==CURRENT_STAGING.updateId||
    record.runtime!==CURRENT_STAGING.runtime||
    record.productionUpdateId===PRODUCTION_BEFORE||
    !/^[0-9a-f-]{36}$/i.test(record.productionUpdateId||'')||
    !/^[0-9a-f]{40}$/i.test(record.productionSourceSha||'')||
    !record.releaseRunUrl?.startsWith('https://github.com/faust-0612/BUKLOD-Rork/actions/runs/')||
    !record.adMobDeviceEvidenceId||!record.navigationDeviceEvidenceId||
    !record.ownerApprovedReleaseId||record.season2Included!==false)return false;
  return live?.id===record.productionUpdateId&&
    live?.runtimeVersion==='1.3.2'&&
    live?.extra?.expoClient?.android?.package==='org.mzbministry.buklod';
}
async function productionManifest(){
  const res=await fetch('https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8',{
    headers:{'expo-platform':'android','expo-runtime-version':'1.3.2','expo-channel-name':'production'},
    signal:AbortSignal.timeout(30000)
  });
  assert.equal(res.status,200,'Live production manifest not available');
  const raw=await res.text();
  try{return JSON.parse(raw);}catch{
    const line=raw.split(/\r?\n/).find(x=>x.startsWith('{"id"'));
    assert.ok(line,'Live production manifest invalid');
    return JSON.parse(line);
  }
}
async function run(){
  assert.equal(process.env.APP_VARIANT,'staging','Season2 staging must not target production');
  assert.equal(process.env.EXPO_PUBLIC_APP_ENV,'staging');
  assert.equal(process.env.GITHUB_REF,'refs/heads/dev/season2-master-candidate-20261118');
  const file=path.resolve(__dirname,'..',PROOF_FILE);
  assert.ok(fs.existsSync(file),'Current fixes must be VERIFIED LIVE IN PRODUCTION before Season2 staging OTA');
  const record=JSON.parse(fs.readFileSync(file,'utf8'));
  const live=await productionManifest();
  assert.ok(validateProof(record,live),'Current-fixes production receipt/live manifest mismatch. HOLD Season2 staging OTA.');
  console.log('SEASON2 STAGING ORDER GATE PASS; production current fixes verified, Season2 production remains embargoed');
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={CURRENT_STAGING,PRODUCTION_BEFORE,PROOF_FILE,validateProof};
