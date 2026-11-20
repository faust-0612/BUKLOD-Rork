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

test('Canonical Android OTA exports full bundle containing mounted silent host', () => {
  assert.match(workflow, /expo export --platform android --output-dir rc/);
  assert.match(root, /<BuklodOtaFreshnessHost \/>/);
});
