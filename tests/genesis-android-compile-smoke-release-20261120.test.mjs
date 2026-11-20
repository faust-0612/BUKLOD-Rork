import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('offline native compile workflow deliberately cannot publish a release',()=>{
 const w=read('.github/workflows/genesis-android-compile-smoke-20261120.yml');
 assert.match(w,/BUKLOD_GENESIS_NATIVE_COMPILE_SMOKE/);
 assert.match(w,/2\.0\.0-genesis-preview/);
 assert.match(w,/assembleDebug --no-daemon/);
 assert.match(w,/-PreactNativeArchitectures=arm64-v8a/);
 assert.match(w,/cancel-in-progress: true/);
 assert.match(w,/NOT full-ABI or release verification/);
 assert.match(w,/expo prebuild --platform android/);
 assert.match(w,/npm run genesis:theme:gate/);
 assert.match(w,/genesis-compile-placeholder\.invalid/);
 assert.match(w,/NO working Supabase, NO EAS/);
 assert.doesNotMatch(w,/\beas-cli\b|\beas build\b|\beas update\b|\bactions\/upload-artifact\b/);
 assert.doesNotMatch(w,/\bapply_migration\b|\bexecute_sql\b/);
});
test('Godot foundation is included as a dormant native module, not a verified or playable 3D scene',()=>{
 const pkg=JSON.parse(read('package.json'));
 for(const dep of ['@rive-app/react-native','@shopify/react-native-skia','expo-audio','expo-updates','react-native-reanimated'])
  assert.ok(pkg.dependencies[dep],dep);
 const inv=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
 assert.equal(inv.signedApk.exists,false);
 assert.equal(inv.nativeFeatures.find(x=>x.id==='godot-android-3d').status,'native-source-uncompiled');
 assert.equal(inv.nativeFeatures.find(x=>x.id==='drive-oauth-cloud-sync').status,'native-source-uncompiled');
 assert.equal(inv.releaseReady,false);
});
