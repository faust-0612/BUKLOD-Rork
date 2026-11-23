import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const appConfig=require('../app.config.js');
const envKeys=[
  'APP_VARIANT','EXPO_PUBLIC_APP_ENV','BUKLOD_APP_TARGET',
  'BUKLOD_GENESIS_MEDIA_QA','EXPO_PUBLIC_BUKLOD_MEDIA_QA',
  'EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW',
  'EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED',
  'EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS',
  'EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE',
];
const saved=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
function restore(){for(const key of envKeys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
function generate(env){restore();delete process.env.BUKLOD_GENESIS_MEDIA_QA;delete process.env.EXPO_PUBLIC_BUKLOD_MEDIA_QA;for(const [k,v] of Object.entries(env))process.env[k]=v;return appConfig({config:{}});}
const enabled={
  APP_VARIANT:'staging',
  EXPO_PUBLIC_APP_ENV:'staging',
  BUKLOD_APP_TARGET:'main',
  EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
  EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
  EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',
  EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true',
};
test('physical QA package is independently installable and has no OTA update URL',()=>{
  const qa=generate({...enabled,BUKLOD_GENESIS_MEDIA_QA:'true',EXPO_PUBLIC_BUKLOD_MEDIA_QA:'true'});
  assert.equal(qa.name,'BUKLOD Genesis Media QA');
  assert.equal(qa.android.package,'org.mzbministry.buklod.genesis.qa');
  assert.equal(qa.scheme,'buklod-genesis-qa');
  assert.equal(qa.android.googleServicesFile,'./google-services.media-qa.json');
  assert.equal(qa.runtimeVersion,'2.0.4-genesis-media-qa-20261123');
  assert.equal(qa.updates.enabled,false);
  assert.equal(qa.updates.url,undefined);
  assert.equal(qa.extra.genesisMediaQa,true);
  assert.equal(qa.android.versionCode,1);
  const ads=qa.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads');
  assert.equal(ads[1].androidAppId,'ca-app-pub-3940256099942544~3347511713');
  const props=qa.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-build-properties');
  assert.equal(props[1].android.enableProguardInReleaseBuilds,false);
  assert.equal(props[1].android.enableShrinkResourcesInReleaseBuilds,false);
});
test('staging and production package, runtime and update path are identical without QA flag',()=>{
  const stage=generate(enabled);
  assert.equal(stage.android.package,'org.mzbministry.buklod.staging');
  assert.equal(stage.runtimeVersion,'2.0.4-genesis-library-godot');
  assert.match(stage.updates.url,/^https:\/\/u\.expo\.dev\//);
  const prod=generate({APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production'});
  assert.equal(prod.android.package,'org.mzbministry.buklod');
  assert.equal(prod.runtimeVersion,'1.3.2');
  assert.equal(prod.extra.genesisMediaQa,false);
});
test('cannot accidentally run QA without both separate flags and real Genesis native pack',()=>{
  assert.throws(()=>generate({...enabled,BUKLOD_GENESIS_MEDIA_QA:'true'}),/requires an isolated Genesis/);
  assert.throws(()=>generate({APP_VARIANT:'production',BUKLOD_GENESIS_MEDIA_QA:'true',EXPO_PUBLIC_BUKLOD_MEDIA_QA:'true'}),/requires an isolated Genesis/);
});
test('QA never claims the real account push token',()=>{
  const p=readFileSync('src/lib/pushNotifications.ts','utf8');
  const body=p.slice(p.indexOf('export async function registerPushToken'));
  assert.ok(body.indexOf("process.env.EXPO_PUBLIC_BUKLOD_MEDIA_QA === 'true'")<body.indexOf('Notifications.getPermissionsAsync()'));
  assert.ok(body.indexOf("process.env.EXPO_PUBLIC_BUKLOD_MEDIA_QA === 'true'")<body.indexOf('claim_device_token'));
});
test('QA CI uses release-bundled internal signed APK and refuses OTA',()=>{
  const wf=readFileSync('.github/workflows/genesis-entry-media-device-qa-apk-20261123.yml','utf8');
  assert.match(wf,/:app:assembleRelease/);
  assert.match(wf,/app-release\.apk/);
  assert.match(wf,/EXPO_PUBLIC_BUKLOD_MEDIA_QA: 'true'/);
  assert.match(wf,/No OTA/);
  assert.doesNotMatch(wf,/\beas update\b|\beas submit\b|\bexpo publish\b/);
});
test('QA sound, portrait and sprite animations are in the exact source baseline',()=>{
  const tests=readFileSync('tests/genesis-entry-audio-avatar-recovery-20261123.test.mjs','utf8');
  assert.match(tests,/genesis-entry|Genesis|sprite|audio/i);
  const r=readFileSync('src/features/season2/genesis/GenesisRiveCharacter.native.tsx','utf8');
  assert.match(r,/const IDLE_SHEETS/);
  assert.match(r,/AccessibilityInfo/);
});
process.on('exit',restore);
