import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  inspectNavV2Checklist, inspectNavV2Prepublish, inspectNavV2StagingRelease, REQUIRED_NAV_V2_IDS,
} from '../scripts/navigation-v2-staging-gate.mjs';

const checklist = JSON.parse(fs.readFileSync(new URL('../docs/navigation-v2-completion.json', import.meta.url)));
const sha = 'a'.repeat(40);
const now = Date.parse('2026-11-13T04:00:00Z');
const simulated = {
  live: { sourceSha: 'b'.repeat(40), updateId: 'live-ota-example', package: 'org.mzbministry.buklod',
    channel: 'production', runtimeVersion: '1.3.2', verifiedAt: new Date(now).toISOString(),
    artifactEvidenceUrl: 'https://expo.dev/accounts/example/projects/buklod/updates/simulated-live' },
  staging: { mirroredLiveSourceSha: 'b'.repeat(40), rcSourceSha: sha, buildId: 'simulated-build',
    installedBuildId: 'simulated-build', otaUpdateId: 'simulated-ota',
    publishedRcUpdateId: 'simulated-ota', updateSourceSha: sha, package: 'org.mzbministry.buklod.staging',
    channel: 'staging-user', environment: 'preview', runtimeVersion: '1.3.2',
    verifiedAt: new Date(now).toISOString(),
    artifactEvidenceUrl: 'https://expo.dev/accounts/example/projects/buklod/builds/simulated',
    backendContractReviewed: true, backendEvidenceUrl: 'https://github.com/example/simulated-review',
    securityAndRegressionQA: 'passed', qaEvidenceUrl: 'https://github.com/example/simulated-ci',
    deviceAcceptance: 'passed', deviceEvidenceUrl: 'https://github.com/example/simulated-device-check' },
};
const completed = () => ({ ...checklist, requirements: checklist.requirements.map(item => ({
  ...item, status: 'verified', evidence: ['https://github.com/example/simulated-proof'],
})) });

test('all mandated Navigation 2.0 controls are enumerated; current DEV must block staging', () => {
  const result = inspectNavV2Checklist(checklist);
  assert.equal(result.total, 21);
  assert.equal(new Set(REQUIRED_NAV_V2_IDS).size, 21);
  assert.ok(result.unfinished.includes('ime-media'));
  assert.ok(result.unfinished.includes('staging-parity'));
  assert.equal(result.ready, false);
});
test('missing items, duplicate IDs, disabled blocks and fake VERIFIED evidence fail closed', () => {
  const missing = structuredClone(completed());
  missing.requirements = missing.requirements.filter(x => x.id !== 'ime-media');
  assert.equal(inspectNavV2Checklist(missing).ready, false);
  const duplicate = structuredClone(completed());
  duplicate.requirements.push(duplicate.requirements[0]);
  assert.ok(inspectNavV2Checklist(duplicate).failures.some(s => s.includes('Duplicate')));
  const skipped = structuredClone(completed());
  skipped.requirements[0].blockRelease = false;
  assert.equal(inspectNavV2Checklist(skipped).ready, false);
  const noProof = structuredClone(completed());
  noProof.requirements[0].evidence = [];
  assert.equal(inspectNavV2Checklist(noProof).ready, false);
});
test('release requires exact live parity and installed staging identity, not only completed labels', () => {
  const ready = completed();
  assert.equal(inspectNavV2Checklist(ready).ready, true);
  assert.equal(inspectNavV2StagingRelease(ready, null, sha, now).ready, false);
  const beforePublishing = structuredClone(ready);
  beforePublishing.requirements.find(item => item.id === 'verified-staging-release').status = 'pending';
  assert.equal(inspectNavV2Prepublish(beforePublishing, simulated, sha, now).ready, true,
    'Only the post-publish staging verification item may remain pending in prepublish');
  beforePublishing.requirements.find(item => item.id === 'responsive-font').status = 'pending';
  assert.equal(inspectNavV2Prepublish(beforePublishing, simulated, sha, now).ready, false);
  assert.equal(inspectNavV2StagingRelease(ready, simulated, sha, now).ready, true,
    'This is a synthetic contract fixture, NOT an actual release attestation');
  const wrongPkg = structuredClone(simulated);
  wrongPkg.staging.package = 'org.mzbministry.buklod';
  assert.equal(inspectNavV2StagingRelease(ready, wrongPkg, sha, now).ready, false);
  const wrongBase = structuredClone(simulated);
  wrongBase.staging.mirroredLiveSourceSha = 'c'.repeat(40);
  assert.equal(inspectNavV2StagingRelease(ready, wrongBase, sha, now).ready, false);
  const stale = structuredClone(simulated);
  stale.live.verifiedAt = new Date(now-10*3600000).toISOString();
  assert.equal(inspectNavV2StagingRelease(ready, stale, sha, now).ready, false);
  const unverifiedDevice = structuredClone(simulated);
  unverifiedDevice.staging.deviceAcceptance = 'skipped';
  assert.equal(inspectNavV2StagingRelease(ready, unverifiedDevice, sha, now).ready, false);
});
