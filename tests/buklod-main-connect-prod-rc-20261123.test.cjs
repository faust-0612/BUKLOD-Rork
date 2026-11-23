'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const read=p=>readFileSync(p,'utf8');
const record=JSON.parse(read('.buklod/releases/buklod-main-connect-latest-nonseason2-ota-20261123.json'));
const scope=JSON.parse(read('.buklod/scopes/buklod-main-connect-prod-rc-20261123.json'));
const config=require('../app.config.js')({config:{}});
const publisher=read('.github/workflows/production_android_ota.yml');
const thread=read('src/components/BuklodConnectThread.tsx');

test('production candidate is exact MAIN source and existing native only',()=>{
  assert.equal(record.sourceCommitBeforeMarker,'ae2decb85bda382644e369aa0affaa5a53096978');
  assert.equal(record.sourceScopePR,1144);
  assert.equal(record.productionTarget,'BUKLOD_MAIN_ANDROID');
  assert.equal(record.releaseMode,'EXISTING_NATIVE_JS_OTA_ONLY');
  assert.equal(record.androidPackage,'org.mzbministry.buklod');
  assert.equal(record.expoRuntimeVersion,'1.3.2');
  assert.equal(record.nativeVersion,'1.3.6');
  assert.equal(record.nativeVersionCode,30);
  assert.equal(config.android.package,record.androidPackage);
  assert.equal(config.android.versionCode,record.nativeVersionCode);
  assert.equal(config.runtimeVersion,record.expoRuntimeVersion);
  assert.equal(config.extra.eas.projectId,record.expoProjectId);
  assert.equal(scope.baseRef,record.sourceCommitBeforeMarker);
  assert.equal(record.proof.noNewNative,true);
  assert.equal(record.proof.noUnauthorizedSeason2,true);
  for(const key of ['nativeBuildAuthorized','playReleaseAuthorized','season2ProductionAuthorized','webDeploymentAuthorized']){
    assert.equal(record[key],false,key);
  }
});

test('targeted Connect behavior is present; no unrelated DEV intake is authorized',()=>{
  assert.match(thread,/const userScrolledUpRef = useRef\(false\)/);
  assert.match(thread,/contentOffset\.y < previousOffset - 2/);
  assert.match(thread,/listAnchoredRef\.current &&[\s\S]*?!pinLatestOnOpenRef\.current &&[\s\S]*?userScrolledUpRef\.current/);
  assert.match(thread,/opacity: listAnchored \? 1 : 0/);
  assert.equal(record.proof.changedSourcePaths.length,1);
  assert.equal(record.proof.changedSourcePaths[0],'src/components/BuklodConnectThread.tsx');
  assert.equal(record.proof.fullDiffPaths.length,4);
  assert.ok(record.proof.excludedIncompleteDevPRs.includes(1138));
  assert.ok(record.proof.excludedIncompleteDevPRs.includes(1141));
  assert.deepEqual(new Set(scope.allowedPaths),new Set([
    '.buklod/releases/buklod-main-connect-latest-nonseason2-ota-20261123.json',
    '.buklod/scopes/buklod-main-connect-prod-rc-20261123.json',
    'tests/buklod-main-connect-prod-rc-20261123.test.cjs'
  ]));
});

test('no premature publish: canonical main-only publisher and release hold stay enforced',()=>{
  assert.match(publisher,/branches: \[main\]/);
  assert.match(publisher,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_ANDROID_ONLY_PROD_20261114:'\)/);
  assert.match(publisher,/node scripts\/buklod-season2-production-embargo\.cjs --production/);
  assert.match(publisher,/node scripts\/android-ota-rc\.cjs baseline/);
  assert.match(publisher,/node scripts\/android-ota-rc\.cjs freeze/);
  assert.match(publisher,/node scripts\/android-ota-rc\.cjs published/);
  assert.match(publisher,/eas-cli@latest update --channel production --platform android/);
  assert.equal(record.publicationStatus,'HOLD_PENDING_EXACT_RC_AD_NAV_AND_LIVE_READBACK');
  assert.equal(record.physicalDeviceQA,'NOT_PERFORMED_NO_WAIVER_FOR_THIS_RELEASE');
  assert.equal(record.proof.adAndTabNavigationDeviceEvidence,'NOT_VERIFIED');
  assert.equal(record.proof.exactFrozenAndroidRc,'NOT_YET_BUILT');
  assert.equal(scope.regressionTests.length,1);
});
