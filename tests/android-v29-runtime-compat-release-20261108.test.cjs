'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolveExpoConfigFromSource, assertNativeRuntimeCompatible } =
  require('../scripts/native-expo-config-compat.cjs');

const projectId = '23dad7d0-389a-406e-8dec-08965dab85d8';
const pinnedV28 = '2f26645e50e8e079ebf09f3999aacfc506ae7651';

function configFor(target, variant) {
  const previous = {
    BUKLOD_APP_TARGET: process.env.BUKLOD_APP_TARGET,
    APP_VARIANT: process.env.APP_VARIANT,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  };
  try {
    process.env.BUKLOD_APP_TARGET = target;
    process.env.APP_VARIANT = variant;
    process.env.EXPO_PUBLIC_APP_ENV = variant;
    return require('../app.config.js')({ config: {} });
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('Current Main V30 supersedes historical V29 AAB while retaining V28 runtime 1.3.2', () => {
  const cfg = configFor('main', 'production');
  assert.equal(cfg.name, 'BUKLOD');
  assert.equal(cfg.android.package, 'org.mzbministry.buklod');
  assert.equal(cfg.version, '1.3.6');
  assert.equal(cfg.android.versionCode, 30);
  assert.equal(cfg.runtimeVersion, '1.3.2');
  assert.equal(cfg.extra.eas.projectId, projectId);
  assert.equal(cfg.updates.url, 'https://u.expo.dev/' + projectId);
});

test('Main V30 native contract remains identical to installed V28 except app version and versionCode', () => {
  const src = execFileSync('git', ['show', pinnedV28 + ':app.config.js'], { encoding: 'utf8' });
  const pinned = resolveExpoConfigFromSource(src, {
    ...process.env,
    BUKLOD_APP_TARGET: 'main',
    APP_VARIANT: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
  });
  const actual = configFor('main', 'production');
  assertNativeRuntimeCompatible(actual, pinned);
  const changed = execFileSync('git', [
    'diff', '--name-only', pinnedV28, 'HEAD', '--',
    'android', 'plugins', 'package-lock.json', 'package.json',
  ], { encoding: 'utf8' });
  assert.equal(changed.trim(), '', 'Main V30 must not silently change native dependencies or plugins');
});

test('Classroom and staging native identities stay unchanged by Main V29', () => {
  const classroom = configFor('classroom', 'production');
  assert.equal(classroom.version, '1.3.4');
  assert.equal(classroom.android.versionCode, 28);
  assert.equal(classroom.runtimeVersion, '1.3.0');
  assert.equal(classroom.android.package, 'org.mzbministry.buklod.classroom');
  const staging = configFor('main', 'staging');
  assert.equal(staging.version, '1.3.4');
  assert.equal(staging.android.versionCode, undefined);
  assert.equal(staging.android.package, 'org.mzbministry.buklod.staging');
});

test('Production EAS build makes an AAB, uses local versionCode and production OTA channel', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(eas.cli.appVersionSource, 'local');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.environment, 'production');
  assert.notEqual(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.env.BUKLOD_APP_TARGET, undefined);
});

test('Historical V29 AAB builder was isolated from OTA, Play and APK deployment', () => {
  const workflow = fs.readFileSync('.github/workflows/buklod-v29-aab-production-20261108.yml', 'utf8');
  assert.match(workflow, /BUKLOD_V29_AAB_BUILD_20261108/);
  assert.match(workflow, /--profile production --non-interactive --wait --json/);
  assert.match(workflow, /tests\/native-expo-config-compat\.test\.cjs/);
  assert.match(workflow, /runtimeVersion,\s*'1\.3\.2'/);
  assert.doesNotMatch(workflow, /eas-cli@latest\s+(?:submit|update)\b/);
  assert.doesNotMatch(workflow, /--profile production-apk/);
  const ota = fs.readFileSync('scripts/android-ota-rc.cjs', 'utf8');
  assert.match(ota, /assertNativeRuntimeCompatible\(currentConfig,/);
  assert.match(ota, /runtime = '1\.3\.2'/);
});