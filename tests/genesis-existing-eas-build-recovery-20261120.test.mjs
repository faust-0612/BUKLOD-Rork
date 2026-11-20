import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recoverFinishedGenesisReceipt,GENESIS_ORIGINAL_BUILD_ID,GENESIS_ORIGINAL_SOURCE_SHA} from '../scripts/genesis-recover-finished-eas-build.mjs';

const fixture={id:GENESIS_ORIGINAL_BUILD_ID,status:'FINISHED',platform:'ANDROID',
 gitCommitHash:GENESIS_ORIGINAL_SOURCE_SHA,appVersion:'2.0.0',
 updateChannel:{name:'season2-genesis-preview'},artifacts:{buildUrl:'https://expo.dev/artifacts/eas/original.apk'}};
test('recover original successful EAS APK with no new build',()=>{
 const x=recoverFinishedGenesisReceipt(fixture);
 assert.equal(x.easBuildId,GENESIS_ORIGINAL_BUILD_ID);
 assert.equal(x.sourceSha,GENESIS_ORIGINAL_SOURCE_SHA);
 assert.equal(x.nativeDeviceQA,'PENDING');
 assert.equal(x.otaPublished,false);
});
test('strict original source/build/channel/version/status/artifact provenance',()=>{
 for(const [patch,error] of [
  [{id:'ffffffff-ffff-ffff-ffff-ffffffffffff'},/Different EAS build/],
  [{status:'IN_PROGRESS'},/not finished/],
  [{platform:'IOS'},/not Android/],
  [{gitCommitHash:'a'.repeat(40)},/source differs/],
  [{appVersion:'1.3.6'},/version mismatch/],
  [{updateChannel:{name:'production'}},/not Genesis staging/],
  [{artifacts:{}},/Missing signed/]
 ])assert.throws(()=>recoverFinishedGenesisReceipt({...fixture,...patch}),error);
});
test('recovery workflow never invokes EAS build or Expo OTA',()=>{
 const w=readFileSync(new URL('../.github/workflows/genesis-verify-existing-eas-apk-20261120.yml',import.meta.url),'utf8');
 assert.match(w,/build:view/);
 assert.match(w,/genesis-verify-signed-apk\.mjs --receipt=/);
 assert.match(w,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(w,/eas-cli[^\n]* build --platform|eas update|--profile production/);
});
