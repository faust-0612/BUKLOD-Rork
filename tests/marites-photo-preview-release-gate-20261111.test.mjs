import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml', 'utf8');

test('named Marites hotfix may compile using guarded RC job only', () => {
  assert.ok(workflow.includes("github.head_ref == 'fix/marites-photo-preview-resign-20261111'"));
  assert.ok(workflow.includes("github.event.pull_request.head.repo.full_name == github.repository"));
  assert.ok(workflow.includes("github.event.pull_request.head.sha"));
  assert.ok(workflow.includes('APP_VARIANT: production'));
  assert.ok(workflow.includes('Verify production EAS public build environment without publishing'));
});

test('compiled release job preserves runtime/export and verified SHA checks', () => {
  assert.ok(workflow.includes("test \"${git rev-parse HEAD}\"") === false); // SHA checked using proper GitHub job expression
  assert.ok(workflow.includes('test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha }}"'));
  assert.ok(workflow.includes('RC_COMPILED_SHA=%s'));
  assert.ok(workflow.includes('npx expo export --platform android'));
  assert.ok(workflow.includes('npx expo export --platform web'));
  assert.ok(workflow.includes("node scripts/verify-production-ads-env.cjs"));
});

test('Marites photo test runs on this branch before artifact compilation', () => {
  assert.ok(workflow.indexOf('Marites signed-photo preview and release scope regression') < workflow.indexOf('Compile V28-compatible Android OTA bundle'));
  assert.ok(workflow.includes('tests/marites-photo-preview-resign-20261111.test.mjs'));
});
