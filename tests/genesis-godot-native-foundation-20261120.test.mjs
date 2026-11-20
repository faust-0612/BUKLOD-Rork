import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Genesis Android APK native Godot AAR is bundled but isolated to an unexported renderer process',()=>{
  const cfg=JSON.parse(read('modules/buklod-genesis-godot/expo-module.config.json'));
  assert.deepEqual(cfg.android.modules,['expo.modules.buklodgenesisgodot.BuklodGenesisGodotModule']);
  const gradle=read('modules/buklod-genesis-godot/android/build.gradle');
  assert.match(gradle,/org\.godotengine:godot:4\.7\.2\.stable/);
  const manifest=read('modules/buklod-genesis-godot/android/src/main/AndroidManifest.xml');
  assert.match(manifest,/android:exported="false"/);
  assert.match(manifest,/android:process=":genesis_godot"/);
  assert.match(manifest,/android:screenOrientation="landscape"/);
  const java=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
  assert.match(java,/extends GodotActivity/);
  assert.match(java,/file\.getParentFile\(\)\.equals\(root\)/);
  assert.match(java,/--main-pack/);
});
test('native Godot launch requires app-private file, exact SHA256 and bounded memory without placeholder graphics',()=>{
  const kotlin=read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/BuklodGenesisGodotModule.kt');
  assert.match(kotlin,/128L \* 1024 \* 1024/);
  assert.match(kotlin,/input\.path\.startsWith\(it\.path \+ File\.separator\)/);
  assert.match(kotlin,/expectedSha256/);
  assert.match(kotlin,/MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(kotlin,/actual != digest/);
  assert.match(kotlin,/activity\.packageName != "org\.mzbministry\.buklod\.staging"/);
  assert.doesNotMatch(kotlin,/http:\/\/|https:\/\/|startService\(|MediaStore/);
  const js=read('modules/buklod-genesis-godot/index.ts');
  assert.match(js,/requireOptionalNativeModule/);
  assert.match(js,/EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true'/);
  const inventory=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
  assert.equal(inventory.nativeFeatures.find(x=>x.id==='godot-android-3d').status,'native-source-uncompiled');
  assert.equal(inventory.signedApk.exists,false);
});
