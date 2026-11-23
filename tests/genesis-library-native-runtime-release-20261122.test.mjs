import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const config=require('../app.config.js');
const eas=require('../eas.json');
function app(values){
 const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys)delete process.env[k];
  Object.assign(process.env,values);
  return config({config:{}});
 }finally{
  for(const k of keys){
   if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];
  }
 }
}
test('2.0.4 Library unified Godot staging runtime and isolated channel without production ABI drift',()=>{
 const flags={APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true'};
 const stage=app(flags);
 assert.equal(stage.runtimeVersion,'2.0.4-genesis-library-godot');
 assert.equal(stage.version,'2.0.4');
 assert.equal(stage.android.package,'org.mzbministry.buklod.staging');
 assert.equal(stage.extra.appTarget,'main');
 assert.ok(stage.plugins.includes('./plugins/withBuklodGodotArenaPack.js'));
 const ad=stage.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads');
 assert.equal(ad?.[1]?.androidAppId,'ca-app-pub-3940256099942544~3347511713');
 const prior=app({...flags,EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'false'});
 assert.equal(prior.runtimeVersion,'2.0.3-genesis-unified-godot');
 const prod=app({...flags,APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production'});
 assert.equal(prod.runtimeVersion,'1.3.2');
 assert.equal(prod.android.package,'org.mzbministry.buklod');
 assert.equal(prod.plugins.includes('./plugins/withBuklodGodotArenaPack.js'),false);
});
test('EAS stage remains a distinct internal channel without embedded credentials or ranked authority',()=>{
 const p=eas.build['season2-genesis-library-staging'];
 assert.equal(p.extends,'season2-genesis-unified-worlds-staging');
 assert.equal(p.channel,'season2-genesis-library-preview');
 assert.equal(p.android.buildType,'apk');
 assert.equal(p.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE,'true');
 assert.equal(p.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
 assert.equal(p.env.EXPO_PUBLIC_SUPABASE_URL,undefined);
 assert.equal(p.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,undefined);
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.production.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE,undefined);
});
test('native pack retains all three original unified worlds and Arena Library audio',()=>{
 const source=readFileSync(new URL('../scripts/build-empire-godot-pack.mjs',import.meta.url),'utf8');
 for(const key of ['arenaSfxEntries','classic_conquest','genesis_rift','dominion_frontier','special_event','world-art/kingdom.webp','world-art/community.webp','world-art/house.webp','world-audio/claim.wav','scenes/WorldPreview.tscn','tests/world_smoke.gd'])assert.ok(source.includes(key),'Missing '+key);
 const audioSmoke=readFileSync(new URL('../godot/empire-arena/tests/library_modes_audio_smoke.gd',import.meta.url),'utf8');
 assert.match(audioSmoke,/BUKLOD_GODOT_LIBRARY_MODES_AUDIO_PASS/);
 assert.match(source,/ranked: false, serverAccess: false/);
});

test('signed staging build workflow is build-only and requires successful exact native proof before EAS',()=>{
 const source=readFileSync(new URL('../.github/workflows/genesis-library-eas-signed-apk-20261122.yml',import.meta.url),'utf8');
 assert.match(source,/BUKLOD_GENESIS_2_0_4_SIGNED_BUILD:/);
 assert.match(source,/NATIVE_PROOF_SHA/);
 assert.match(source,/j\.conclusion,'success'/);
 assert.match(source,/git diff --quiet/);
 assert.match(source,/season2-genesis-library-staging/);
 assert.match(source,/EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED: 'false'/);
 assert.match(source,/EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW/);
 assert.match(source,/genesis-library-verify-signed-apk\.mjs/);
 assert.match(source,/secrets\.EXPO_TOKEN/);
 assert.doesNotMatch(source,/\beas\s+(?:update|submit|channel:edit|branch:publish)\b|\bexpo\s+publish\b/);
});
test('signed APK verifier enforces same EAS certificate, all ABIs, 4 worlds and 70 sound cues',()=>{
 const code=readFileSync(new URL('../scripts/genesis-library-verify-signed-apk.mjs',import.meta.url),'utf8');
 assert.match(code,/2\.0\.4-genesis-library-godot/);
 assert.match(code,/season2-genesis-library-preview/);
 assert.match(code,/EXISTING_EAS_STAGING_CERT_SHA256/);
 assert.match(code,/expectedSigner/);
 assert.match(code,/EXPECTED_ABIS/);
 assert.match(code,/AUDIO_CUES = 70/);
 assert.match(code,/scripts\/arena_library_skills\.gd/);
 assert.match(code,/world-art\/community.webp/);
 assert.match(code,/Existing staging signer override differs/i);
 assert.match(code,/deviceQA:'PENDING'/);
});

test('locally signed staging fallback is EAS signing with remote original certificate, not a debug APK',()=>{
 const source=readFileSync(new URL('../.github/workflows/genesis-library-eas-local-signed-apk-20261122.yml',import.meta.url),'utf8');
 assert.match(source,/BUKLOD_GENESIS_2_0_4_LOCAL_SIGNED_BUILD:/);
 assert.match(source,/build --platform android --profile season2-genesis-library-staging --local --non-interactive/);
 assert.match(source,/p.android.credentialsSource='remote'/);
 assert.match(source,/p.autoIncrement=false/);
 assert.match(source,/versionCode: isStaging \? \(libraryArenaNativePreview \? 16 : undefined\)/);
 assert.match(source,/EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}/);
 assert.match(source,/git diff --quiet/);
 assert.match(source,/LOCAL_SIGNED_APK_ACCEPTANCE_PASS|LOCAL SIGNED APK ACCEPTANCE PASS/);
 assert.match(source,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(source,/\beas\s+(?:update|submit|channel:edit|branch:publish)\b|\bexpo\s+publish\b/);
});
test('local signed APK verifier fails closed on any wrong signer, stale version or altered Godot pack',()=>{
 const source=readFileSync(new URL('../scripts/genesis-library-verify-local-signed-apk.mjs',import.meta.url),'utf8');
 assert.match(source,/inspectUnifiedSignedApk/);
 assert.match(source,/EXISTING_EAS_STAGING_CERT_SHA256/);
 assert.match(source,/versionCode>=16/);
 assert.match(source,/embedded,canonical/);
 assert.match(source,/genesis-library-verify-signed-apk\.mjs/);
 assert.match(source,/deviceQA:'NOT_PERFORMED'/);
 assert.match(source,/otaPublished:false/);
});

test('local EAS release build avoids known Gradle 512m Metaspace OOM and unbounded parallel workers',()=>{
 const source=readFileSync(new URL('../.github/workflows/genesis-library-eas-local-signed-apk-20261122.yml',import.meta.url),'utf8');
 assert.match(source,/GRADLE_OPTS: '-Dorg\.gradle\.jvmargs="/);
 assert.match(source,/MaxMetaspaceSize=1536m/);
 assert.match(source,/-Xmx4096m/);
 assert.match(source,/org\.gradle\.workers\.max=1/);
 assert.match(source,/org\.gradle\.parallel=false/);
 assert.match(source,/timeout --signal=TERM --kill-after=30s 85m npx --yes eas-cli@27\.9\.0 build/);
 assert.doesNotMatch(source,/MaxMetaspaceSize=512m|-Xmx2304m/);
});

test('R8 Java heap recovery keeps minification, release lint and keystore verification enabled',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/genesis-library-eas-local-signed-apk-20261122.yml',import.meta.url),'utf8');
 assert.match(workflow,/R8 \+ Rive release lint exhausted 2304m heap/);
 assert.match(workflow,/-Xmx4096m/);
 assert.match(workflow,/org\.gradle\.workers\.max=1/);
 assert.match(workflow,/MEM_MIB/);
 assert.match(workflow,/genesis-library-verify-local-signed-apk\.mjs/);
 assert.doesNotMatch(workflow,/enableMinifyInReleaseBuilds.*false|enableProguardInReleaseBuilds.*false|lintVital.*skip|SKIP_R8/);
});
