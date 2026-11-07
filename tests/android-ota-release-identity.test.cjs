'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolveExpoConfigFromSource, assertNativeExpoConfigCompatible } = require('../scripts/native-expo-config-compat.cjs');

test('Android OTA release identity: actual V28 native config remains equal after canonical web favicon upgrade', () => {
  const pinned = resolveExpoConfigFromSource(execFileSync('git', [
    'show', '2f26645e50e8e079ebf09f3999aacfc506ae7651:app.config.js',
  ], { encoding: 'utf8' }));
  const current = require('../app.config.js')({ config: {} });
  assert.equal(current.runtimeVersion, '1.3.2');
  assert.equal(current.android.package, 'org.mzbministry.buklod');
  assert.equal(current.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assertNativeExpoConfigCompatible(current, pinned);
  const webOnly = structuredClone(current);
  webOnly.web.favicon = 'some-new-web-only-favicon.png';
  assertNativeExpoConfigCompatible(webOnly, pinned);
  const nativeDrift = structuredClone(current);
  nativeDrift.plugins.push('new-unauthorized-native-plugin');
  assert.throws(() => assertNativeExpoConfigCompatible(nativeDrift, pinned), /Native Expo configuration changed/);
});
