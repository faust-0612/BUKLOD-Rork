import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../docs/engineering/BUKLOD_UNIFIED_MODERNIZATION_MATRIX_20261113.json', import.meta.url), 'utf8'));
const doc = fs.readFileSync(new URL('../docs/engineering/BUKLOD_UNIFIED_MODERNIZATION_BLUEPRINT_20261113.md', import.meta.url), 'utf8');
const scope = JSON.parse(fs.readFileSync(new URL('../.buklod/scopes/unified-modernization-plan-20261113.json', import.meta.url), 'utf8'));

test('all 30 owner photo concepts are classified exactly once and in supplied order', () => {
  assert.equal(data.documentationOnly, true);
  assert.equal(data.referenceImageCount, 30);
  assert.equal(data.images.length, 30);
  assert.deepEqual(data.images.map(item => item.image), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.ok(data.images.every(item => item.concept && item.sourceStatus && item.actionOrReason && item.priority));
  assert.ok(data.images.every(item => ['P0','P1','P2','P3','NONE'].includes(item.priority)));
});

test('21 existing Navigation V2 requirements are accounted for without false verification', () => {
  assert.equal(data.navigationRequirements.length, 21);
  assert.equal(new Set(data.navigationRequirements.map(row => row.id)).size, 21);
  assert.ok(data.navigationRequirements.every(row => row.canonical === true && row.proofStatus === 'NOT_VERIFIED'));
  assert.match(data.canonicalNavigationChecklist, /navigation-v2-completion\.json/);
  assert.match(doc, /21\s+checklist/i);
  assert.match(doc, /0\/21/);
});

test('workstream graph has unique owners, known dependencies, and explicit stage-first blockers', () => {
  const ids = data.workstreams.map(x => x.id);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  const set = new Set(ids);
  assert.ok(data.workstreams.every(x => x.title && x.state && x.priority && x.stop && x.dependencies.every(d => set.has(d))));
  assert.ok(data.workstreams.some(x => x.id === 'RC-STAGE' && x.state.startsWith('blocked')));
  assert.ok(data.workstreams.some(x => x.id === 'WEB-PROD' && x.state === 'not-authorized'));
  assert.deepEqual(data.ownerApprovalRequiredFor, ['web','production Android']);
});

test('planning cannot claim installed production/staging success or change protected runtime', () => {
  assert.equal(data.releaseIdentity.installedClientVerified, false);
  assert.equal(data.releaseIdentity.stagingInstalledVerified, false);
  assert.match(doc, /no.*auto.*web\/production/i);
  assert.ok(data.prohibitedWithoutNewEvidence.includes('automatic staging/web/production publishing'));
  assert.equal(scope.contractVersion, 2);
  assert.deepEqual(scope.regressionTests, ['tests/unified-modernization-planning-contract-20261113.test.mjs']);
  assert.deepEqual(scope.allowedPaths.slice().sort(), [
    '.buklod/scopes/unified-modernization-plan-20261113.json',
    'docs/engineering/BUKLOD_UNIFIED_MODERNIZATION_BLUEPRINT_20261113.md',
    'docs/engineering/BUKLOD_UNIFIED_MODERNIZATION_MATRIX_20261113.json',
    'tests/unified-modernization-planning-contract-20261113.test.mjs',
  ].sort());
  assert.match(doc, /205/);
  assert.match(doc, /PR #783/);
  assert.match(doc, /PR #784/);
  assert.match(doc, /PR #780/);
  assert.ok(data.existingPrs.includes(780));
  assert.equal(data.releaseIdentity.stagingSignedApkArtifact.signedApkDownloadedAndZipValidated, true);
  assert.equal(data.releaseIdentity.stagingSignedApkArtifact.installedOnDeviceVerified, false);
});
