import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { inspectNativeLabBuild } from '../scripts/native-lab-build-preflight.mjs';
const require = createRequire(import.meta.url);
const original = {
  APP_VARIANT: process.env.APP_VARIANT,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  BUKLOD_APP_TARGET: process.env.BUKLOD_APP_TARGET,
};
process.env.APP_VARIANT = 'native-lab';
process.env.EXPO_PUBLIC_APP_ENV = 'staging';
process.env.BUKLOD_APP_TARGET = 'main';
const config = require('../app.config.js')({config:{extra:{}}});
for (const [k,v] of Object.entries(original)) {
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}
const eas = JSON.parse(fs.readFileSync('eas.json','utf8'));
const gate = JSON.parse(fs.readFileSync('release/native-lab-apk-20261115.json','utf8'));
const fixture = {
  config, eas,
  gate: { ...gate, readyForBuild:true, nativeGifCommitContentVerified:true, googleDriveOAuthNativeVerified:true,
    videoScrollAdPrefetchConsolidated:true, firebaseClientRegistered:true },
  firebase: {client:[{client_info:{android_client_info:{package_name:'org.mzbministry.buklod.nativeqa'},
    mobilesdk_app_id:'1:1234567890:android:fixture'},oauth_client:[{client_type:1,android_info:{package_name:'org.mzbministry.buklod.nativeqa',certificate_hash:'a'.repeat(40)}}]}]},
  env:{EXPO_TOKEN:'fixture-not-a-real-token',EXPO_PUBLIC_SUPABASE_URL:'https://isolatedqa.supabase.co',
    BUKLOD_STAGING_PROJECT_REF:'isolatedqa',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},
};
const inspect = changes => inspectNativeLabBuild({...fixture,...changes});

test('preflight contract recognizes complete isolated fixture but does not attest real credentials', () => {
  assert.deepEqual(inspect({}), {ready:true,failures:[]});
});

test('real release gate remains blocked until native GIF, Google Drive and ad/scroll reconciliation', () => {
  const result = inspect({gate});
  assert.equal(result.ready,false);
  assert.ok(result.failures.some(f=>f.includes('not authorized')));
  assert.ok(result.failures.some(f=>f.includes('IME GIF')));
  assert.ok(result.failures.some(f=>f.includes('Drive native')));
  assert.ok(result.failures.some(f=>f.includes('NativeAd')));
});

test('rejects reused Firebase staging client, missing package and wrong runtime', () => {
  const reused = {client:[{client_info:{android_client_info:{package_name:'org.mzbministry.buklod.staging'},mobilesdk_app_id:'staging-fixture'}}]};
  assert.equal(inspect({firebase:reused}).ready,false);
  assert.equal(inspect({firebase:null}).ready,false);
  assert.equal(inspect({config:{...config,runtimeVersion:'1.3.2'}}).ready,false);
  assert.equal(inspect({eas:{...eas,build:{...eas.build,'native-lab':{...eas.build['native-lab'],channel:'staging-user'}}}}).ready,false);
});

test('rejects Firebase-only Android registration without a signed Android OAuth client', () => {
  const noOAuth = {client:[{client_info:{android_client_info:{package_name:'org.mzbministry.buklod.nativeqa'},mobilesdk_app_id:'fixture'}}]};
  assert.equal(inspect({firebase:noOAuth}).ready,false);
  assert.ok(inspect({firebase:noOAuth}).failures.some(x=>x.includes('Android Google OAuth')));
  const wrongPackage = {client:[{...fixture.firebase.client[0],oauth_client:[{client_type:1,android_info:{
    package_name:'org.mzbministry.buklod.staging',certificate_hash:'a'.repeat(40)}}]}]};
  assert.equal(inspect({firebase:wrongPackage}).ready,false);
  const webOnly = {client:[{...fixture.firebase.client[0],oauth_client:[{client_type:3,android_info:{
    package_name:'org.mzbministry.buklod.nativeqa',certificate_hash:'a'.repeat(40)}}]}]};
  assert.equal(inspect({firebase:webOnly}).ready,false);
});

test('rejects production Supabase, wrong staging project and missing token', () => {
  assert.equal(inspect({env:{...fixture.env,EXPO_PUBLIC_SUPABASE_URL:'https://yhanxndaqbmuzbdqlblu.supabase.co',
    BUKLOD_STAGING_PROJECT_REF:'yhanxndaqbmuzbdqlblu'}}).ready,false);
  assert.equal(inspect({env:{...fixture.env,BUKLOD_STAGING_PROJECT_REF:'wrongproject'}}).ready,false);
  assert.equal(inspect({env:{...fixture.env,EXPO_TOKEN:''}}).ready,false);
});

test('workflow cannot publish OTA/web/Play and requires exact new runtime plus registered native QA Firebase', () => {
  const w = fs.readFileSync('.github/workflows/buklod-native-lab-apk-20261115.yml','utf8');
  assert.match(w,/dev\/native-lab-isolated-runtime-20261115/);
  assert.match(w,/BUKLOD_NATIVE_LAB_SIGNED_APK_20261115:/);
  assert.match(w,/NATIVE_LAB_FIREBASE_JSON_B64/);
  assert.match(w,/org\.mzbministry\.buklod\.nativeqa/);
  assert.match(w,/node scripts\/native-lab-build-preflight\.mjs/);
  assert.match(w,/--profile native-lab/);
  assert.doesNotMatch(w,/eas-cli[^\n]* update --channel/);
  assert.doesNotMatch(w,/eas-cli[^\n]* submit --platform/);
  assert.doesNotMatch(w,/vercel deploy/);
});
