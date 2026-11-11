import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const contract = 'node --test tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs';
const releaseContract = 'node --test tests/buklod-ads-production-release-contract-20261111.test.mjs';

test('Every PR must run both app-wide ad behavior and production release lock checks', () => {
  const workflow = read('.github/workflows/engineering-accountability.yml');
  for (const command of [contract, releaseContract]) assert.ok(workflow.includes(command), command);
  assert.ok(workflow.includes('on:\n  pull_request:'), 'PR trigger must remain enabled');
});

test('Compiled RC checks ads before emitting any Android or web artifact', () => {
  const workflow = read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
  const policyIndex = workflow.indexOf(contract);
  const releaseIndex = workflow.indexOf(releaseContract);
  const reelsIndex = workflow.indexOf('Native Reels and fullscreen video ads regression');
  assert.ok(policyIndex > 0 && releaseIndex > policyIndex && reelsIndex > releaseIndex);
  assert.ok(workflow.includes('TypeScript'), 'RC compilation contract must survive');
});

test('Production Android OTA blocks publication if either ad-lock test fails', () => {
  const workflow = read('.github/workflows/production_android_ota.yml');
  const ts = workflow.indexOf('- name: TypeScript QA');
  const policy = workflow.indexOf(contract);
  const release = workflow.indexOf(releaseContract);
  const currentAdTests = workflow.indexOf('- name: AdMob startup, Reels feed');
  const freeze = workflow.indexOf('- name: Freeze verified RC');
  const publish = workflow.indexOf('- name: Publish exact frozen Android RC');
  assert.ok(ts >= 0 && policy > ts && release > policy);
  assert.ok(currentAdTests > release && freeze > currentAdTests && publish > freeze,
    'All ad tests must precede RC freezing and publishing');
  assert.ok(workflow.includes("startsWith(github.event.head_commit.message, 'BUKLOD_CONSOLIDATED_PROD_20261108')"),
    'Unrelated main pushes must not trigger OTA');
});

test('Release contract changes may not authorize automatic production publication', () => {
  const scope = JSON.parse(read('.buklod/scopes/ads-appwide-permanent-lock-20261111.json'));
  assert.ok(scope.preserveBehaviors.some(x => x.includes('No separate OTA')));
  assert.ok(scope.allowedPaths.every(x => !x.startsWith('supabase/migrations/')));
});

test('Exact final ad-lock DEV branch is authorized for compiled Android/Web RC QA (not publishing)', () => {
  const workflow = read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
  assert.ok(workflow.includes("github.head_ref == 'fix/buklod-ads-appwide-final-lock-20261111'"));
  assert.match(workflow, /npx expo export --platform android/);
  assert.match(workflow, /npx expo export --platform web/);
  assert.doesNotMatch(workflow, /eas-cli@latest update --channel production/);
});
