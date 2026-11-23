'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const read=p=>readFileSync(p,'utf8');
const marker=JSON.parse(read('.buklod/releases/buklod-main-connect-prod-promotion-20261123.json'));
const scope=JSON.parse(read('.buklod/scopes/buklod-main-connect-prod-promotion-20261123.json'));
const prior=JSON.parse(read('.buklod/releases/buklod-main-connect-latest-nonseason2-ota-20261123.json'));
const publisher=read('.github/workflows/production_android_ota.yml');
const web=read('.github/workflows/production_web_deploy.yml');
const thread=read('src/components/BuklodConnectThread.tsx');
const cfg=require('../app.config.js')({config:{}});

test('only reviewed exact MAIN is authorized for existing-native Android',()=>{
 assert.equal(marker.productionAuthorized,true);
 assert.equal(marker.sourceCommitBeforeMarker,'2297384f796eb62d0a316a102123090d92d9532f');
 assert.equal(scope.baseRef,marker.sourceCommitBeforeMarker);
 assert.equal(marker.candidateSourceMergeSha,'ae2decb85bda382644e369aa0affaa5a53096978');
 assert.equal(marker.sourceScopePR,1144);
 assert.equal(marker.sourceRcPR,1145);
 assert.equal(marker.productionTarget,'BUKLOD_MAIN_ANDROID');
 assert.equal(marker.releaseMode,'EXISTING_NATIVE_JS_OTA_ONLY');
 assert.equal(marker.expoRuntimeVersion,'1.3.2');
 assert.equal(marker.channel,'production');
 assert.equal(marker.androidPackage,'org.mzbministry.buklod');
 assert.equal(marker.nativeVersionCode,30);
 assert.equal(marker.nativeVersion,'1.3.6');
 assert.equal(cfg.runtimeVersion,marker.expoRuntimeVersion);
 assert.equal(cfg.android.package,marker.androidPackage);
 assert.equal(cfg.android.versionCode,marker.nativeVersionCode);
 assert.equal(cfg.extra.eas.projectId,marker.expoProjectId);
 assert.equal(prior.sourceCommitBeforeMarker,marker.candidateSourceMergeSha);
 for (const flag of ['nativeBuildAuthorized','playReleaseAuthorized','season2ProductionAuthorized','webDeploymentAuthorized'])
   assert.equal(marker[flag],false,flag);
 assert.equal(marker.physicalDeviceQA,'NOT_PERFORMED_NOT_PASSED');
 assert.equal(marker.proof.rcSourceQaRuns.length,3);
 assert.equal(marker.proof.sourceQaRuns.length,4);
});

test('Connect latest fix and isolated release inventory are present',()=>{
 assert.match(thread,/const userScrolledUpRef = useRef\(false\)/);
 assert.match(thread,/!pinLatestOnOpenRef\.current &&[\s\S]*?userScrolledUpRef\.current/);
 assert.match(thread,/opacity: listAnchored \? 1 : 0/);
 assert.equal(marker.proof.sourceDiffPaths.length,4);
 assert.equal(scope.allowedPaths.length,3);
 const allowed=new Set([
  '.buklod/releases/buklod-main-connect-prod-promotion-20261123.json',
  '.buklod/scopes/buklod-main-connect-prod-promotion-20261123.json',
  'tests/buklod-main-connect-prod-promotion-marker-20261123.test.cjs'
 ]);
 for(const p of scope.allowedPaths)assert.ok(allowed.has(p),'unexpected path '+p);
 assert.equal(scope.regressionTests.length,1);
});

test('canonical Android publisher enforces embargo/ads/freeze/readback and never publishes web',()=>{
 assert.match(publisher,/branches: \[main\]/);
 assert.match(publisher,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_ANDROID_ONLY_PROD_20261114:'\)/);
 assert.match(publisher,/node scripts\/buklod-season2-production-embargo\.cjs --production/);
 assert.match(publisher,/node scripts\/android-ota-rc\.cjs baseline/);
 assert.match(publisher,/node scripts\/android-ota-rc\.cjs freeze/);
 assert.match(publisher,/node scripts\/android-ota-rc\.cjs verify/);
 assert.match(publisher,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(publisher,/Verify production AdMob live units before RC export/);
 assert.match(publisher,/node --test tests\/production-ota-ads-regression\.test\.mjs/);
 assert.match(publisher,/eas-cli@latest update --channel production --platform android/);
 assert.doesNotMatch(web,/BUKLOD_ANDROID_ONLY_PROD_20261114/);
 assert.equal(marker.proof.previousProductionEvidence.notCurrentBaseline,'MUST_REFRESH_IN_CANONICAL_PUBLISHER');
 assert.equal(marker.publicationStatus,'NOT_YET_PUBLISHED_PENDING_PROVIDER_VERIFICATION');
 assert.equal(scope.publicationStatus,'NOT_PUBLISHED_UNTIL_CANONICAL_EXPO_READBACK');
});
