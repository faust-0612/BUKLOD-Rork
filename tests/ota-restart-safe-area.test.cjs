const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const host = fs.readFileSync('src/components/BuklodOtaFreshnessHost.native.tsx', 'utf8');
const root = fs.readFileSync('src/app/_layout.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');

test('OTA restart notice is rendered inside the root native safe-area provider', () => {
  assert.match(root, /<SafeAreaProvider>/);
  assert.match(root, /<BuklodOtaFreshnessHost \/>/);
  assert.ok(root.indexOf('<SafeAreaProvider>') < root.indexOf('<BuklodOtaFreshnessHost />'));
});

test('Edge-to-edge phones leave status-bar space above the update banner', () => {
  assert.match(host, /useSafeAreaInsets/);
  assert.match(host, /Math\.max\(insets\.top, StatusBar\.currentHeight \?\? 0\)/);
  assert.match(host, /paddingTop: statusBarInset \+ 8/);
  assert.match(host, /BUKLOD_OTA_RESTART_SAFE_AREA_R1/);
});

test('Restart and Later remain large, independently tappable controls on narrow phones', () => {
  assert.match(host, /<View style=\{styles\.actions\}>/);
  assert.match(host, /flexDirection: 'column'/);
  assert.match(host, /actions: \{ flexDirection: 'row'/);
  assert.match(host, /minHeight: 44/g);
  assert.match(host, /accessibilityLabel="Restart BUKLOD to apply update"/);
  assert.match(host, /accessibilityLabel="Apply update next time"/);
  assert.match(host, /onPress=\{\(\) => setDismissed\(true\)\}/);
});

test('Native OTA still reloads on an explicit click and never silently interrupts active calls/PTT', () => {
  assert.match(host, /void Updates\.reloadAsync\(\)/);
  assert.match(host, /disabled=\{reloading\}/);
  assert.match(host, /I-restart kapag walang tawag o PTT/);
  assert.doesNotMatch(host, /setTimeout\(\(\) => Updates\.reloadAsync/);
});

test('OTA native safe-area host changes are routed through canonical Android production OTA', () => {
  assert.match(workflow, /^\s+- 'src\/components\/BuklodOtaFreshnessHost\.native\.tsx'$/m);
});
