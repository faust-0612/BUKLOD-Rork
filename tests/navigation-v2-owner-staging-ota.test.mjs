import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyChannels, verifyBuild, verifyUpdate, parseManifest, BUILD_ID, APK_SOURCE, PROJECT, OWNER_EXCLUSIONS } from '../scripts/navigation-v2-owner-staging-policy.mjs';
const channel = (name, id = name) => ({ currentPage: { name, isPaused: false, branchMapping: JSON.stringify({ version: 0, data: [{ branchId: id, branchMappingLogic: 'true' }] }), updateBranches: [{ id, name }] } });
test('staging policy rejects shared branches, rollouts, missing or paused mappings', () => {
  assert.equal(verifyChannels(channel('staging-user'), channel('production')).name, 'staging-user');
  assert.throws(() => verifyChannels(channel('staging-user', 'same'), channel('production', 'same')));
  for (const mutate of [c => c.currentPage.isPaused = true, c => c.currentPage.branchMapping = '{}', c => c.currentPage.updateBranches = [], c => c.currentPage.branchMapping = JSON.stringify({ data: [{ branchId: 'staging-user' }, { branchId: 'other' }] })]) {
    const c = channel('staging-user'); mutate(c); assert.throws(() => verifyChannels(c, channel('production')));
  }
});
test('existing APK requires exact finished Android runtime and build identity', () => {
  const b = { id: BUILD_ID, gitCommitHash: APK_SOURCE, status: 'FINISHED', platform: 'ANDROID', buildProfile: 'staging-user', channel: 'staging-user', runtimeVersion: '1.3.2', appBuildVersion: '10', project: { id: PROJECT } };
  assert.equal(verifyBuild(b), true);
  for (const [key, value] of Object.entries({ id: 'wrong', gitCommitHash: 'a'.repeat(40), status: 'ERRORED', platform: 'IOS', buildProfile: 'production', channel: 'production', runtimeVersion: '1.3.6', appBuildVersion: '9', project: { id: 'other' } })) assert.throws(() => verifyBuild({ ...b, [key]: value }));
});
test('server update must attest one Android update on exact source and staging branch', () => {
  const sha = 'a'.repeat(40), u = { id: 'update', group: 'group', platform: 'android', runtimeVersion: '1.3.2', gitCommitHash: sha, branch: 'staging-user', createdAt: '2026-11-13T10:00:00Z' };
  assert.equal(verifyUpdate([u], sha, 'staging-user'), u);
  for (const patch of [{ platform: 'ios' }, { runtimeVersion: 'other' }, { gitCommitHash: 'b'.repeat(40) }, { branch: 'production' }, { createdAt: '' }, { isRollBackToEmbedded: true }]) assert.throws(() => verifyUpdate([{ ...u, ...patch }], sha, 'staging-user'));
  assert.throws(() => verifyUpdate([u, u], sha, 'staging-user'));
});
test('manifest parsing accepts actual protocol shapes and rejects absent manifest', () => {
  const m = { id: 'test', launchAsset: { url: 'https://example.com/bundle' } };
  assert.deepEqual(parseManifest(JSON.stringify(m), 'application/expo+json'), m);
  assert.deepEqual(parseManifest('--test\r\ncontent-type: application/json\r\n\r\n' + JSON.stringify(m) + '\r\n--test--', 'multipart/mixed; boundary="test"'), m);
  assert.throws(() => parseManifest('--test--', 'multipart/mixed; boundary=test'));
});
test('owner exclusions never become passed device evidence and original gates remain strict', () => {
  assert.equal(OWNER_EXCLUSIONS.physicalDeviceAcceptance, 'SKIPPED BY OWNER');
  const original = fs.readFileSync('scripts/navigation-v2-staging-gate.mjs', 'utf8');
  assert.match(original, /stage.deviceAcceptance !== 'passed'/);
  assert.match(original, /stage.nativeImeCommitContentVerified !== true/);
  const w = fs.readFileSync('.github/workflows/navigation-v2-owner-staging-ota.yml', 'utf8');
  assert.match(w, /BUKLOD_OWNER_STAGING_OTA_20261113:/);
  assert.match(w, /actions: read/);
  assert.match(w, /--channel staging-user --platform android --environment preview/);
  assert.match(w, /postpublish/);
  assert.doesNotMatch(w, /--channel production|eas-cli@[^\s]+ build\s|git push|vercel deploy/);
});
