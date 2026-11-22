'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');

const marker=JSON.parse(readFileSync('.buklod/releases/buklod-nonseason2-consent-prod-ota-20261122.json','utf8'));
const scope=JSON.parse(readFileSync('.buklod/scopes/buklod-nonseason2-consent-prod-ota-20261122.json','utf8'));
const workflow=readFileSync('.github/workflows/production_android_ota.yml','utf8');
const config=require('../app.config.js')({config:{}});

test('consent-only source and unchanged production app runtime',()=>{
 assert.equal(marker.productionAuthorized,true);
 assert.equal(marker.productionTarget,'BUKLOD_MAIN_ANDROID');
 assert.equal(marker.releaseMode,'EXISTING_NATIVE_JS_OTA_ONLY');
 assert.equal(marker.sourceCommitBeforeMarker,'90167a90ab7f42de34fa57db6874f9e064826ad3');
 assert.equal(marker.sourceScopePR,1103);
 assert.equal(marker.proof.sourceQaHead,'df15ace207a885b90ce67330daa203525c616269');
 assert.equal(marker.proof.approvedMainRCWorkflows.length,5);
 assert.equal(marker.androidPackage,'org.mzbministry.buklod');
 assert.equal(marker.nativeVersion,'1.3.6');
 assert.equal(marker.nativeVersionCode,30);
 assert.equal(marker.expoRuntimeVersion,'1.3.2');
 assert.equal(marker.channel,'production');
 assert.equal(config.android.package,marker.androidPackage);
 assert.equal(config.android.versionCode,marker.nativeVersionCode);
 assert.equal(config.runtimeVersion,marker.expoRuntimeVersion);
 assert.equal(config.extra.eas.projectId,marker.expoProjectId);
 for(const k of ['nativeBuildAuthorized','playReleaseAuthorized','season2ProductionAuthorized'])
   assert.equal(marker[k],false,k+' must stay false');
 assert.equal(marker.proof.noNewNative,true);
 assert.equal(marker.proof.noUnauthorizedSeason2,true);
});

test('consent fix scope is source reviewed and no native/Season 2/clinical changes',()=>{
 assert.equal(scope.baseRef,marker.sourceCommitBeforeMarker);
 assert.equal(scope.allowedPaths.length,3);
 const allowed=new Set([
  '.buklod/releases/buklod-nonseason2-consent-prod-ota-20261122.json',
  '.buklod/scopes/buklod-nonseason2-consent-prod-ota-20261122.json',
  'tests/buklod-nonseason2-consent-prod-ota-marker-20261122.test.cjs'
 ]);
 for(const p of scope.allowedPaths)assert.ok(allowed.has(p),'unauthorized changed path '+p);
 assert.equal(scope.regressionTests.length,1);
 for(const p of marker.proof.approvedSourceDiffPaths)
   assert.ok(/^(?:src\/(?:app\/privacy\/consent\.tsx|providers\/ComplianceProvider\.tsx)|tests\/auth-consent-boot-recovery\.test\.mjs|\.buklod\/scopes\/consent-verification-contrast-20261122\.json|\.github\/workflows\/buklod-consent-prod-rc-no-publish-20261122\.yml)$/.test(p),p);
 assert.equal(marker.proof.backend.backendMutationAuthorized,false);
 assert.equal(marker.proof.backend.migrationRequired,false);
});

test('one canonical protected main-only publisher with independent provider verification',()=>{
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_ANDROID_ONLY_PROD_20261114:'\)/);
 assert.match(workflow,/node scripts\/buklod-season2-production-embargo\.cjs --production/);
 assert.match(workflow,/node scripts\/android-ota-rc\.cjs baseline/);
 assert.match(workflow,/node scripts\/android-ota-rc\.cjs freeze/);
 assert.match(workflow,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(workflow,/eas-cli@latest update --channel production --platform android/);
 assert.equal(marker.publicationStatus,'NOT_YET_PUBLISHED');
 assert.equal(marker.physicalDeviceQA,'WAIVED_BY_OWNER_NOT_PERFORMED');
 assert.equal(marker.proof.lastVerifiedProviderPublish.updateId,'01a201d9-3b7e-7881-b003-79452dd1a015');
 assert.equal(marker.proof.lastVerifiedProviderPublish.runtimeVersion,'1.3.2');
});
