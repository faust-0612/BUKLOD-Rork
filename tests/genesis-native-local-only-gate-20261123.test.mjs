import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {auditLocalNative,NATIVE_APPLICATION_ID,FEATURES,MIN_APK_BYTES} from '../scripts/genesis-native-local-only-gate.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'buklod-local-native-'));
 const n=join(root,'native-genesis');
 const put=(path,content)=>{const p=join(n,path);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,content);};
 put('android/app/build.gradle.kts',`android { defaultConfig { applicationId = "${NATIVE_APPLICATION_ID}" } }\nimplementation("org.godotengine:godot:4.7.2.stable")`);
 put('android/app/src/main/AndroidManifest.xml','<manifest><application><activity android:exported="false" /></application></manifest>');
 put('android/app/src/main/res/values-v31/themes.xml','<resources><item name="windowSplashScreenAnimatedIcon">@drawable/logo</item></resources>');
 put('android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GifInputHandler.kt',
   'class GifInputHandler { /* OnCommitContentListener image/gif releasePermission */ }');
 put('build-local.sh','#!/bin/sh\n# godot build\n./android/gradlew assembleRelease');
 put('parity.json',JSON.stringify({schemaVersion:1,features:FEATURES.map(id=>({id,implemented:false,verified:false}))}));
 put('approved-assets.json',JSON.stringify({schemaVersion:1,assets:[]}));
 const env={GENESIS_NATIVE_STAGING_SUPABASE_URL:'https://totallyseparatenonmainid.supabase.co',
  GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_1234567890abcdefghijklmn'};
 return {root,n,put,env,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
async function run(f,options={}){return auditLocalNative(f.root,{env:f.env,...options});}
test('actual Expo-only repository cannot masquerade as finished local no-Expo native APK',async()=>{
 const f=fixture();try{const r=await run(f);assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.startsWith('UNVERIFIED_APP_FEATURE:')));
  assert.ok(r.errors.some(x=>x.startsWith('INSUFFICIENT_NATIVE_GAME_ASSETS:')));
 }finally{f.cleanup();}
});
test('live MAIN backend is always rejected even when appId is isolated',async()=>{
 const f=fixture();try{f.env.GENESIS_NATIVE_STAGING_SUPABASE_URL='https://yhanxndaqbmuzbdqlblu.supabase.co';
  const r=await run(f);assert.ok(r.errors.some(x=>x.startsWith('BACKEND_NOT_ISOLATED')));
 }finally{f.cleanup();}
});
test('existing staging and production Android package IDs are blocked',async()=>{
 const f=fixture();try{for(const appId of ['org.mzbministry.buklod.staging','org.mzbministry.buklod']){
  f.put('android/app/build.gradle.kts',`android { defaultConfig { applicationId = "${appId}" } }\nimplementation("org.godotengine:godot:4.7.2.stable")`);
  const r=await run(f);assert.ok(r.errors.some(x=>x.startsWith('WRONG_NATIVE_APPLICATION_ID')));
 }}finally{f.cleanup();}
});
test('Expo/EAS/Vercel build fallback is rejected within native project',async()=>{
 const f=fixture();try{f.put('build-local.sh','#!/bin/sh\nexpo prebuild && eas build --local && vercel deploy && godot --headless');
  const r=await run(f);assert.ok(r.errors.some(x=>x.startsWith('EXPO_OR_CLOUD_DEPENDENCY')));
  assert.ok(r.errors.some(x=>x.startsWith('NO_NATIVE_LOCAL_BUILD_ENTRYPOINT')));
 }finally{f.cleanup();}
});
test('APK >= 800 MB is a hard binary gate and does not infer game completeness',async()=>{
 const f=fixture();try{const apk=join(f.root,'incomplete.apk');writeFileSync(apk,'fake APK');
  const r=await run(f,{apk});assert.ok(r.errors.some(x=>x.startsWith('APK_UNDER_800MB')));
  assert.equal(r.details.binaryReady,false);assert.equal(MIN_APK_BYTES,800000000);
 }finally{f.cleanup();}
});
test('missing GIF keyboard content and native splash are independent blockers',async()=>{
 const f=fixture();try{
  f.put('android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GifInputHandler.kt','class GifInputHandler {}');
  f.put('android/app/src/main/res/values-v31/themes.xml','<resources></resources>');
  const r=await run(f);assert.ok(r.errors.includes('GIF_IME_CONTENT_RECEIPT_NOT_IMPLEMENTED'));
  assert.ok(r.errors.includes('MISSING_ANDROID_12_NATIVE_SPLASH'));
 }finally{f.cleanup();}
});
