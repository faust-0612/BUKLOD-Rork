import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../.github/workflows/genesis-native-godot-arena-house-build-20261123.yml',import.meta.url),'utf8');
test('isolated push trigger; no default branch, production, Expo or EAS build',()=>{
  assert.match(w,/dev\/genesis-arena-kingdom-house-native-apk-20261123/);
  assert.match(w,/GENESIS_NATIVE_DEV_APK:/);
  assert.doesNotMatch(w,/expo prebuild|eas build|expo run|vercel deploy|npm publish|gh release create/i);
  assert.match(w,/permissions:\n  contents: read/);
  assert.match(w,/persist-credentials: false/);
});
test('Godot scene, ZIP art, content hash and smoke tests precede expensive Android install',()=>{
  const godot=w.indexOf("GENESIS_GODOT_ANDROID_GAME_SOURCE_QA_PASS");
  const sdk=w.indexOf("Android SDK");
  assert.ok(godot>0&&sdk>godot);
  assert.match(w,/world_smoke\.gd/);
  assert.match(w,/interactive-world\.log/);
  assert.match(w,/sha256sum -c -/);
  assert.match(w,/art\/\(fullbody\|sprite\|scene\)/);
  assert.match(w,/gradle :app:assembleDebug/);
  assert.match(w,/retention-days: 2/);
});
test('candidate binary is a separate native debug game and never claims full main app parity',()=>{
  assert.match(w,/app-debug\.apk/);
  assert.match(w,/org\.mzbministry\.buklod\.genesis\.nativeapp/);
  assert.match(w,/No BUKLOD MAIN app parity/);
  assert.doesNotMatch(w,/app-release\.apk/);
});
