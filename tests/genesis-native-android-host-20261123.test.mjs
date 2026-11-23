import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditLocalNative} from '../scripts/genesis-native-local-only-gate.mjs';
const read=p=>readFileSync(new URL('../native-genesis/'+p,import.meta.url),'utf8');

test('isolated Android Gradle host is neither MAIN nor staging and never bundles a cloud build chain',()=>{
  const gradle=read('android/app/build.gradle.kts');
  const build=read('build-local.sh');
  const manifest=read('android/app/src/main/AndroidManifest.xml');
  assert.match(gradle,/applicationId\s*=\s*"org\.mzbministry\.buklod\.genesis\.nativeapp"/);
  assert.match(gradle,/org\.godotengine:godot:4\.7\.2\.stable/);
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(manifest,/<uses-permission\s+android:name="android\.permission\.INTERNET"/);
  assert.match(manifest,/\.GenesisGameActivity"[\s\S]*android:exported="false"/);
  for(const source of [gradle,build,manifest])assert.doesNotMatch(source,/\b(?:eas\s+build|expo\s+prebuild|expo\s+run|vercel\s+deploy)\b/i);
  assert.match(build,/GENESIS_NATIVE_SIGNING_CERT_SHA256/);
  assert.match(build,/genesis-native-local-only-gate/);
});

test('Godot is embedded as app-private main-pack and not remotely downloaded or controlled by intents',()=>{
  const game=read('android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GenesisGameActivity.kt');
  const host=read('android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/NativeHomeActivity.kt');
  assert.match(game,/class GenesisGameActivity\s*:\s*GodotActivity/);
  assert.match(game,/--main-pack/);
  assert.match(game,/res:\/\/godot\/empire-arena\.pck/);
  assert.doesNotMatch(game,/https?:\/\/|getStringExtra|getExternalFilesDir/);
  assert.match(host,/SHA-256/);
  assert.match(host,/MessageDigest/);
  assert.match(host,/launch\.isEnabled = hasValidPack/);
});

test('keyboard GIF content is copied locally with MIME, magic header, size and permission lifecycle checks',()=>{
  const source=read('android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GifInputHandler.kt');
  for(const p of [/OnCommitContentListener/,/image\/gif/,/maxGifBytes/,/GIF87a/,/GIF89a/,/requestPermission\(\)/,/releasePermission\(\)/,/context\.applicationContext/,/File\.createTempFile/,/temp\.delete\(\)/])
    assert.match(source,p);
  assert.doesNotMatch(source,/\b(?:upload\(|fetch\(|httpClient|https?:\/\/)/i);
});

test('Android 12 native splash has green mark; release still requires approved original art',()=>{
  const theme=read('android/app/src/main/res/values-v31/themes.xml');
  const mark=read('android/app/src/main/res/drawable/brand_mark.xml');
  assert.match(theme,/windowSplashScreenAnimatedIcon/);
  assert.match(mark,/#71DD8A/);
  assert.match(mark,/Temporary DEV vector/);
});

test('source gate detects remaining full-app parity, backend and asset blockers after native host is added',async()=>{
  const r=await auditLocalNative(new URL('..',import.meta.url).pathname, {env:{},checkTools:false});
  assert.ok(r.errors.some(s=>s.startsWith('BACKEND_NOT_ISOLATED')));
  assert.ok(r.errors.some(s=>s.startsWith('UNVERIFIED_APP_FEATURE')));
  assert.ok(r.errors.some(s=>s.startsWith('INSUFFICIENT_NATIVE_GAME_ASSETS')));
  assert.ok(!r.errors.some(s=>s.startsWith('MISSING_NATIVE_ANDROID_APP')));
  assert.ok(!r.errors.some(s=>s.startsWith('MISSING_GODOT_ANDROID_ENGINE')));
  assert.ok(!r.errors.some(s=>s.startsWith('GIF_IME_CONTENT_RECEIPT_NOT_IMPLEMENTED')));
  assert.ok(!r.errors.some(s=>s.startsWith('MISSING_ANDROID_12_NATIVE_SPLASH')));
  assert.equal(r.ok,false);
});
