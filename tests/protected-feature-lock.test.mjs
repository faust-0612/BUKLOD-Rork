import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('Android-only production promotion is tied to an explicit RC scope, never a global bypass', () => {
  const workflow=readFileSync(new URL('../.github/workflows/engineering-accountability.yml',import.meta.url),'utf8');
  assert.ok(workflow.includes('release/buklod-prod-rc-staging-20261114)'));
  assert.ok(workflow.includes('BUKLOD_SCOPE_MANIFEST=.buklod/scopes/nov14-prod-android-rc-promotion.json'));
  assert.match(workflow,/node scripts\/protected-feature-lock\.mjs/);
  const release=readFileSync(new URL('../.github/workflows/production_android_ota.yml',import.meta.url),'utf8');
  assert.match(release,/BUKLOD_ANDROID_ONLY_PROD_20261114:/);
});


test('the consolidated Nov16 RC cannot omit finance, database or governance protections', () => {
  const scope=JSON.parse(readFileSync(new URL('../.buklod/scopes/nov16-all-recent-wall-character-ads-rc.json',import.meta.url),'utf8'));
  const ids=new Set(scope.lockedFeatureChanges.map(x=>x.id));
  for (const id of ['ads-finance-points','backend-security','governance-lock','kingdom-character','wall-media']) assert.ok(ids.has(id),id);
  assert.ok(scope.regressionTests.includes('tests/protected-feature-lock.test.mjs'));
  const flow=readFileSync(new URL('../.github/workflows/engineering-accountability.yml',import.meta.url),'utf8');
  assert.ok(flow.includes('integration/nov16-current-wall-ads-zoom-rc-safe)'));
});

test('Nov17 Wall header navigation correction is isolated and has governance proof', () => {
  const scope = JSON.parse(readFileSync(new URL('../.buklod/scopes/nov17-wall-header-actions-compact.json', import.meta.url), 'utf8'));
  const touched = [
    'src/app/(tabs)/buklod.tsx',
    'scripts/compact-layout-gate.mjs',
    '.github/workflows/engineering-accountability.yml',
    'tests/wall-header-navigation-20261117.test.mjs',
    'tests/protected-feature-lock.test.mjs',
    '.buklod/scopes/nov17-wall-header-actions-compact.json',
  ];
  const entries = touched.map(path => ({ status: 'M', path }));
  const evaluated = assessProtectedFeatureLock(entries, scope);
  assert.deepEqual(evaluated.failures, []);
  assert.deepEqual(evaluated.impacted, ['app-runtime', 'navigation-auth', 'governance-lock']);
  assert.equal(scope.baseRef, 'main');
  assert.equal(scope.publicationStatus, 'DEV_ONLY_NO_OTA');
});

test('Nov17 quiet connection feedback has exact protected scope',()=>{
 const scope=JSON.parse(readFileSync(new URL('../.buklod/scopes/nov17-connection-feedback.json',import.meta.url),'utf8'));
 const paths=["src/app/(tabs)/buklod.tsx","src/lib/buklodUserFeedback.ts",".github/workflows/engineering-accountability.yml","tests/protected-feature-lock.test.mjs","tests/wall-network-feedback-20261117.test.mjs",".buklod/scopes/nov17-connection-feedback.json","tests/wall-network-navigation-20261117.test.mjs"];
 const result=assessProtectedFeatureLock(paths.map(path=>({status:'M',path})),scope);
 assert.deepEqual(result.failures,[]);
 assert.deepEqual(result.impacted,['app-runtime','navigation-auth','governance-lock']);
 assert.equal(scope.publicationStatus,'DEV_ONLY_NO_OTA');
});

test('Season2 consolidation declares every impacted feature and exact protected scope',()=>{
 const s=JSON.parse(readFileSync(new URL('../.buklod/scopes/season2-conso-staging-20261119.json',import.meta.url),'utf8'));
 const paths=[
   '.github/workflows/engineering-accountability.yml',
   '.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml',
   'src/app/admin/season2-readiness.tsx',
   'src/app/(tabs)/buklod.tsx',
   'src/components/BuklodCommunityWallProfileBubbles.tsx',
   'src/components/BuklodCommunityConnectHeader.web.tsx',
   'src/components/BuklodConnectThread.tsx',
   'src/components/connect/ConnectMessageBubble.tsx',
   'src/lib/connectChatWindow.ts',
   'tests/connect-latest-keyboard-follow-20261119.test.mjs',
   'tests/connect-compact-seen-all-rooms-20261119.test.mjs',
   'tests/season2-wall-avatar-navigation-20261119.test.mjs',
   'tests/life-language-auth-navigation-20261119.test.mjs',
   'tests/season2-avatar-admob-guard-20261119.test.mjs',
   'tests/buklod-season2-carryover-contract-20261119.test.mjs',
   'tests/buklod-season2-isolated-reward-priority-r1-20261118.test.mjs',
   'tests/season2-governance-production-release-gate.test.mjs',
   'tests/protected-feature-lock.test.mjs'
 ];
 const r=assessProtectedFeatureLock(paths.map(path=>({status:'M',path})),s);
 assert.deepEqual(r.failures,[]);
 assert.deepEqual(r.impacted,['app-runtime','wall-media','navigation-auth','connect-ptt-calls','ads-finance-points','production-release','governance-lock']);
 assert.equal(s.releaseTarget,'STAGING_ONLY');
 assert.equal(s.productionChange,false);
});
