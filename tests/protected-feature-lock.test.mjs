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

test('Connect staging-only latest-activity scope enforces notification, chat and governance locks', () => {
  const scope = JSON.parse(readFileSync(new URL('../.buklod/scopes/connect-inbox-staging-20261123.json', import.meta.url), 'utf8'));
  const paths = [
    'src/app/(tabs)/messages.tsx',
    'src/components/BuklodConnectThread.tsx',
    'src/providers/NotificationProvider.tsx',
    'src/lib/connectInboxActivity.ts',
    'src/lib/connectInboxSignal.ts',
    'src/lib/connectInboxSearch.ts',
    '__tests__/connectInboxSearch.test.ts',
    'src/hooks/useBuklodConnectUnread.ts',
    '__tests__/connectInboxActivity.test.ts',
    '__tests__/connectInboxSignal.test.ts',
    'tests/connect-inbox-realtime-staging-20261123.test.mjs',
    'tests/connect-inbox-notification-navigation-20261123.test.mjs',
    'tests/connect-inbox-ads-guard-20261123.test.mjs',
    'tests/messenger-inbox-density-20261117.test.mjs',
    'tests/protected-feature-lock.test.mjs',
    '.github/workflows/engineering-accountability.yml',
    '.buklod/scopes/connect-inbox-staging-20261123.json',
  ];
  const result = assessProtectedFeatureLock(paths.map(path => ({ status: 'M', path })), scope);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.impacted, ['app-runtime', 'navigation-auth', 'connect-ptt-calls', 'ads-finance-points', 'governance-lock']);
  assert.equal(scope.publicationStatus, 'DEV_ONLY_STAGING_RC_PENDING');
  const workflow = readFileSync(new URL('../.github/workflows/engineering-accountability.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('dev/connect-inbox-latest-activity-20261123'));
  assert.ok(workflow.includes('BUKLOD_SCOPE_MANIFEST=.buklod/scopes/connect-inbox-staging-20261123.json'));
});


test('November 25 consolidated source candidate retains exact scope and explicit release isolation', () => {
  const scope = JSON.parse(readFileSync(new URL('../.buklod/scopes/main-conso-backlog-20261125.json', import.meta.url), 'utf8'));
  assert.equal(scope.releaseMode, 'consolidated-main-rc');
  assert.equal(scope.publicationStatus, 'DEV_ONLY_NO_PUBLISH');
  const paths = scope.allowedPaths;
  assert.deepEqual(scope.componentScopePaths.slice().sort(), paths.filter(p => p.startsWith('.buklod/scopes/') && p !== scope.scopeManifestPath).sort());
  // Only the separately tested, additive KL backend sources may enter this
  // source-only candidate. This is NOT permission to apply or deploy them.
  const klBackend = [
    'supabase/functions/kl-dictionary-worker/index.ts',
    'supabase/migrations/20261126080000_kl_series_and_dictionary_v1.sql',
    'supabase/migrations/20261126080001_kl_dictionary_scheduler_v1.sql',
    'supabase/tests/kl_series_dictionary_contract.sql',
  ].sort();
  assert.deepEqual(paths.filter(p => p.startsWith('supabase/')).sort(), klBackend);
  assert.ok(paths.every(p => !/^(?:android\/|ios\/|modules\/|plugins\/|app\.config\.|eas\.json$|package(?:-lock)?\.json$)/.test(p)));
  const backendLock = scope.lockedFeatureChanges.find(group => group.id === 'backend-security');
  assert.ok(backendLock);
  assert.ok(backendLock.tests.includes('supabase/tests/kl_series_dictionary_contract.sql'));
  assert.ok(scope.regressionTests.includes('supabase/tests/kl_series_dictionary_contract.sql'));
  assert.ok(scope.preserveBehaviors.some(text => /no publishing or backend mutation/i.test(text)));
  assert.ok(scope.acceptanceChecks.some(text => /no deployment or production merge/i.test(text)));
  // A foreign migration must fail even with valid existing backend evidence.
  const unauthorized = [...paths, 'supabase/migrations/unauthorized.sql'];
  assert.ok(assessProtectedFeatureLock(unauthorized.map(path=>({status:'M',path})),scope).failures.some(message=>message.includes('outside work scope')));
  const missingProof = {...scope,lockedFeatureChanges:scope.lockedFeatureChanges.filter(group=>group.id!=='backend-security')};
  assert.ok(assessProtectedFeatureLock(paths.map(path=>({status:'M',path})),missingProof).failures.includes('Undeclared protected feature change: backend-security'));
  assert.deepEqual(assessProtectedFeatureLock(paths.map(path=>({status:'M',path})),scope).failures, []);
  const flow=readFileSync(new URL('../.github/workflows/engineering-accountability.yml',import.meta.url),'utf8');
  assert.match(flow,/integration\/main-conso-backlog-20261125\)[\s\S]*?if \[ "\$PR_BASE" = "main" \]; then[\s\S]*?BUKLOD_CONSOLIDATED_RC_GATE=true/);
  const gate=readFileSync(new URL('../scripts/engineering-regression-gate.mjs',import.meta.url),'utf8');
  assert.ok(gate.includes("'integration/main-conso-backlog-20261125'].includes(process.env.GITHUB_HEAD_REF)"));
});
