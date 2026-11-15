import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url),'utf8');

test('Google Drive native authorization is separate from BUKLOD login and scoped to selected Drive files', () => {
  const code=read('modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/BuklodNativeDriveModule.kt');
  assert.match(code, /Name\("BuklodNativeDrive"\)/);
  assert.match(code, /AuthorizationRequest\.builder\(\)/);
  assert.match(code, /com\.google\.android\.gms\.auth\.api\.identity\.Identity/);
  assert.match(code, /https:\/\/www\.googleapis\.com\/auth\/drive\.file/);
  assert.match(code, /https:\/\/www\.googleapis\.com\/auth\/userinfo\.email/);
  assert.match(code, /OnActivityResult/);
  assert.match(code, /identityScope = "openid"/);
  assert.match(code, /getAuthorizationResultFromIntent/);
  assert.match(code, /mainHandler\.postDelayed\(timeout, 90000\)/);
  assert.match(code, /clearToken/);
  assert.doesNotMatch(code, /requestOfflineAccess|serverAuthCode|refreshToken/);
  const gradle=read('modules/buklod-kingdom-lab/android/build.gradle');
  assert.match(gradle, /com\.google\.android\.gms:play-services-auth:/);
  const registry=JSON.parse(read('modules/buklod-kingdom-lab/expo-module.config.json'));
  assert.ok(registry.android.modules.includes('expo.modules.buklodlab.BuklodNativeDriveModule'));
});

test('native Drive auth is confined to new APK source branch, no production Firebase credential edits', () => {
  const cfg=read('app.config.js'),eas=JSON.parse(read('eas.json'));
  assert.match(cfg, /google-services\.native-lab\.json/);
  assert.equal(eas.build['native-lab'].env.APP_VARIANT,'native-lab');
  assert.equal(eas.build.production.channel,'production');
  assert.equal(eas.build['staging-user'].channel,'staging-user');
});
