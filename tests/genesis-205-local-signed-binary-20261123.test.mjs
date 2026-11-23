import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const eas=require('../eas.json');
test('2.0.5 verified Expo local signed APK never downgrades certificate or drops any native Godot world',()=>{
 const verifier=read('scripts/genesis-205-verify-local-eas-signed-apk.mjs');
 for(const token of ['EXISTING_EAS_STAGING_CERT_SHA256','certificateSha256',
  "Number(pkg[2]),17","pkg[3],'2.0.5'","org.mzbministry.buklod.staging",
  'assets/godot/empire-arena.zip','splash/buklod-green-b.png',
  'world-art/kingdom.webp','world-art/community.webp','world-art/house.webp',
  'apkSha256','godotPackSha256','sourceHash','packHash',
  'verified source bytes','physicalDeviceQA']) assert.ok(verifier.includes(token),token);
 assert.match(verifier,/expected-godot\.zip/);
 assert.match(verifier,/apksigner/);
 assert.match(verifier,/aapt/);
 assert.doesNotMatch(verifier,/eas update|expo publish|eas submit/);
});
test('One installable original-signer v205 staging EAS profile is isolated from production and 2.0.4 OTA',()=>{
 const p=eas.build['season2-genesis-launch-recovery-staging'];
 assert.equal(p.channel,'season2-genesis-library-205-preview');
 assert.equal(p.android.credentialsSource,'remote');
 assert.equal(p.autoIncrement,false);
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build['season2-genesis-library-staging'].channel,'season2-genesis-library-preview');
 const cfg=require('../app.config.js');
 const env={
 APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',
 EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',
 EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',
 EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',
 EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true',
 EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205:'true'};
 const values=Object.fromEntries(Object.keys(env).map(x=>[x,process.env[x]]));
 try{Object.assign(process.env,env);const a=cfg({config:{}});
  assert.equal(a.android.versionCode,17);
  assert.equal(a.version,'2.0.5');
  assert.equal(a.runtimeVersion,'2.0.5-genesis-godot-launch');
  assert.equal(a.android.package,'org.mzbministry.buklod.staging');
 }finally{for(const [x,v]of Object.entries(values)){if(v===undefined)delete process.env[x];else process.env[x]=v;}}
});
