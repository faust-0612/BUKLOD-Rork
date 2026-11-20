import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Genesis staging native APK uses distinct real Expo runtime and package',()=>{
 const c=read('app.config.js');
 const eas=JSON.parse(read('eas.json'));
 assert.match(c,/genesisNativePreview \? '2\.0\.0-genesis-preview' : '1\.3\.2'/);
 assert.match(c,/org\.mzbministry\.buklod\.staging/);
 assert.equal(eas.build['season2-genesis-preview'].channel,'season2-genesis-preview');
 assert.equal(eas.build['season2-genesis-preview'].android.buildType,'apk');
 assert.equal(eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
});
test('stage workflow has nonprod source, hosted identity, and no OTA push',()=>{
 const w=read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml');
 assert.match(w,/dev\/genesis-season-wordmark-appwide-20261120/);
 assert.match(w,/startsWith\(github\.event\.head_commit\.message/);
 assert.match(w,/BUKLOD_GENESIS_STAGING_APK_START/);
 assert.match(w,/secrets\.EXPO_TOKEN/);
 assert.match(w,/secrets\.STAGING_FIREBASE_JSON_B64/);
 assert.match(w,/secrets\.STAGING_SUPABASE_URL/);
 assert.match(w,/env:pull --environment preview/);
 assert.match(w,/oppswibwjrruxkrpiwej/);
 assert.match(w,/cjtehbfspgimyhifnjon/);
 assert.match(w,/yhanxndaqbmuzbdqlblu/);
 assert.match(w,/genesis-verify-signed-apk\.mjs --receipt=/);
 assert.ok(w.indexOf('npm ci --ignore-scripts')<w.indexOf('env:pull --environment preview'),'Expo dependencies must be installed before EAS env pull');
 assert.match(w,/data\.client=clients/);
 assert.match(w,/npx tsc --noEmit/);
 assert.match(w,/npx expo export --platform android/);
 assert.match(w,/build --platform android --profile season2-genesis-preview/);
 assert.doesNotMatch(w,/eas-cli[^\n]*update --/);
 assert.doesNotMatch(w,/--profile production/);
 assert.doesNotMatch(w,/track[:=]production|channel[:=]production/i);
});
test('new Genesis native integrations are source-only until signed APK and actual device acceptance',()=>{
 const inv=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
 assert.equal(inv.signedApk.exists,false);
 for(const id of ['native-media3-compression','godot-android-3d','drive-oauth-cloud-sync','play-core-in-app-update']){
  const row=inv.nativeFeatures.find(x=>x.id===id);
  assert.equal(row.status,'native-source-uncompiled',id);
 }
 for(const name of ['@rive-app/react-native','@shopify/react-native-skia','expo-audio','expo-updates']){
  assert.ok(JSON.parse(read('package.json')).dependencies[name],name);
 }
});
