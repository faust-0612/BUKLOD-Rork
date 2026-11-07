import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = path => readFileSync(path, 'utf8');
const workflow = read('.github/workflows/production_android_ota.yml');
const oldLock = read('scripts/community-help-sos-release-contract.mjs');

test('SOS R1 lock executes before new R2 notification tests and all OTA publish operations', () => {
  const original = workflow.indexOf('node scripts/community-help-sos-release-contract.mjs');
  const compat = workflow.indexOf('node --test tests/sos-r1-r2-notification-deeplink-20261107.test.mjs');
  const typescript = workflow.indexOf('npx tsc --noEmit');
  const ads = workflow.indexOf('node --test tests/production-ota-ads-regression.test.mjs');
  const freeze = workflow.indexOf('node scripts/android-ota-rc.cjs freeze');
  const publish = workflow.indexOf('npx eas-cli@latest update --channel production');
  assert.ok(original >= 0 && compat > original && typescript > compat);
  assert.ok(ads > compat && freeze > ads && publish > freeze);
  assert.match(oldLock, /\/buklod\?help_request_id=/);
  assert.match(oldLock, /Do not bypass this gate/);
  assert.doesNotThrow(() => execFileSync(process.execPath, [
    'scripts/community-help-sos-release-contract.mjs',
  ], { timeout: 10_000, stdio: 'pipe' }));
});

test('No ad restoration regression, native runtime change, or production credential bypass', () => {
  assert.match(workflow, /env:exec production 'node scripts\/verify-production-ads-env.cjs'/);
  assert.match(workflow, /node scripts\/android-ota-rc.cjs baseline/);
  assert.match(workflow, /node scripts\/android-ota-rc.cjs verify/);
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  const app = read('app.config.js');
  assert.match(app, /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});
