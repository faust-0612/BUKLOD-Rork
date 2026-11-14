import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const app = requireFromText(read('app.config.js'));
const eas = JSON.parse(read('eas.json'));
function requireFromText(source) {
  const module = { exports: {} };
  const processRef = process;
  new Function('module','process',source)(module,processRef);
  return module.exports;
}
function getConfig(target, env = 'staging') {
  const prev = {
    BUKLOD_APP_TARGET: process.env.BUKLOD_APP_TARGET,
    APP_VARIANT: process.env.APP_VARIANT,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    KINGDOM_LAB_EAS_PROJECT_ID: process.env.KINGDOM_LAB_EAS_PROJECT_ID,
  };
  try {
    process.env.BUKLOD_APP_TARGET = target;
    process.env.APP_VARIANT = env;
    process.env.EXPO_PUBLIC_APP_ENV = env;
    delete process.env.KINGDOM_LAB_EAS_PROJECT_ID;
    return app({ config: { extra: {} } });
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
test('Third APK identity and native runtime cannot overwrite main or staging-user', () => {
  const main = getConfig('main','production');
  const staging = getConfig('main','staging');
  const lab = getConfig('kingdom-native-lab','staging');
  assert.equal(main.android.package, 'org.mzbministry.buklod');
  assert.equal(staging.android.package, 'org.mzbministry.buklod.staging');
  assert.equal(lab.android.package, 'org.mzbministry.buklod.kingdomlab');
  assert.equal(main.runtimeVersion, '1.3.2');
  assert.equal(staging.runtimeVersion, '1.3.2');
  assert.equal(lab.runtimeVersion, '1.4.0-kingdom-native-lab.1');
  assert.equal(lab.updates.enabled, false);
  assert.notEqual(lab.scheme, staging.scheme);
  assert.notEqual(lab.scheme, main.scheme);
  // CI deliberately supplies the offline-only, package-scoped Firebase
  // Gradle placeholder; it must never be a staging or production credential.
  assert.ok(!lab.android.googleServicesFile ||
    lab.android.googleServicesFile === './google-services.kingdomlab.offline.json');
  assert.notEqual(lab.android.googleServicesFile, staging.android.googleServicesFile);
  assert.notEqual(lab.android.googleServicesFile, main.android.googleServicesFile);
  assert.equal(lab.extra.eas?.projectId, undefined);
  assert.ok(!main.plugins.includes('./plugins/withBuklodKingdomNativeLab'));
  assert.ok(!staging.plugins.includes('./plugins/withBuklodKingdomNativeLab'));
  assert.ok(lab.plugins.includes('./plugins/withBuklodKingdomNativeLab'));
});
test('Separate EAS profile is internal-only and cannot publish an OTA or Play build', () => {
  const profile = eas.build['kingdom-native-lab'];
  assert.equal(profile.channel, 'kingdom-native-lab');
  assert.equal(profile.distribution, 'internal');
  assert.equal(profile.android.buildType, 'apk');
  assert.equal(profile.autoIncrement, false);
  assert.equal(profile.env.BUKLOD_APP_TARGET, 'kingdom-native-lab');
  assert.equal(profile.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB,'1');
  assert.equal(profile.env.APP_VARIANT,'staging');
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build.production.channel, 'production');
});
test('Local-only lab tree bypasses all live BUKLOD network providers and sign-in', () => {
  const layout = read('src/app/_layout.tsx');
  const index = read('src/app/index.tsx');
  const lab = read('src/app/kingdom-native-lab.tsx');
  const api = read('src/lib/supabase.ts');
  const branchStart = layout.indexOf('function RootLayout()');
  const labBranch = layout.indexOf("process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1'",branchStart);
  const prodProviders = layout.indexOf('<AuthProvider>',branchStart);
  assert.ok(branchStart >= 0 && labBranch > branchStart && prodProviders > labBranch);
  assert.match(index,/return <Redirect href="\/kingdom-native-lab" \/>/);
  assert.match(index,/return <MainIndex \/>/);
  assert.match(api,/buklod-kingdom-native-lab\.invalid/);
  assert.match(api,/isolated-lab-no-real-supabase-key/);
  assert.match(lab,/REVIEW COMMENT \(NO SEND\)/);
  assert.doesNotMatch(lab,/supabase\.rpc|fetch\(|uploadCommunity|grantShards|awardPoints/);
});
test('Native keyboard GIF accepts one validated item, shows preview and keeps Send manual', () => {
  const native = read('modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/BuklodLabNativeModule.kt');
  const input = read('modules/buklod-kingdom-lab/KeyboardGifInput.tsx');
  const mention = read('src/components/BuklodMentionField.tsx');
  const comments = read('src/components/BuklodCommunityCommentComposer.tsx');
  assert.match(native,/InputConnectionCompat\.createWrapper/);
  assert.match(native,/ViewCompat\.setOnReceiveContentListener/);
  assert.match(native,/25L \* 1024 \* 1024/);
  assert.match(native,/GIF87a/);
  assert.match(native,/GIF89a/);
  assert.match(native,/UUID\.randomUUID\(\)/);
  assert.match(input,/onGif/);
  assert.match(mention,/EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1'/);
  assert.match(comments,/onNativeGif=/);
  assert.match(comments,/onMediaChange\(\{ kind: 'gif', ref: uri \}, uri\)/);
});
test('Native Drive provider works without Google Drive app OAuth/backend and only shows previews', () => {
  const picker = read('src/lib/buklodLabDrivePicker.ts');
  const comments = read('src/components/BuklodCommunityCommentComposer.tsx');
  const connect = read('src/components/connect/ConnectComposer.tsx');
  assert.match(picker,/DocumentPicker\.getDocumentAsync/);
  assert.match(picker,/copyToCacheDirectory: true/);
  assert.match(picker,/new File\(asset\.uri\)\.size/);
  assert.match(picker,/25 \* 1024 \* 1024/);
  assert.doesNotMatch(picker,/drive\.google\.com|googleapis\.com|supabase|fetch\(/);
  assert.match(comments,/pickKingdomLabDriveImage/);
  assert.match(connect,/Choose a Google Drive or Android Files attachment/);
});
test('Godot main pack is bundled only in separate Android lab package', () => {
  const moduleGradle = read('modules/buklod-kingdom-lab/android/build.gradle');
  const gradlePlugin = read('plugins/withBuklodKingdomNativeLab.js');
  const java = read('modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/GodotLabActivity.java');
  const manifest = read('modules/buklod-kingdom-lab/android/src/main/AndroidManifest.xml');
  assert.match(moduleGradle,/org\.godotengine:godot:4\.7\.2\.stable/);
  assert.match(moduleGradle,/System.getenv\('BUKLOD_APP_TARGET'\) != 'kingdom-native-lab'/);
  assert.match(java,/--main-pack/);
  assert.match(java,/buklod_kingdom\.zip/);
  assert.match(manifest,/android:exported="false"/);
  assert.match(manifest,/android:process=":kingdom3d"/);
  assert.match(gradlePlugin,/process\.env\.BUKLOD_APP_TARGET !== 'kingdom-native-lab'/);
});
test('Offline source preflight passes but unsafe build without lab creds is blocked', () => {
  const result = execFileSync(process.execPath, ['scripts/kingdom-lab/preflight.cjs'],
    {cwd: new URL('..', import.meta.url), encoding:'utf8'});
  assert.match(result, /NATIVE_LAB_SOURCE_GATES_PASSED/);
  const blocked = spawnSync(process.execPath,
    ['scripts/kingdom-lab/preflight.cjs','--build'],
    {cwd: new URL('..', import.meta.url), encoding:'utf8',
     env:{...process.env,BUKLOD_APP_TARGET:'kingdom-native-lab',
        EXPO_PUBLIC_KINGDOM_NATIVE_LAB:'1',KINGDOM_LAB_EAS_PROJECT_ID:'',
        KINGDOM_LAB_GOOGLE_SERVICES_FILE:''}});
  assert.notEqual(blocked.status,0);
  assert.match(blocked.stderr, /KINGDOM NATIVE LAB RELEASE BLOCKED/);
});
