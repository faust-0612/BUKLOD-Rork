'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MAIN_SHA = '8e1956e617a65b3350b3fba81597fc86604da4a1';
const WALL_RC_SHA = '804cb557177621593d0526f7484ae57013e021eb';
const PROJECT_ID = '23dad7d0-389a-406e-8dec-08965dab85d8';
const LIVE_DB_URL = 'https://yhanxndaqbmuzbdqlblu.supabase.co';
const CHANNEL = 'staging-user';
const RUNTIME = '1.3.2';

function replaceOnce(input, before, after, label) {
  if (input.includes(after) && !input.includes(before)) return input;
  assert.equal(input.split(before).length - 1, 1, 'Unexpected ' + label + ' definition in canonical source');
  return input.replace(before, after);
}

function mirrorConfiguration(configSource, easSource) {
  const nextApp = replaceOnce(configSource,
    ": (isStaging ? './google-services.staging.json' : './google-services.production.json'),",
    ": (isStaging && process.env.BUKLOD_STAGING_LIVE_MIRROR !== '1' ? './google-services.staging.json' : './google-services.production.json'),",
    'staging Firebase selector');
  const finalApp = replaceOnce(nextApp,
    'versionCode: isStaging ? undefined : 28,',
    "versionCode: isStaging ? (process.env.BUKLOD_STAGING_LIVE_MIRROR === '1' ? 2 : undefined) : 28,",
    'staging Android versionCode');

  const before = JSON.parse(easSource);
  const after = JSON.parse(easSource);
  const profile = after.build?.['staging-user'];
  assert.ok(profile, 'Missing staging-user build profile');
  assert.equal(profile.channel, CHANNEL);
  assert.equal(profile.android?.buildType, 'apk');
  profile.environment = 'production';
  profile.env = {
    ...profile.env,
    APP_VARIANT: 'staging',
    EXPO_PUBLIC_APP_ENV: 'production',
    BUKLOD_STAGING_LIVE_MIRROR: '1',
    EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS: 'false',
    EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME: 'firebase-video-staging',
  };
  delete profile.autoIncrement;
  for (const key of Object.keys(before.build)) {
    if (key !== 'staging-user') {
      assert.deepEqual(after.build[key], before.build[key], 'Unrelated EAS build profile changed: ' + key);
    }
  }
  assert.deepEqual(after.submit, before.submit);
  return { appConfig: finalApp, easJson: JSON.stringify(after, null, 2) + '\n' };
}

function withEnv(variables, task) {
  const old = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(variables)) process.env[key] = value;
    return task();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function verify(dir) {
  const root = path.resolve(dir);
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const p = eas.build?.['staging-user'];
  assert.equal(p?.channel, CHANNEL);
  assert.equal(p?.environment, 'production');
  assert.equal(p?.distribution, 'internal');
  assert.equal(p?.android?.buildType, 'apk');
  assert.equal(p?.env?.APP_VARIANT, 'staging');
  assert.equal(p?.env?.EXPO_PUBLIC_APP_ENV, 'production');
  assert.equal(p?.env?.BUKLOD_STAGING_LIVE_MIRROR, '1');
  assert.equal(p?.env?.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS, 'false');
  assert.equal(p?.autoIncrement, undefined);
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.environment, 'production');
  const factory = require(path.join(root, 'app.config.js'));
  const staged = withEnv({
    APP_VARIANT: 'staging',
    EXPO_PUBLIC_APP_ENV: 'production',
    BUKLOD_STAGING_LIVE_MIRROR: '1',
    BUKLOD_APP_TARGET: 'main',
    EAS_PROJECT_ID: PROJECT_ID,
  }, () => factory({ config: { extra: {} } }));
  const production = withEnv({
    APP_VARIANT: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
    BUKLOD_STAGING_LIVE_MIRROR: '1',
    BUKLOD_APP_TARGET: 'main',
    EAS_PROJECT_ID: PROJECT_ID,
  }, () => factory({ config: { extra: {} } }));
  assert.equal(staged.name, 'BUKLOD Staging');
  assert.equal(production.name, 'BUKLOD');
  assert.equal(staged.android.package, 'org.mzbministry.buklod.staging');
  assert.equal(production.android.package, 'org.mzbministry.buklod');
  assert.equal(staged.android.versionCode, 2);
  assert.equal(production.android.versionCode, 28);
  assert.equal(staged.runtimeVersion, RUNTIME);
  assert.equal(staged.runtimeVersion, production.runtimeVersion);
  assert.equal(staged.icon, production.icon);
  assert.equal(staged.android.adaptiveIcon.foregroundImage, production.android.adaptiveIcon.foregroundImage);
  assert.equal(staged.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].image,
    production.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].image);
  assert.equal(staged.android.googleServicesFile, './google-services.production.json');
  assert.equal(staged.extra.appEnvironment, 'production');
  assert.equal(staged.extra.eas.projectId, PROJECT_ID);
  assert.equal(staged.updates.url, 'https://u.expo.dev/' + PROJECT_ID);
  const google = JSON.parse(fs.readFileSync(path.join(root, 'google-services.production.json'), 'utf8'));
  const androidPackages = (google.client || []).map(c => c.client_info?.android_client_info?.package_name);
  assert.ok(androidPackages.includes('org.mzbministry.buklod.staging'), 'Firebase must contain staging package');
  assert.ok(androidPackages.includes('org.mzbministry.buklod'), 'Firebase must retain production package');
  return { package: staged.android.package, runtime: staged.runtimeVersion, channel: p.channel };
}

