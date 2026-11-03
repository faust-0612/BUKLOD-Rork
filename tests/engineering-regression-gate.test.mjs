import test from 'node:test';
import assert from 'node:assert/strict';
import { assessChanges } from '../scripts/engineering-regression-gate.mjs';

const goodManifest = {
  contractVersion: 2, objective: 'Prevent regressions', baseRef: 'abc123',
  productionBaselineEvidence: 'Baseline unverified; do not deploy',
  chosenApproach: 'Focused PR gate', selectionRationale: 'Fewer runner credits',
  acceptanceChecks: ['Fail closed on missing tests'], preserveBehaviors: ['No production OTA'],
  alternativeApproaches: ['Heavy full CI', 'Focused selective gate'],
  riskAreas: ['wall-media'], regressionTests: ['tests/community-wall-behavior.test.mjs'],
  allowedPaths: ['src/components/BuklodCachedMediaImage.tsx', 'tests/community-wall-behavior.test.mjs'],
};
test('documentation-only edits do not require costly app builds', () => {
  assert.deepEqual(assessChanges(['AGENTS.md']).failures, []);
});
test('image rendering change without a test is blocked', () => {
  const errors = assessChanges(['src/components/BuklodCachedMediaImage.tsx']).failures;
  assert.match(errors.join(' '), /without an accompanying regression test/);
  assert.match(errors.join(' '), /wall-media/);
});
test('an unrelated test does not satisfy media coverage', () => {
  const errors = assessChanges(['src/components/BuklodCachedMediaImage.tsx', 'tests/quiz-answers.test.mjs']).failures;
  assert.match(errors.join(' '), /wall-media/);
});
test('matching runnable tests satisfy a focused media edit', () => {
  assert.deepEqual(assessChanges(['src/components/BuklodCachedMediaImage.tsx', 'tests/community-wall-behavior.test.mjs']).failures, []);
});
test('multiple risk areas require separate appropriate coverage', () => {
  const errors = assessChanges(['src/components/BuklodCachedMediaImage.tsx', 'src/providers/AuthProvider.tsx', 'tests/community-wall-behavior.test.mjs']).failures;
  assert.match(errors.join(' '), /auth-privacy/);
});
test('SQL changes need database regression tests, not only a source text test', () => {
  const errors = assessChanges(['supabase/migrations/20261030_new.sql', 'tests/new-sql.test.cjs']).failures;
  assert.match(errors.join(' '), /supabase\/tests/);
  assert.deepEqual(assessChanges(['supabase/migrations/20261030_new.sql', 'supabase/tests/migration_security.sql']).failures, []);
});
test('release pipeline changes need focused release contract tests', () => {
  assert.match(assessChanges(['.github/workflows/production_android_ota.yml', 'tests/wall-photo.test.mjs']).failures.join(' '), /release-identity/);
  assert.deepEqual(assessChanges(['.github/workflows/production_android_ota.yml', 'tests/android-ota-release.test.mjs']).failures, []);
});
test('new scope manifest must declare choice, protected behaviors and changed tests', () => {
  const paths = ['.buklod/scopes/new.json', 'src/components/BuklodCachedMediaImage.tsx', 'tests/community-wall-behavior.test.mjs'];
  assert.deepEqual(assessChanges(paths, goodManifest).failures, []);
  assert.match(assessChanges(paths, { ...goodManifest, alternativeApproaches: [] }).failures.join(' '), /alternativeApproaches/);
  assert.match(assessChanges(paths, { ...goodManifest, regressionTests: ['tests/unchanged.test.mjs'] }).failures.join(' '), /not changed/);
  assert.match(assessChanges(paths, { ...goodManifest, riskAreas: ['auth-privacy'] }).failures.join(' '), /wall-media/);
});
test('unsafe declared test paths are rejected', () => {
  const paths = ['.buklod/scopes/new.json', 'tests/community-wall-behavior.test.mjs'];
  assert.match(assessChanges(paths, { ...goodManifest, regressionTests: ['../tests/malicious.test.mjs'] }).failures.join(' '), /Invalid declared/);
});

test('photo Upgrade libraries are Wall media, not classroom Grade code', () => {
  const paths = ['src/lib/communityWallSharpUpgrade.ts', 'tests/android-wall-auto-sharp.test.mjs'];
  const result = assessChanges(paths);
  assert.deepEqual(result.requiredAreas, ['wall-media']);
  assert.deepEqual(result.failures, []);
});

test('real grades and attendance still require Classroom/Quiz coverage', () => {
  const without = assessChanges(['src/lib/gradebook.ts', 'tests/wall-photo.test.mjs']);
  assert.ok(without.requiredAreas.includes('classroom-quiz'));
  assert.match(without.failures.join(' '), /classroom-quiz/);
  const withCoverage = assessChanges(['src/lib/gradebook.ts', 'tests/student-grades.test.mjs']);
  assert.deepEqual(withCoverage.requiredAreas, ['classroom-quiz']);
  assert.deepEqual(withCoverage.failures, []);
});


test('Ad startup and empty-slot behavior require focused ads regression coverage', () => {
  const source = 'src/components/BuklodAdMobBanner.tsx';
  const without = assessChanges([source, 'tests/quiz-answers.test.mjs']);
  assert.ok(without.requiredAreas.includes('ads-monetization'));
  assert.match(without.failures.join(' '), /Missing focused regression test for ads-monetization/);
  const withCoverage = assessChanges([source, 'tests/buklod-ad-empty-slot-collapse.test.mjs']);
  assert.deepEqual(withCoverage.failures, []);
});
