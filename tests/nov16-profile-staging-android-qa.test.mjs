import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const workflow = read('.github/workflows/navigation-v2-staging-compile-qa.yml');
const scope = JSON.parse(read('.buklod/scopes/profile-hero-compact-20261116.json'));

test('Staging Android compile accepts only original approved nav2 plus Profile candidate', () => {
  assert.match(workflow, /github\.head_ref == 'dev\/nav2-wall-stability-integration-20261113'/);
  assert.match(workflow, /github\.head_ref == 'codex\/profile-hero-compact-20261116'/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  for (const proof of ['APP_VARIANT: staging', 'EXPO_PUBLIC_APP_ENV: staging',
    "org.mzbministry.buklod.staging", "'1.3.2'", "'staging-user'", "'preview'"]) {
    assert.ok(workflow.includes(proof), 'Missing staging compatibility assertion: ' + proof);
  }
  assert.match(workflow, /npx expo export --platform android/);
  // Original Navigation V2 full suite is preserved on its original branch.
  assert.match(workflow, /Run combined navigation, Comment, GIF, Wall and APK regressions\n        if: github.head_ref == 'dev\/nav2-wall-stability-integration-20261113'/);
  assert.ok(workflow.includes("if: github.head_ref == 'codex/profile-hero-compact-20261116'"));
  assert.ok(workflow.includes('npx tsc --noEmit'));

  assert.doesNotMatch(workflow, /eas-cli@[^\n]*update|npx eas update --channel|channel: production/);
});

test('Profile exact-source Android QA exercises identity, ads and dashboard navigation', () => {
  for (const file of [
    'tests/nov16-profile-hero-compact.test.mjs',
    'tests/nov16-profile-navigation-actions.test.mjs',
    'tests/nov16-profile-staging-android-qa.test.mjs',
    'tests/production-ota-ads-regression.test.mjs',
    'tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs',
    'tests/buklod-shared-dashboard-scroll-20261111.test.mjs',
  ]) assert.ok(workflow.includes(file), 'Missing focused release proof: ' + file);
  assert.equal(scope.contractVersion, 2);
  assert.ok(scope.allowedPaths.includes('.github/workflows/navigation-v2-staging-compile-qa.yml'));
  assert.ok(scope.regressionTests.includes('tests/nov16-profile-staging-android-qa.test.mjs'));
});