function prepare(dir) {
  const root = path.resolve(dir);
  const configFile = path.join(root, 'app.config.js');
  const easFile = path.join(root, 'eas.json');
  const changed = mirrorConfiguration(fs.readFileSync(configFile, 'utf8'), fs.readFileSync(easFile, 'utf8'));
  fs.writeFileSync(configFile, changed.appConfig);
  fs.writeFileSync(easFile, changed.easJson);
  verify(root);
  console.log('STAGING_MIRROR_PREPARED: native staging identity, production UI environment, production-connected backend; other profiles retained');
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}
// Fail closed: SOURCE parity is not proof of the actual owner-approved V28 AAB.
// A verified AAB receipt and its exact native source must be explicitly registered
// before a production-mirror APK or staging OTA can be released again.
const LOCAL_V28_AAB_SHA256 = 'e735885e20f222b03cd91184f7d0fb5281523ec846667b9fb935d50e9ff7c5c2';
function assertApprovedV28Record(record) {
  assert.equal(record?.buildSystem, 'local-gradle', 'Approved V28 must be traced to the local Gradle AAB, not an EAS AAB');
  assert.equal(record?.packageName, 'org.mzbministry.buklod', 'Approved artifact must be the production application');
  assert.equal(record?.runtimeVersion, RUNTIME, 'Actual V28 AAB runtime must match the staging OTA runtime (never infer from versionName)');
  assert.equal(record?.versionName, '1.3.4', 'Approved AAB versionName not verified');
  assert.equal(record?.versionCode, 28, 'Approved AAB versionCode not verified');
  assert.equal(String(record?.approvedAabSha256 || '').toLowerCase(), LOCAL_V28_AAB_SHA256,
    'Approved local V28 AAB SHA-256 missing or does not match the recorded production binary');
  assert.match(String(record?.approvedAabSourceSha || ''), /^[0-9a-f]{40}$/i,
    'Missing exact source SHA from the local V28 Gradle build');
  assert.ok(typeof record?.binaryInspectionEvidence === 'string' &&
    record.binaryInspectionEvidence.trim().length >= 20,
    'Missing actual AAB manifest/runtime inspection evidence');
  assert.ok(typeof record?.reconciliationEvidence === 'string' &&
    record.reconciliationEvidence.trim().length >= 20,
    'Missing documented AAB-to-staging native parity evidence');
  return record;
}
function assertOriginalV28AabFile() {
  const file = process.env.BUKLOD_APPROVED_V28_AAB_PATH || '';
  assert.ok(file && fs.existsSync(file),
    'Original V28 locally built AAB bytes are unavailable to CI; no binary parity or staging release');
  const digest = execFileSync('sha256sum', [file], { encoding: 'utf8' }).trim().split(/\s+/)[0];
  assert.equal(digest.toLowerCase(), LOCAL_V28_AAB_SHA256,
    'Original V28 AAB artifact bytes disagree with the recorded SHA-256');
}
function assertApprovedV28BinaryBaseline(prod) {
  const file = path.join(prod, 'release/approved-android-baseline.json');
  const record = assertApprovedV28Record(JSON.parse(fs.readFileSync(file, 'utf8')));
  assertOriginalV28AabFile();
  // Any native/source change after the actual V28 AAB requires a new explicit
  // compatibility assessment, even if main has passed ordinary unit tests.
  const nativePaths = [
    'package.json', 'package-lock.json', 'app.config.js', 'eas.json',
    'android', 'ios', 'plugins', 'assets/release', 'google-services.production.json',
  ];
  const changed = git(prod, 'diff', '--name-only',
    record.approvedAabSourceSha, MAIN_SHA, '--', ...nativePaths);
  assert.equal(changed, '',
    'Canonical main changed native inputs since approved V28 AAB; binary parity NOT established: ' + changed);
  console.log('STAGING_V28_BINARY_PROVENANCE_PASS: approved AAB identity, source ancestry and native input diff');
}
function parity(prodDir, rcDir) {
  const prod = path.resolve(prodDir);
  assertApprovedV28BinaryBaseline(prod);
  const rc = path.resolve(rcDir);
  assert.equal(git(prod, 'rev-parse', 'HEAD'), MAIN_SHA, 'APK baseline must be exact production source');
  assert.equal(git(rc, 'rev-parse', 'HEAD'), WALL_RC_SHA, 'OTA must use exact tested Wall RC');
  git(rc, 'merge-base', '--is-ancestor', MAIN_SHA, WALL_RC_SHA);
  const allowed = new Set([
    'assets/release/app-icon.png', 'assets/release/splash-icon.png',
    'assets/release/buklod-main-canonical.png', 'package.json', 'package-lock.json',
    'app.config.js', 'eas.json', 'google-services.production.json',
  ]);
  for (const file of allowed) {
    assert.deepEqual(fs.readFileSync(path.join(prod, file)), fs.readFileSync(path.join(rc, file)),
      'APK baseline and OTA have different native/brand/dependency input: ' + file);
  }
  const changed = git(rc, 'diff', '--name-only', MAIN_SHA, WALL_RC_SHA).split('\n').filter(Boolean);
  const prohibited = changed.filter(p => /^(?:assets\/|plugins\/|supabase\/|android\/|ios\/|app\.config\.js|eas\.json|package(?:-lock)?\.json|google-services)/.test(p));
  assert.deepEqual(prohibited, [], 'Frozen Wall RC changed non-OTA-native/dependency source');
  for (const dir of [prod, rc]) {
    const dirty = git(dir, 'diff', '--name-only');
    assert.deepEqual(dirty.split('\n').filter(Boolean).sort(), ['app.config.js', 'eas.json'],
      'Staging workspace may alter only temporary app and EAS configuration');
    verify(dir);
  }
  console.log('STAGING_MIRROR_PARITY_PASS: same production source/assets/native libs; frozen Wall patch is the only JS delta');
}

