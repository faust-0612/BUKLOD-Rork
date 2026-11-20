#!/usr/bin/env node
/**
 * Reconstruct the original immutable EAS build receipt from eas build:view --json,
 * avoiding an unnecessary second native EAS build. This is not a release.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

export const GENESIS_ORIGINAL_BUILD_ID='d9e279a6-766b-4bd9-8316-3f700749594c';
export const GENESIS_ORIGINAL_SOURCE_SHA='5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0';
export function recoverFinishedGenesisReceipt(data) {
  const b=Array.isArray(data)?data[0]:data;
  assert.ok(b&&typeof b==='object','Expo build view must be an object');
  assert.equal(b.id,GENESIS_ORIGINAL_BUILD_ID,'Different EAS build; refuse to mistake it for original');
  assert.equal(String(b.status||'').toUpperCase(),'FINISHED','EAS original build has not finished');
  assert.equal(String(b.platform||'').toUpperCase(),'ANDROID','Original build is not Android');
  const source=b.gitCommitHash??b.gitCommit?.hash??b.gitCommit?.commitHash;
  if(source)assert.equal(String(source).toLowerCase(),GENESIS_ORIGINAL_SOURCE_SHA,'EAS build source differs from the verified original commit');
  const channel=b.updateChannel?.name??b.channel;
  if(channel)assert.equal(channel,'season2-genesis-preview','Original EAS build channel is not Genesis staging');
  const appVersion=b.appVersion??b.version??null;
  if(appVersion)assert.equal(appVersion,'2.0.0','Original EAS build version mismatch');
  const artifactUrl=b.artifacts?.buildUrl??b.artifacts?.applicationArchiveUrl;
  assert.match(String(artifactUrl||''),/^https:\/\//,'Missing signed EAS Android artifact');
  // Do not log the full artifact URL; it can carry time-limited signed query credentials.
  return {
    sourceSha:GENESIS_ORIGINAL_SOURCE_SHA,
    easBuildId:b.id,
    status:b.status,
    artifactUrl,
    expectedPackage:'org.mzbministry.buklod.staging',
    expectedRuntime:'2.0.0-genesis-preview',
    channel:'season2-genesis-preview',
    sharedBackend:'EXISTING_BUKLOD_MAIN_FOR_PROD_LIVE_FEATURES_ONLY',
    originalBuildRun:'https://github.com/faust-0612/BUKLOD-Rork/actions/runs/44658491374',
    nativeDeviceQA:'PENDING',
    otaPublished:false,
  };
}

if(process.argv[1]&&process.argv[1].endsWith('genesis-recover-finished-eas-build.mjs')){
 try{
  const inFile=process.argv.find(v=>v.startsWith('--input='))?.slice(8);
  const outFile=process.argv.find(v=>v.startsWith('--output='))?.slice(9);
  assert.ok(inFile&&outFile,'Usage: --input=/tmp/buildview.json --output=/tmp/receipt.json');
  const receipt=recoverFinishedGenesisReceipt(JSON.parse(readFileSync(inFile,'utf8')));
  writeFileSync(outFile,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log('Recovered exact immutable EAS build metadata without rebuilding:',receipt.easBuildId);
 }catch(e){console.error('EAS RECOVERY BLOCK:',e.message);process.exitCode=1;}
}
