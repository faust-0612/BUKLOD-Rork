import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyChannels, verifyBuild, verifyUpdate, parseManifest, verifyApprovedMediaDelta, verifySource, APPROVED_MEDIA_COMMIT, APPROVED_MEDIA_BLOBS, BUILD_ID, APK_SOURCE, PROJECT, OWNER_EXCLUSIONS } from '../scripts/navigation-v2-owner-staging-policy.mjs';
import { execFileSync } from 'node:child_process';
const channel = (name, id = name) => ({ currentPage: { name, isPaused: false, branchMapping: JSON.stringify({ version: 0, data: [{ branchId: id, branchMappingLogic: 'true' }] }), updateBranches: [{ id, name }] } });
test('staging policy rejects shared branches, rollouts, missing or paused mappings', () => {
  assert.equal(verifyChannels(channel('staging-user'), channel('production')).name, 'staging-user');
  assert.throws(() => verifyChannels(channel('staging-user', 'same'), channel('production', 'same')));
  for (const mutate of [c => c.currentPage.isPaused = true, c => c.currentPage.branchMapping = '{}', c => c.currentPage.updateBranches = [], c => c.currentPage.branchMapping = JSON.stringify({ data: [{ branchId: 'staging-user' }, { branchId: 'other' }] })]) {
    const c = channel('staging-user'); mutate(c); assert.throws(() => verifyChannels(c, channel('production')));
  }
});
test('existing APK requires exact finished Android runtime and build identity', () => {
  const b = { id: BUILD_ID, gitCommitHash: APK_SOURCE, status: 'FINISHED', platform: 'ANDROID', buildProfile: 'staging-user', updateChannel: { name: 'staging-user' }, runtime: { version: '1.3.2' }, appBuildVersion: '10', app: { id: PROJECT }, appIdentifier: 'org.mzbministry.buklod.staging', appVersion: '1.3.6', distribution: 'INTERNAL' };
  assert.equal(verifyBuild(b), true);
  for (const [key, value] of Object.entries({ id: 'wrong', gitCommitHash: 'a'.repeat(40), status: 'ERRORED', platform: 'IOS', buildProfile: 'production', updateChannel: { name: 'production' }, runtime: { version: '1.3.6' }, appBuildVersion: '9', app: { id: 'other' }, appIdentifier: 'org.mzbministry.buklod', distribution: 'STORE', appVersion: '1.3.5' })) assert.throws(() => verifyBuild({ ...b, [key]: value }));
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

test('owner media OTA permits exactly three pinned original-quality JS media files', () => {
  const pairs = Object.entries(APPROVED_MEDIA_BLOBS);
  assert.equal(APPROVED_MEDIA_COMMIT, '55f6bd0678ffeb0e6a134a446b34e882cf8af634');
  assert.equal(pairs.length, 3);
  assert.equal(Object.isFrozen(APPROVED_MEDIA_BLOBS), true);
  const metadata = ['.github/workflows/navigation-v2-owner-staging-ota.yml','scripts/navigation-v2-owner-staging-policy.mjs','tests/navigation-v2-owner-staging-ota.test.mjs'];
  const paths = [...pairs.map(([path]) => path), ...metadata];
  const approved = path => APPROVED_MEDIA_BLOBS[path];
  assert.equal(verifyApprovedMediaDelta(paths, approved), true);
  for (const [path] of pairs) {
    assert.throws(() => verifyApprovedMediaDelta(paths.filter(v => v !== path), approved), /Missing approved/);
    assert.throws(() => verifyApprovedMediaDelta(paths, v => v === path ? '0'.repeat(40) : approved(v)), /Unreviewed media blob/);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD:' + path], {encoding:'utf8'}).trim(), APPROVED_MEDIA_BLOBS[path]);
  }
  for (const path of ['src/app/(tabs)/buklod.tsx','src/components/CommunityVideo.tsx','src/lib/supabase.ts','package.json','eas.json','app.config.js','assets/release/icon.png','supabase/migrations/new.sql','plugins/unreviewed.js','android/app/build.gradle']) {
    assert.throws(() => verifyApprovedMediaDelta([...paths,path], approved), /Unexpected signed-APK-source delta/);
  }
  assert.throws(() => verifyApprovedMediaDelta([...paths,paths[0]], approved), /Duplicate/);
  const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();
  assert.equal(git('merge-base', APPROVED_MEDIA_COMMIT, 'HEAD'), APPROVED_MEDIA_COMMIT);
  assert.doesNotThrow(() => verifySource(git('rev-parse','HEAD')));
});