function checkBackend() {
  assert.equal(process.env.APP_VARIANT, 'staging');
  assert.equal(process.env.EXPO_PUBLIC_APP_ENV, 'production');
  assert.equal(process.env.BUKLOD_STAGING_LIVE_MIRROR, '1');
  assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL, LIVE_DB_URL, 'Backend switch would invalidate mirror comparison');
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '');
  assert.ok(key.startsWith('sb_publishable_') && !/sb_secret_|service_role/i.test(key),
    'Expected nonprivileged production publishable key');
  const project = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || PROJECT_ID;
  assert.equal(project, PROJECT_ID);
  console.log('STAGING_MIRROR_BACKEND_PASS: protected existing main backend, public-only key, staging package');
}

function verifyChannel(file) {
  const data = fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
  assert.match(data, /Name\s+staging-user\b/);
  assert.match(data, /Branch\s+staging-user\b/);
  if (/Runtime Version\s+\S+/.test(data)) assert.match(data, /Runtime Version\s+1\.3\.2\b/);
  console.log('STAGING_MIRROR_CHANNEL_PASS: staging-user maps to staging-user; runtime 1.3.2');
}

function verifyBuild(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const build = Array.isArray(json) ? json[0] : json;
  assert.equal(build.status, 'FINISHED', 'EAS build not completed successfully');
  assert.ok(build.id && /^[a-z0-9-]+$/i.test(build.id));
  const url = build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl;
  assert.ok(/^https:\/\/(expo\.dev|.*\.expo\.dev)\//.test(String(url || '')) && /\.apk(?:\?|$)/.test(url),
    'Build has no verified installable Android APK');
  console.log('STAGING_MIRROR_APK_PASS: build=' + build.id + ' artifact=' + url);
  return { id: build.id, url };
}

function verifyUpdate(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const text = JSON.stringify(json);
  assert.ok(text.includes('1.3.2'), 'Published OTA output lacks runtime 1.3.2 evidence');
  if (text.includes('"platform"')) assert.ok(/android/i.test(text), 'Published OTA does not identify Android');
  console.log('STAGING_MIRROR_OTA_CLI_RECEIPT: JSON publication receipt parsed; verify exact group in EAS update:list');
}

if (require.main === module) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === 'prepare') prepare(args[0]);
    else if (mode === 'verify') { verify(args[0]); console.log('STAGING_MIRROR_VERIFY_PASS'); }
    else if (mode === 'parity') parity(args[0], args[1]);
    else if (mode === 'live-backend') checkBackend();
    else if (mode === 'channel') verifyChannel(args[0]);
    else if (mode === 'build') verifyBuild(args[0]);
    else if (mode === 'ota') verifyUpdate(args[0]);
    else throw new Error('Usage: staging-production-mirror.cjs <prepare|verify|parity|live-backend|channel|build|ota> <args>');
  } catch (error) {
    console.error('STAGING_MIRROR_BLOCKED: ' + error.message);
    process.exitCode = 1;
  }
}
module.exports = { MAIN_SHA, WALL_RC_SHA, mirrorConfiguration, verify, prepare, checkBackend, verifyChannel, verifyBuild, assertApprovedV28Record, assertApprovedV28BinaryBaseline };
