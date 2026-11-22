'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const file='.buklod/releases/buklod-main-conso-ota-promotion-20261122.json';
const promotion=JSON.parse(readFileSync(file,'utf8'));
const productionFlow=readFileSync('.github/workflows/production_android_ota.yml','utf8');
const config=require('../app.config.js')({config:{}});
test('exact previously protected BUKLOD MAIN source and existing 1.3.2 native runtime only',()=>{
 assert.equal(promotion.productionAuthorized,true);
 assert.equal(promotion.productionTarget,'BUKLOD_MAIN_ANDROID');
 assert.equal(promotion.releaseMode,'EXISTING_NATIVE_JS_OTA_ONLY');
 assert.equal(promotion.sourceCommitBeforeMarker,'27c8e51ed2d7237483107b6c1ded8fbe5a410ce5');
 assert.equal(promotion.androidPackage,'org.mzbministry.buklod');
 assert.equal(promotion.nativeVersionCode,30);
 assert.equal(promotion.expoRuntimeVersion,'1.3.2');
 assert.equal(promotion.channel,'production');
 assert.equal(config.android.package,promotion.androidPackage);
 assert.equal(config.android.versionCode,promotion.nativeVersionCode);
 assert.equal(config.runtimeVersion,promotion.expoRuntimeVersion);
 assert.equal(config.extra.eas.projectId,promotion.expoProjectId);
 for(const k of ['nativeBuildAuthorized','playReleaseAuthorized','season2ProductionAuthorized']) assert.equal(promotion[k],false);
});
test('one guarded canonical main-only publisher, no direct false production success',()=>{
 assert.match(productionFlow,/branches: \[main\]/);
 assert.match(productionFlow,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_ANDROID_ONLY_PROD_20261114:'\)/);
 assert.match(productionFlow,/node scripts\/android-ota-rc\.cjs baseline/);
 assert.match(productionFlow,/node scripts\/android-ota-rc\.cjs freeze/);
 assert.match(productionFlow,/node scripts\/android-ota-rc\.cjs verify/);
 assert.match(productionFlow,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(productionFlow,/eas-cli@latest update --channel production --platform android/);
 assert.equal(promotion.publicationStatus,'NOT_YET_PUBLISHED');
 assert.equal(promotion.physicalDeviceQA,'WAIVED_BY_OWNER_NOT_PERFORMED');
 assert.equal(promotion.proof.approvedMainRCWorkflows.length,4);
 assert.equal(promotion.proof.liveBackend.pendingCheckinsIntact,15);
 assert.equal(promotion.proof.liveBackend.historicalAttendanceCreditsIntact,25);
});

test('verified first OTA survives safely suppressing a duplicate publisher through main-SHA lease',()=>{
 const guard=JSON.parse(readFileSync('.buklod/scopes/buklod-stop-redundant-ota-20261122.json','utf8'));
 assert.equal(guard.contractVersion,2);
 assert.match(guard.productionBaselineEvidence,/VERIFIED ANDROID PRODUCTION OTA 01a201d4-de9e-7de7-a54f-d1654090421c/);
 assert.match(guard.chosenApproach,/NON-RELEASE message/);
 assert.match(productionFlow,/git ls-remote origin refs\/heads\/main/);
 assert.match(productionFlow,/test "\$\(git ls-remote origin refs\/heads\/main/);
 assert.match(productionFlow,/BUKLOD_ANDROID_ONLY_PROD_20261114:/);
});
