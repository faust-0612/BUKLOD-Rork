import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Android OAuth native bridge is auto-linked and uses least-privilege Google SDK only',()=>{
  const cfg=JSON.parse(read('modules/buklod-genesis-drive-auth/expo-module.config.json'));
  assert.deepEqual(cfg.android.modules,['expo.modules.buklodgenesisdrive.BuklodGenesisDriveAuthModule']);
  const gradle=read('modules/buklod-genesis-drive-auth/android/build.gradle');
  assert.match(gradle,/com\.google\.android\.gms:play-services-auth:22\.0\.0/);
  assert.match(gradle,/versionCode 1[\s\S]*versionName '1\.0\.0'/);
  const kotlin=read('modules/buklod-genesis-drive-auth/android/src/main/java/expo/modules/buklodgenesisdrive/BuklodGenesisDriveAuthModule.kt');
  assert.match(kotlin,/drive\.file/);
  assert.match(kotlin,/openid/);
  assert.match(kotlin,/userinfo\.email/);
  assert.match(kotlin,/AuthorizationRequest\.Prompt\.SELECT_ACCOUNT/);
  assert.match(kotlin,/pendingBuklodUserId/);
  assert.match(kotlin,/activity\.packageName != "org\.mzbministry\.buklod\.staging"/);
  assert.match(kotlin,/handler\.postDelayed\(timeout, 90_000\)/);
  assert.match(kotlin,/Identity\.getAuthorizationClient/);
  assert.match(kotlin,/requiresIdentityVerification" to true/);
  assert.match(kotlin,/OnActivityDestroys/);
  assert.doesNotMatch(kotlin,/offline_access|refresh_token|scope.*drive\/[^f]|service_role|SharedPreferences|Log\.d\(/);
});

test('native-only Drive consent never pretends a Google/Buklod subject match or auto syncs',()=>{
  const wrapper=read('modules/buklod-genesis-drive-auth/index.ts');
  assert.match(wrapper,/beginUnverifiedGenesisDriveConsent/);
  assert.match(wrapper,/requiresIdentityVerification/);
  assert.match(wrapper,/EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true'/);
  assert.doesNotMatch(wrapper,/upload|syncDrive|fetch\(/);
  const inv=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
  assert.equal(inv.nativeFeatures.find(x=>x.id==='drive-oauth-cloud-sync').status,'native-source-uncompiled');
  assert.equal(inv.signedApk.exists,false);
});
