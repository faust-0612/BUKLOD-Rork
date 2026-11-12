import test from 'node:test';
import assert from 'node:assert/strict';
import { assessProtectedFeatureLock, parseNameStatusZ } from '../scripts/protected-feature-lock.mjs';

const p = 'src/components/BuklodCachedMediaImage.tsx';
const t = 'tests/community-wall-no-blank-photo.test.cjs';
const changed = (...paths) => paths.map(path => ({ status: 'M', path }));
const statement = id => ({ id, reason: 'Targeted change to the protected module with review', preservedBehaviors: ['Existing user-facing behavior stays unchanged'], tests: [t] });
const valid = {
  contractVersion: 2,
  lockedFeatureChanges: [statement('app-runtime'), statement('wall-media')],
  regressionTests: [t], allowedPaths: [p, t],
};

test('a documented-only change is not blocked', () => {
  assert.deepEqual(assessProtectedFeatureLock(changed('README.md'), null).failures, []);
});
test('an unscoped change to an operating feature fails closed', () => {
  const r = assessProtectedFeatureLock(changed(p, t), null);
  assert.match(r.failures.join('\n'), /lockedFeatureChanges/);
  assert.deepEqual(r.impacted, ['app-runtime', 'wall-media']);
});
test('exactly declared media change with a changed test passes', () => {
  assert.deepEqual(assessProtectedFeatureLock(changed(p, t), valid).failures, []);
});
test('a test not changed in the PR cannot be used as proof', () => {
  assert.match(assessProtectedFeatureLock(changed(p), valid).failures.join(' '), /Test not changed/);
});
test('unrelated test does not satisfy a video or photo regression', () => {
  const proof = 'tests/quiz-answers.test.mjs';
  const manifest = { ...valid, regressionTests: [proof], allowedPaths: [p, proof], lockedFeatureChanges: [
    { ...statement('app-runtime'), tests: [proof] }, { ...statement('wall-media'), tests: [proof] },
  ] };
  assert.match(assessProtectedFeatureLock(changed(p, proof), manifest).failures.join(' '), /feature-specific/);
});
test('new unrelated path fails exact work-scope allowlist', () => {
  const r = assessProtectedFeatureLock(changed(p, t, 'src/lib/unrelated.ts'), valid);
  assert.match(r.failures.join(' '), /outside work scope/);
});
test('protected regression test cannot be deleted even with a declared change', () => {
  const r = assessProtectedFeatureLock([{ status: 'D', path: t }, { status: 'M', path: p }], valid);
  assert.match(r.failures.join(' '), /cannot be deleted/);
});
test('backend security changes require dedicated database/security proof', () => {
  const sql = 'supabase/migrations/20261112_secure.sql';
  const proof = 'supabase/tests/secure_rls.sql';
  const m = { ...valid, allowedPaths: [sql, proof], regressionTests: [proof], lockedFeatureChanges: [
    { ...statement('app-runtime'), tests: [proof] },
    { ...statement('backend-security'), tests: [proof] },
  ] };
  assert.deepEqual(assessProtectedFeatureLock(changed(sql, proof), m).failures, []);
  assert.match(assessProtectedFeatureLock(changed(sql), m).failures.join(' '), /Test not changed/);
});
test('editing CI protection itself requires governance evidence', () => {
  const source = 'scripts/protected-feature-lock.mjs';
  const proof = 'tests/protected-feature-lock.test.mjs';
  const m = { ...valid, allowedPaths: [source, proof], regressionTests: [proof], lockedFeatureChanges: [
    { ...statement('governance-lock'), tests: [proof] },
  ] };
  assert.deepEqual(assessProtectedFeatureLock(changed(source, proof), m).failures, []);
  assert.match(assessProtectedFeatureLock(changed(source, proof), valid).failures.join(' '), /Undeclared protected feature/);
});
test('duplicate declarations and false area claims cannot pass', () => {
  const m = { ...valid, lockedFeatureChanges: [...valid.lockedFeatureChanges, statement('wall-media'), statement('navigation-auth')] };
  const errs = assessProtectedFeatureLock(changed(p, t), m).failures.join(' ');
  assert.match(errs, /Duplicate/);
  assert.match(errs, /Unexpected/);
});
test('git rename records include both old and new paths for change-impact review', () => {
  assert.deepEqual(parseNameStatusZ('R100\0src/a.ts\0src/b.ts\0M\0tests/media.test.mjs\0'), [
    { status: 'R100', path: 'src/a.ts' }, { status: 'R100', path: 'src/b.ts' }, { status: 'M', path: 'tests/media.test.mjs' },
  ]);
});
test('malformed git change records fail safely', () => {
  assert.throws(() => parseNameStatusZ('R100\0src/a.ts\0'), /Incomplete/);
  assert.match(assessProtectedFeatureLock([{ status: 'M', path: '../escape.ts' }], valid).failures.join(' '), /Invalid changed/);
});
