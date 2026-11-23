const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const host = fs.readFileSync('src/components/BuklodOtaFreshnessHost.native.tsx', 'utf8');
const root = fs.readFileSync('src/app/_layout.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');

test('Root keeps silent OTA lifecycle host inside SafeAreaProvider', () => {
  assert.match(root, /<SafeAreaProvider>/);
  assert.match(root, /<BuklodOtaFreshnessHost \/>/);
  assert.ok(root.indexOf('<SafeAreaProvider>') < root.indexOf('<BuklodOtaFreshnessHost />'));
});

test('No restart banner, restart controls or forced native OTA reload exist', () => {
  assert.match(host, /return null;/);
  assert.doesNotMatch(host, /Pressable|accessibilityRole="alert"|I-restart|Mamaya|reloadAsync|StatusBar|StyleSheet/);
  assert.match(host, /AppState\.addEventListener/);
  assert.match(host, /AppState\.currentState === 'active'/);
  assert.match(host, /subscription\.remove\(\)/);
  assert.match(host, /clearTimeout\(timer\)/);
});

test('silent OTA remains reviewed on staging and cannot trigger production', () => {
  // Current production uses an exact main-only commit marker, not legacy paths filtering.
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /startsWith\(github\.event\.head_commit\.message/);
  assert.match(workflow, /buklod-season2-production-embargo\.cjs/);
  const qa = fs.readFileSync('.github/workflows/genesis-all-updates-conso-qa-20261122.yml','utf8');
  assert.ok(qa.includes('tests/buklod-silent-ota-policy.test.mjs'));
  assert.ok(qa.includes('tests/ota-restart-safe-area.test.cjs'));
  assert.doesNotMatch(qa, /eas-cli.*update --channel production|eas-cli.*build --profile production/);
});
