import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const record = JSON.parse(read('.buklod/releases/nonseason2-wave1-prod-ota-20261119.json'));
const scope = JSON.parse(read('.buklod/scopes/nonseason2-wave1-prod-promotion-20261119.json'));
const embargo = read('scripts/buklod-season2-production-embargo.cjs');
const workflow = read('.github/workflows/production_android_ota.yml');
const rc = read('scripts/android-ota-rc.cjs');

test('non-Season2 release marker remains exact Android production RC handoff, not a reward release', () => {
  assert.equal(record.target, 'production');
  assert.equal(record.platform, 'android');
  assert.equal(record.sourceMainSha, '58ccfa0828fbf2db8457bb3d94a898f122d54925');
  assert.equal(record.sourcePr, 986);
  assert.equal(record.stagingServerVerified, true);
  assert.equal(record.stagingSourceSha, 'e2cb810ee44940fa21ca1b8eba4d220b250cb78e');
  assert.equal(record.stagingUpdateId, '01a1f3de-f515-7180-8456-a15f2fa648be');
  assert.equal(record.stagingRunId, 44527675178);
  assert.equal(record.stagingChannel, 'staging-user');
  assert.equal(record.expectedAndroidPackage, 'org.mzbministry.buklod');
  assert.equal(record.expectedRuntimeVersion, '1.3.2');
  assert.equal(record.expectedChannel, 'production');
  assert.equal(record.season2ProductionAuthorized, false);
  assert.equal(record.season2BackendRewardsAuthorized, false);
  assert.equal(record.season1RewardRulesUnchanged, true);
  assert.equal(record.published, false);
  assert.equal(record.doNotClaimLiveUntilServedManifest, true);
});
test('production promotion touches release marker and auditable test only', () => {
  assert.equal(scope.baseRef, record.sourceMainSha);
  assert.deepEqual(new Set(scope.allowedPaths), new Set([
    '.buklod/scopes/nonseason2-wave1-prod-promotion-20261119.json',
    '.buklod/releases/nonseason2-wave1-prod-ota-20261119.json',
    'tests/nonseason2-wave1-production-release-marker-20261119.test.mjs',
  ]));
  assert.deepEqual(scope.regressionTests, ['tests/nonseason2-wave1-production-release-marker-20261119.test.mjs']);
  assert.deepEqual(scope.lockedFeatureChanges, []);
});
test('existing workflow remains responsible for production native, ads, navigation, served hash and embargo', () => {
  assert.ok(workflow.includes('BUKLOD_ANDROID_ONLY_PROD_20261114:'));
  for (const command of [
    'node scripts/buklod-season2-production-embargo.cjs --production',
    'node scripts/android-ota-rc.cjs baseline',
    'node scripts/android-ota-rc.cjs freeze',
    'node scripts/android-ota-rc.cjs verify',
    'node scripts/android-ota-rc.cjs published',
    '--channel production --platform android',
  ]) assert.ok(workflow.includes(command), command);
  assert.ok(rc.includes('assert.equal(live.launchAsset.hash, bundleHash'));
  assert.ok(embargo.includes('INDEPENDENT_NON_SEASON2_FIX_REQUIRES_NORMAL_GATES'));
});
