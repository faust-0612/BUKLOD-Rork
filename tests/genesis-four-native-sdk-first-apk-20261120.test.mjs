import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('first Genesis native library includes four REAL Maven AAR families, not placeholders',()=>{
 const gradle=read('modules/buklod-genesis-ime/android/build.gradle');
 for(const exact of [
   'org.godotengine:godot:4.7.2.stable',
   'androidx.media3:media3-transformer:1.11.1',
   'androidx.media3:media3-common:1.11.1',
   'androidx.media3:media3-effect:1.11.1',
   'com.google.android.play:app-update:2.1.0',
   'com.google.android.gms:play-services-auth:22.0.0'
 ])assert.ok(gradle.includes(exact),exact);
 const expo=JSON.parse(read('modules/buklod-genesis-ime/expo-module.config.json'));
 assert.ok(expo.android.modules.includes('expo.modules.buklodgenesisime.BuklodGenesisNativeFoundationModule'));
 const native=read('modules/buklod-genesis-ime/android/src/main/java/expo/modules/buklodgenesisime/BuklodGenesisNativeFoundationModule.kt');
 for(const entry of ['openGodotWorld','transcodeVideo','cancelTranscode','getPlayUpdateState',
   'startImmediatePlayUpdate','authorizeDrive','clearDriveToken'])
  assert.ok(native.includes('AsyncFunction("'+entry+'")'),entry);
 assert.match(native,/Identity\.getAuthorizationClient/);
 assert.match(native,/Transformer\.Builder/);
 assert.match(native,/AppUpdateManagerFactory\.create/);
 assert.match(native,/activeTranscode/);
});

test('Godot project content is an actual reproducible ZIP pack for isolated Android Activity',()=>{
 const native=read('modules/buklod-genesis-ime/android/src/main/java/expo/modules/buklodgenesisime/GodotGenesisActivity.java');
 const manifest=read('modules/buklod-genesis-ime/android/src/main/AndroidManifest.xml');
 const config=read('app.config.js');
 assert.match(native,/extends GodotActivity/);
 assert.match(native,/--main-pack/);
 assert.match(native,/buklod_genesis_kingdom\.zip/);
 assert.match(manifest,/android:exported="false"/);
 assert.match(manifest,/android:process=":genesis3d"/);
 assert.match(config,/genesisNativePreview \? \['\.\/plugins\/withBuklodGenesisGodot\.js'\] : \[\]/);
 const {godotPack,FILES}=require('../scripts/genesis-native/godotZip.cjs');
 const pack=godotPack(new URL('../godot/genesis-creation/',import.meta.url).pathname);
 assert.equal(FILES.length,3);
 assert.ok(pack.buffer.length>1000);
 assert.equal(pack.buffer.readUInt32LE(0),0x04034b50);
 assert.match(pack.sha256,/^[a-f0-9]{64}$/);
 assert.match(read('godot/genesis-creation/scripts/world.gd'),/extends Node3D/);
 assert.match(read('godot/genesis-creation/project.godot'),/Genesis: Let There Be Light/);
});

test('Genesis preview runtime and sensitive Drive OAuth are isolated and fail closed',()=>{
 const a=read('app.config.js');
 const j=read('src/lib/genesisNativeFoundation.ts');
 const bridge=read('modules/buklod-genesis-ime/android/src/main/java/expo/modules/buklodgenesisime/BuklodGenesisNativeFoundationModule.kt');
 assert.match(a,/EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW === 'true'/);
 assert.match(j,/verifyBinding\(identity.sub,buklodUserId\)/);
 assert.match(j,/oauth2\/v3\/userinfo/);
 assert.match(bridge,/drive\.file/);
 assert.match(bridge,/userinfo\.email/);
 assert.match(bridge,/lastDriveToken/);
 assert.doesNotMatch(bridge,/service_role|refresh_token|setItemAsync|supabase\.co/);
});

test('native prerequisite source is ready to compile, but release remains blocked until signed APK proof',()=>{
 const inventory=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
 const ids=['native-media3-compression','godot-android-3d','play-core-in-app-update'];
 for(const id of ids)
  assert.equal(inventory.nativeFeatures.find(x=>x.id===id)?.status,'native-source-uncompiled');
 assert.equal(inventory.nativeFeatures.find(x=>x.id==='drive-oauth-cloud-sync').status,'held-credentials');
 assert.equal(inventory.signedApk.exists,false);
 assert.equal(inventory.buildReady,false);
 assert.equal(inventory.releaseReady,false);
 const workflow=read('.github/workflows/genesis-android-compile-smoke-20261120.yml');
 assert.match(workflow,/scripts\/install-skia\.mjs/);
 assert.match(workflow,/libskia\.a/);
 assert.match(workflow,/assembleDebug --no-daemon/);
 assert.match(read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml'),/BLOCK: cannot use BUKLOD MAIN production Supabase/);
});
