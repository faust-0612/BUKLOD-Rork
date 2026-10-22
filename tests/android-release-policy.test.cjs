const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync, execFileSync } = require('node:child_process');
const { checkPolicy, checkLegacyPublisher } = require('../scripts/check-android-release-policy.cjs');
const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
test('manual immutable-RC workflow passes policy; ordinary pushes and mutable main are rejected', () => {
  assert.doesNotThrow(() => checkPolicy(workflow));
  assert.throws(() => checkPolicy(workflow.replace('on:\n', 'on:\n  push:\n')), /manual only/);
  assert.throws(() => checkPolicy(workflow.replace('ref: ${{ inputs.rc_sha }}', 'ref: main')), /immutable RC/);
  assert.throws(() => checkPolicy(workflow.replace("    if: inputs.operation == 'publish'\n", '')), /must not publish/);
});
test('read-only inspection evidence omits credentials and signed artifact URLs', () => {
  const { sanitize } = require('../scripts/sanitize-expo-inspection.cjs');
  const result = sanitize({id:'build-id',gitCommitHash:'sha',artifacts:{applicationArchiveUrl:'https://example.invalid/signed'},ownerAccount:{email:'private'},environment:{EXPO_TOKEN:'private'}});
  assert.deepEqual(result,{id:'build-id',gitCommitHash:'sha',artifacts:{}});
});
test('required readiness and publish verification gates cannot be removed', () => {
  for (const gate of ['verify-android-rc-readiness.cjs', 'character:contract', 'verify-production-android-update.cjs published']) {
    assert.throws(() => checkPolicy(workflow.replace(gate, 'removed')), /Missing release gate/);
  }
});
test('runtime guard rejects wrong channel, platform, project, runtime target, SHA and missing authorization', () => {
  const env = { ...process.env, APP_VARIANT:'production', EXPO_PUBLIC_APP_ENV:'production', BUKLOD_APP_TARGET:'main', EAS_PROJECT_ID:'23dad7d0-389a-406e-8dec-08965dab85d8', OTA_CHANNEL:'production', OTA_PLATFORM:'android', APPROVED_RC_SHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), RELEASE_CONFIRMATION:'PUBLISH_ANDROID_PRODUCTION' };
  const run = patch => spawnSync(process.execPath, ['scripts/guard-android-ota-runtime.cjs'], { env:{...env,...patch}, encoding:'utf8' });
  assert.equal(run({}).status, 0);
  for (const bad of [{OTA_CHANNEL:'preview'},{OTA_PLATFORM:'ios'},{EAS_PROJECT_ID:'wrong'},{BUKLOD_APP_TARGET:'classroom'},{APP_VARIANT:'development'},{APPROVED_RC_SHA:'main'},{APPROVED_RC_SHA:'0'.repeat(40)},{RELEASE_CONFIRMATION:''}]) assert.notEqual(run(bad).status, 0);
});
test('absent original-binary and functional evidence blocks RC publication', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-android-rc-readiness.cjs'], { encoding:'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BLOCKED/);
});
test('legacy Android publishers cannot bypass authorization through manual or push entry points', () => {
  const retired = 'on:\n  workflow_dispatch:\njobs:\n  old:\n    if: ${{ false }}\n    steps:\n      - run: npx eas-cli@25.3.0 update --platform android --channel production\n';
  assert.doesNotThrow(() => checkLegacyPublisher(retired));
  assert.throws(() => checkLegacyPublisher(retired.replace('on:\n', 'on:\n  push:\n')), /push trigger/);
  assert.throws(() => checkLegacyPublisher(retired.replace('    if: ${{ false }}\n', '')), /bypasses/);
});
