import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const workflow = readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
const focusedAdTests = [
  "tests/buklod-wall-ad-stability.test.mjs",
  "tests/buklod-profile-connect-home-ads.test.mjs",
  "tests/buklod-native-ad-navigation-scroll.test.mjs",
  "tests/buklod-cluster-faith-ad-scope.test.mjs",
  "tests/buklod-ad-startup-fast-path.test.mjs",
  "tests/buklod-ad-empty-slot-collapse.test.mjs",
  "tests/buklod-ad-request-gate-recovery.test.mjs",
  "tests/buklod-ad-opportunities.test.cjs",
  "tests/faith-scope-creation-ad-safety.test.mjs",
  "tests/buklod-ad-natural-break-expansion.test.mjs",
  "tests/buklod-android-wall-ad-density.test.mjs"
];

test('production OTA executes AdMob regressions after TypeScript and before RC freeze/publish', () => {
  const typecheck = workflow.indexOf('      - name: TypeScript QA');
  const suite = workflow.indexOf('      - name: AdMob startup, scope, fallback and recovery regression suite');
  const expoPreflight = workflow.indexOf('      - name: Expo credential preflight');
  const freeze = workflow.indexOf('      - name: Freeze verified RC');
  const publish = workflow.indexOf('      - name: Publish exact frozen Android RC');
  assert.ok(typecheck >= 0 && suite > typecheck, 'AdMob suite must run after TypeScript QA');
  assert.ok(expoPreflight > suite && freeze > suite && publish > suite, 'AdMob suite must run before Expo preflight, RC freeze and publication');
  assert.ok(workflow.includes('node --test tests/production-ota-ads-regression.test.mjs'), 'Production OTA must execute this canonical regression harness');
});

test('all focused AdMob startup, scope, fallback, density and interstitial regressions pass', () => {
  const output = execFileSync(process.execPath, ['--test', ...focusedAdTests], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120_000,
  });
  assert.match(output, /# fail 0/);
  assert.match(output, /# pass \d+/);
});
