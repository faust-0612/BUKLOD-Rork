import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessChanges } from '../scripts/engineering-regression-gate.mjs';

const read = path => readFileSync(path, 'utf8');
const manifestPath = '.buklod/scopes/release-universal-guardrails-20261111.json';
const source = 'scripts/PUSH_MAIN_OTA.ps1';
const proof = 'tests/release-scope-guardrails-20261111.test.mjs';
const manifest = {
  contractVersion: 2,
  objective: 'Lock BUKLOD release change scope',
  baseRef: 'verified-sha',
  productionBaselineEvidence: 'Main Git SHA only; live OTA fingerprint unverified',
  chosenApproach: 'Fail-closed exact path allowlist',
  selectionRationale: 'Prevent unrelated module edits',
  acceptanceChecks: ['Scope validated'],
  preserveBehaviors: ['Existing product unchanged'],
  alternativeApproaches: ['Manual reviews', 'Automated PR scope'],
  riskAreas: ['release-identity'],
  regressionTests: [proof],
  allowedPaths: [source, proof, manifestPath],
};

test('CI requires an explicit new scope for any product or workflow change, even with a test', () => {
  for (const p of [
    'src/app/(tabs)/buklod.tsx', 'assets/sounds/test.wav',
    'supabase/migrations/20261111_guard.sql', 'scripts/unrelated-helper.mjs',
    '.github/workflows/engineering-accountability.yml',
    'package.json', 'package-lock.json', 'app.config.js', 'eas.json'
  ]) {
    const errors = assessChanges([p, proof], null, { requireScope: true }).failures.join(' ');
    assert.match(errors, /require a new .*scope/i, p);
  }
});

test('changing regression tests alone cannot bypass an explicit scope', () => {
  assert.match(
    assessChanges([proof], null, { requireScope: true }).failures.join(' '),
    /require a new .*scope/i
  );
});

test('declared release-only scope permits exact expected paths but blocks an unrelated feature', () => {
  assert.deepEqual(assessChanges([source, proof, manifestPath], manifest, { requireScope: true }).failures, []);
  const blocked = assessChanges([source, proof, manifestPath, 'src/app/(tabs)/buklod.tsx'], manifest, { requireScope: true });
  assert.match(blocked.failures.join(' '), /outside the declared scope allowlist: src\/app/);
});

test('CLI always enables strict scope enforcement and detects no-manifest escape', () => {
  const sourceText = read('scripts/engineering-regression-gate.mjs');
  assert.match(sourceText, /requireScope: true/);
  assert.match(sourceText, /if \(requireScope && \(modifiedProduct\.length \|\| modifiedTests\.length\)/);
});

test('both production publish workflows reject manual dispatch and retain exact main source checks', () => {
  for (const p of ['.github/workflows/production_android_ota.yml', '.github/workflows/production_web_deploy.yml']) {
    const yml = read(p);
    assert.doesNotMatch(yml, /^\s*workflow_dispatch:/m, p);
    assert.match(yml, /github\.event_name == 'push'/, p);
    assert.match(yml, /BUKLOD_CONSOLIDATED_PROD_20261108/, p);
    assert.match(yml, /github\.sha/, p);
    assert.match(yml, /git ls-remote origin refs\/heads\/main/, p);
  }
  const android = read('.github/workflows/production_android_ota.yml');
  assert.match(android, /android-ota-rc\.cjs freeze/);
  assert.match(android, /--input-dir rc --skip-bundler/);
  assert.match(android, /android-ota-rc\.cjs published/);
});

test('legacy PowerShell OTA can never invoke EAS publish directly', () => {
  const script = read('scripts/PUSH_MAIN_OTA.ps1');
  assert.match(script, /DIRECT OTA BLOCKED/);
  assert.match(script, /throw /);
  assert.doesNotMatch(script, /^\s*(?:npx|eas|expo)\s+(?:eas\s+)?update\b/m);
});
