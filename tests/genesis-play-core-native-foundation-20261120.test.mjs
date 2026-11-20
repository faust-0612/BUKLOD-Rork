import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Play update module autolinks and supplies real native Core without influencing staging',()=>{
 const module=JSON.parse(read('modules/buklod-genesis-play-updates/expo-module.config.json'));
 assert.equal(module.android.modules[0],'expo.modules.buklodgenesisplayupdates.BuklodGenesisPlayUpdateModule');
 const gradle=read('modules/buklod-genesis-play-updates/android/build.gradle');
 assert.match(gradle,/com\.google\.android\.play:app-update:2\.1\.0/);
 assert.match(gradle,/expo-module-gradle-plugin/);
 assert.match(gradle,/versionCode 1[\s\S]*versionName '1\.0\.0'/);
 const kotlin=read('modules/buklod-genesis-play-updates/android/src/main/java/expo/modules/buklodgenesisplayupdates/BuklodGenesisPlayUpdateModule.kt');
 assert.match(kotlin,/activity\.packageName != productionPackage/);
 assert.match(kotlin,/requiredVersionCode < 1/);
 assert.match(kotlin,/info\.availableVersionCode\(\) < requiredVersionCode/);
 assert.match(kotlin,/info\.isUpdateTypeAllowed\(AppUpdateType\.IMMEDIATE\)/);
 assert.match(kotlin,/manager\.startUpdateFlowForResult/);
 assert.match(kotlin,/launchInProgress\.compareAndSet\(false, true\)/);
 assert.match(kotlin,/Events\("onImmediateUpdateResult"\)/);
 assert.doesNotMatch(kotlin,/forceInstall|adb|installPackage|REQUEST_INSTALL_PACKAGES/);
});
test('Play Core module is opt-in and staging-safe; release still needs exact APK proof',()=>{
 const bridge=read('modules/buklod-genesis-play-updates/index.ts');
 assert.match(bridge,/requireOptionalNativeModule/);
 assert.match(bridge,/Platform\.OS !== 'android'/);
 assert.match(bridge,/Number\.isSafeInteger/);
 const inv=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
 assert.equal(inv.nativeFeatures.find(x=>x.id==='play-core-in-app-update').status,'native-source-uncompiled');
 assert.equal(inv.signedApk.exists,false);
 const apk=read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml');
 assert.match(apk,/genesis-silent-ota-native-integration-20261120/);
 assert.match(apk,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_GENESIS_STAGING_APK_START:'/);
});
