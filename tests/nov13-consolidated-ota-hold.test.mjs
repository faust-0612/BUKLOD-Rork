import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventory = JSON.parse(readFileSync('release/nov13-consolidated-ota-preparation.json', 'utf8'));
const manifest = JSON.parse(readFileSync('.buklod/scopes/nov13-conso-inventory-hold-20261113.json', 'utf8'));
const plan = readFileSync('docs/nov13-consolidated-ota-preparation.md', 'utf8');

test('consolidated inventory is strictly nonpublishing and staging-first', () => {
  assert.equal(inventory.status, 'PREPARATION_HOLD_ONLY__DO_NOT_PUBLISH');
  for (const gate of ['publicationAllowed','runOta','runWebDeploy','runApkBuild','mergeToMainAuthorized']) {
    assert.equal(inventory[gate], false, gate + ' must remain disabled');
  }
  assert.equal(inventory.target.channel, 'production');
  assert.equal(inventory.target.runtime, '1.3.2');
  assert.equal(inventory.target.webReleaseAuthorized, false);
  assert.ok(inventory.releaseGates.some(x => /staging-user/i.test(x)));
  assert.ok(inventory.releaseGates.some(x => /owner release authorization/i.test(x)));
  assert.ok(inventory.blockedUntilVerified.length >= 4);
  assert.match(plan, /NO OTA, NO web deploy, NO APK\/AAB, NO merge/);
});

test('candidate inventory is complete, deduplicated and respects retired IGPAT', () => {
  const candidates = inventory.candidates;
  assert.ok(candidates.length >= 20);
  assert.equal(new Set(candidates.map(c=>c.pr)).size, candidates.length);
  for (const pr of [783,786,784,774,773,772,763,762,759,758,757,756,755,754,748,743,741,740,739,780]) {
    assert.ok(candidates.some(c=>c.pr===pr), 'missing PR #'+pr);
    assert.match(plan, new RegExp('#'+pr+'\\]\\('));
  }
  for (const pr of [679,717]) {
    assert.equal(candidates.find(c=>c.pr===pr)?.decision,'EXCLUDE');
  }
  assert.equal(candidates.find(c=>c.pr===787)?.decision,'DOCS_ONLY_NO_OTA_PAYLOAD');
});

test('scope cannot authorize release code or production changes', () => {
  assert.equal(manifest.contractVersion, 2);
  assert.deepEqual(manifest.lockedFeatureChanges, []);
  assert.deepEqual(manifest.regressionTests, ['tests/nov13-consolidated-ota-hold.test.mjs']);
  assert.deepEqual(
    [...manifest.allowedPaths].sort(),
    [
      '.buklod/scopes/nov13-conso-inventory-hold-20261113.json',
      'docs/nov13-consolidated-ota-preparation.md',
      'release/nov13-consolidated-ota-preparation.json',
      'tests/nov13-consolidated-ota-hold.test.mjs'
    ].sort()
  );
  assert.ok(manifest.allowedPaths.every(p => !/^(src\/|supabase\/|app\.config|eas\.json|\.github\/workflows\/)/.test(p)));
  assert.equal(manifest.releaseMode,'DOC_ONLY_HOLD_NO_OTA');
});
