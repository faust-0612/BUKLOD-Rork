'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const {
  resolveExpoConfigFromSource,
  assertNativeExpoConfigCompatible,
  assertNativeRuntimeCompatible,
} = require('../scripts/native-expo-config-compat.cjs');

const pinnedV28 = '2f26645e50e8e079ebf09f3999aacfc506ae7651';
const fixture = {
  name: 'BUKLOD',
  version: '1.3.4',
  runtimeVersion: '1.3.2',
  scheme: 'buklod',
  android: { package: 'org.mzbministry.buklod', versionCode: 28, permissions: ['CAMERA'] },
  plugins: ['expo-router', ['native-plugin', { enabled: true }]],
  updates: { url: 'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8' },
  extra: { eas: { projectId: '23dad7d0-389a-406e-8dec-08965dab85d8' } },
  web: { bundler: 'metro', favicon: './assets/release/app-icon.png' },
};
const copy = value => JSON.parse(JSON.stringify(value));

test('web-only favicon changes never invalidate Android V28 native compatibility', () => {
  const updated = copy(fixture);
  updated.web.favicon = './assets/release/buklod-main-canonical.png';
  updated.web.output = 'single';
  assert.doesNotThrow(() => assertNativeExpoConfigCompatible(updated, fixture));
});

test('real native identity, permissions, plugins, runtime and update-URL changes remain blocked', () => {
  const mutations = [
    item => { item.runtimeVersion = '1.3.4'; },
    item => { item.android.package = 'org.mzbministry.buklod.staging'; },
    item => { item.android.permissions.push('android.permission.ACCESS_FINE_LOCATION'); },
    item => { item.plugins[1][1].enabled = false; },
    item => { item.updates.url = 'https://u.expo.dev/wrong-project'; },
    item => { item.scheme = 'buklod-other'; },
    item => { item.extra.eas.projectId = 'wrong-project'; },
    item => { item.version = '1.3.5'; },
  ];
  for (const mutate of mutations) {
    const modified = copy(fixture);
    mutate(modified);
    assert.throws(() => assertNativeExpoConfigCompatible(modified, fixture), /Native Expo configuration changed/);
  }
});

test('pinned-source evaluator uses the same controlled Expo environment', () => {
  const source = 'module.exports = ({config}) => ({...config, runtimeVersion: process.env.RUNTIME || "1.3.2", android: {package: "org.mzbministry.buklod"}, web: {favicon: "old.png"}})';
  const pinned = resolveExpoConfigFromSource(source, { RUNTIME: '1.3.2' });
  const updated = copy(pinned);
  updated.web.favicon = 'new.png';
  assert.doesNotThrow(() => assertNativeExpoConfigCompatible(updated, pinned));
  updated.runtimeVersion = '1.3.3';
  assert.throws(() => assertNativeExpoConfigCompatible(updated, pinned), /Native Expo configuration changed/);
});

test('only app versionName and Android versionCode can differ without new runtime', () => {
  const v29 = copy(fixture);
  v29.version = '1.3.5';
  v29.android.versionCode = 29;
  assert.doesNotThrow(() => assertNativeRuntimeCompatible(v29, fixture));
  assert.throws(() => assertNativeExpoConfigCompatible(v29, fixture), /Native Expo configuration changed/);
  for (const mutate of [
    item => { item.runtimeVersion = '1.3.5'; },
    item => { item.android.permissions.push('android.permission.RECORD_AUDIO'); },
    item => { item.plugins.push('expo-native-special'); },
    item => { item.updates.url = 'https://u.expo.dev/changed'; },
    item => { item.android.package = 'org.mzbministry.buklod.other'; },
  ]) {
    const changed = copy(v29);
    mutate(changed);
    assert.throws(() => assertNativeRuntimeCompatible(changed, fixture),
      /Native ABI\/config changed/);
  }
});

test('historical built V29 app config remains V28 runtime-compatible across store metadata', () => {
  // Release and PR workflow both check out full Git history. Missing baseline
  // is a hard failure: never skip the release identity contract.
  const source = execFileSync('git', ['show', pinnedV28 + ':app.config.js'], { encoding: 'utf8' });
  const builtV29Source = execFileSync('git', ['show', 'bd0f0155ad3fa6a7481e60d29ef9091de8b527b1:app.config.js'], { encoding: 'utf8' });
  const actual = resolveExpoConfigFromSource(builtV29Source);
  assertNativeRuntimeCompatible(actual, resolveExpoConfigFromSource(source));
});

test('release guard still verifies native paths, source identity and frozen RC', () => {
  const release = fs.readFileSync('scripts/android-ota-rc.cjs', 'utf8');
  const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
  assert.match(release, /2f26645e50e8e079ebf09f3999aacfc506ae7651/);
  assert.match(release, /assertNativeRuntimeCompatible\(/);
  assert.match(release, /package-lock\.json/);
  assert.match(release, /'android', 'plugins'/);
  assert.match(workflow, /node --test tests\/native-expo-config-compat\.test\.cjs/);
  assert.match(workflow, /node scripts\/android-ota-rc\.cjs baseline/);
  assert.match(workflow, /node scripts\/android-ota-rc\.cjs published/);
});
