'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');

// Evaluate the pinned, trusted Git revision without importing or installing it.
// The current and pinned configs see the same environment.
function resolveExpoConfigFromSource(source, env = process.env) {
  const sandbox = { module: { exports: {} }, process: { env: { ...env } } };
  const config = vm.runInNewContext(
    source + '\n;module.exports({ config: {} });',
    sandbox,
    { filename: 'pinned-v28-app.config.js', timeout: 3000 },
  );
  assert.ok(config && typeof config === 'object' && !Array.isArray(config), 'Invalid pinned Expo config');
  return JSON.parse(JSON.stringify(config));
}

function nativeExpoConfig(config) {
  assert.ok(config && typeof config === 'object', 'Missing Expo config');
  // Web-only Expo presentation settings, including the favicon, are not
  // compiled into Android V28. Every other config field remains guarded.
  const { web: _web, ...native } = config;
  return JSON.parse(JSON.stringify(native));
}

function assertNativeExpoConfigCompatible(current, pinned) {
  assert.deepStrictEqual(
    nativeExpoConfig(current),
    nativeExpoConfig(pinned),
    'Native Expo configuration changed since pinned V28 build baseline',
  );
}

// Android versionName and versionCode are store metadata. Unlike plugins,
// permissions, SDK/native dependencies and update configuration, these values
// may change across V28/V29 while both still use Expo runtime 1.3.2.
function nativeRuntimeConfig(config) {
  const native = nativeExpoConfig(config);
  delete native.version;
  if (native.android) delete native.android.versionCode;
  return native;
}
function assertNativeRuntimeCompatible(current, pinned) {
  assert.deepStrictEqual(
    nativeRuntimeConfig(current),
    nativeRuntimeConfig(pinned),
    'Native ABI/config changed since pinned V28 baseline; bump runtime and build before OTA',
  );
}

module.exports = {
  resolveExpoConfigFromSource, nativeExpoConfig, nativeRuntimeConfig,
  assertNativeExpoConfigCompatible, assertNativeRuntimeCompatible,
};
