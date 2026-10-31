import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const host = readFileSync('src/components/BuklodOtaFreshnessHost.native.tsx', 'utf8');
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
const nativeConfig = readFileSync('app.config.js', 'utf8');

test('fast staging OTA is gated on the native channel, not mutable JS environment', () => {
  assert.match(host, /Updates\.channel === 'staging-user'/);
  assert.match(host, /if \(__DEV__ \|\| !Updates\.isEnabled \|\| IS_STAGING_USER\) return;/);
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build['staging-user'].developmentClient, undefined);
  assert.equal(eas.build['staging-user'].android.buildType, 'apk');
  assert.equal(eas.build.production.channel, 'production');
  assert.match(nativeConfig, /org\.mzbministry\.buklod\.staging/);
});

test('staging checks once per foreground return with throttle and shared in-flight request', () => {
  assert.match(host, /STAGING_FOREGROUND_INTERVAL_MS = 60 \* 1000/);
  assert.match(host, /STAGING_FAILURE_COOLDOWN_MS = 30 \* 1000/);
  assert.match(host, /if \(stagingRequest\) return stagingRequest/);
  assert.match(host, /checkStagingAndDownload\(false\)/);
  assert.match(host, /checkStagingAndDownload\(true\)/);
});

test('staging never silently reloads; downloaded updates require a user-confirmed restart', () => {
  assert.match(host, /Alert\.alert\(/);
  assert.match(host, /Restart only after saving edits and finishing any call, PTT, or upload/);
  assert.match(host, /text: 'Restart staging'/);
  assert.match(host, /onPress: \(\) => \{\s*setReloading\(true\);\s*void Updates\.reloadAsync\(\)/);
  assert.match(host, /pending \? 'Apply update' : 'Check update'/);
});
