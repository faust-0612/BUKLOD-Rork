#!/usr/bin/env node
/** Zero-install source and optional build gate, without touching EAS/OTA. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { godotPack } = require('./godotZip.cjs');

const root = path.resolve(__dirname, '../..');
const build = process.argv.includes('--build');
const STRICT_BRANCH = 'dev/kingdom-native-lab-isolated-20261114';
const MAIN_EAS = '23dad7d0-389a-406e-8dec-08965dab85d8';
const CLASSROOM_EAS = '14100ed1-7f25-4551-9627-09d280498241';
function requireCondition(condition, label) {
  if (!condition) throw new Error('KINGDOM NATIVE LAB RELEASE BLOCKED: ' + label);
}
const original = { ...process.env };
function configFor(target, variant) {
  process.env.BUKLOD_APP_TARGET = target;
  process.env.APP_VARIANT = variant;
  process.env.EXPO_PUBLIC_APP_ENV = variant;
  try {
    return require(path.join(root, 'app.config.js'))({ config: { extra: {} } });
  } finally {
    process.env = { ...original };
  }
}
function checkFirebaseFile(cfg) {
  const value = process.env.KINGDOM_LAB_GOOGLE_SERVICES_FILE;
  requireCondition(Boolean(value), 'separate lab Firebase client file is not configured');
  const file = path.resolve(root, value);
  requireCondition(fs.existsSync(file), 'lab Firebase client file does not exist');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  requireCondition(json.project_info?.project_id === 'buklod-kingdom-native-lab-offline',
    'must use a NONFUNCTIONAL offline Firebase placeholder, never a real BUKLOD Firebase project');
  requireCondition(json.client?.[0]?.api_key?.[0]?.current_key === 'OFFLINE-LAB-NO-REAL-KEY',
    'lab may not use real Firebase API credentials');
  const androidClients = (json.client ?? [])
    .map(row => row?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  requireCondition(
    androidClients.includes(cfg.android.package),
    'Firebase JSON must contain exact lab package, not staging/prod package',
  );
  requireCondition(file !== path.resolve(root, 'google-services.staging.json')
      && file !== path.resolve(root, 'google-services.production.json')
      && file !== path.resolve(root, 'google-services.classroom.json'),
    'lab may not reuse any canonical Firebase services file');
}
try {
  const production = configFor('main', 'production');
  const staging = configFor('main', 'staging');
  const lab = configFor('kingdom-native-lab', 'staging');
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const profile = eas.build['kingdom-native-lab'];
  requireCondition(production.android.package === 'org.mzbministry.buklod',
    'production package drift');
  requireCondition(staging.android.package === 'org.mzbministry.buklod.staging',
    'staging package drift');
  requireCondition(production.runtimeVersion === '1.3.2' &&
    staging.runtimeVersion === '1.3.2', 'legacy runtime drift');
  requireCondition(lab.android.package === 'org.mzbministry.buklod.kingdomlab',
    'lab package collision');
  requireCondition(lab.runtimeVersion === '1.4.0-kingdom-native-lab.1',
    'lab ABI/runtime mismatch');
  requireCondition(lab.updates?.enabled === false,
    'lab must have OTA disabled until a new signed RC and EAS project exist');
  requireCondition(lab.extra?.kingdomNativeLab === true,
    'lab marker missing');
  requireCondition(!lab.extra?.eas?.projectId || ![MAIN_EAS, CLASSROOM_EAS]
    .includes(lab.extra.eas.projectId), 'lab EAS project points at current BUKLOD');
  requireCondition(profile?.channel === 'kingdom-native-lab' &&
    profile?.distribution === 'internal' &&
    profile?.android?.buildType === 'apk' &&
    profile?.env?.BUKLOD_APP_TARGET === 'kingdom-native-lab' &&
    profile?.env?.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1',
    'lab EAS profile unsafe or missing');
  const { buffer, entries, sha256 } = godotPack(
    path.join(root, 'godot', 'kingdom-zero-assets'));
  requireCondition(entries.length === 4 && buffer.length > 500,
    'Godot source pack incomplete');
  const moduleDef = fs.readFileSync(path.join(root,
    'modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/BuklodLabNativeModule.kt'), 'utf8');
  requireCondition(moduleDef.includes('openGodotWorld') &&
    moduleDef.includes('InputConnectionCompat.createWrapper') &&
    moduleDef.includes('stageVerifiedGif'), 'missing native implementation');
  if (build) {
    const currentBranch = execFileSync('git', ['branch', '--show-current'],
      { cwd: root, encoding: 'utf8' }).trim();
    const hostedBranch = (process.env.GITHUB_REF_NAME || '').trim();
    const hostedRef = (process.env.GITHUB_REF || '').trim();
    const verifiedCommit = execFileSync('git', ['rev-parse', 'HEAD'],
      { cwd: root, encoding: 'utf8' }).trim();
    // GitHub Actions checks out a detached SHA. Require both official ref
    // and immutable checkout identity; local builds require exact branch.
    const authenticCI = process.env.GITHUB_ACTIONS === 'true' &&
      process.env.CI === '1' &&
      hostedBranch === STRICT_BRANCH &&
      hostedRef === 'refs/heads/' + STRICT_BRANCH &&
      process.env.GITHUB_SHA === verifiedCommit;
    requireCondition(currentBranch === STRICT_BRANCH || authenticCI,
      'build must run on exact isolated DEV branch or its GitHub Actions SHA');
    requireCondition(!(process.env.GITHUB_ACTIONS === 'true') || authenticCI,
      'CI branch/SHA identity mismatch');
    checkFirebaseFile(lab);
    requireCondition(process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1',
      'native-lab environment flag missing');
    requireCondition(process.env.BUKLOD_APP_TARGET === 'kingdom-native-lab',
      'wrong target in native build');
    const easProject = process.env.KINGDOM_LAB_EAS_PROJECT_ID ?? '';
    requireCondition(![MAIN_EAS, CLASSROOM_EAS].includes(easProject),
      'lab must not use any existing BUKLOD EAS project ID');
  }
  console.info(JSON.stringify({
    status: build ? 'NATIVE_LAB_BUILD_GATES_PASSED' : 'NATIVE_LAB_SOURCE_GATES_PASSED',
    package: lab.android.package,
    runtime: lab.runtimeVersion, channel: profile.channel,
    otaEnabled: lab.updates.enabled, offlineBackend: true,
    godotEntries: entries.length, godotBytes: buffer.length, godotSha256: sha256,
    buildAttempted: false, stagingOrProductionChanged: false,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
