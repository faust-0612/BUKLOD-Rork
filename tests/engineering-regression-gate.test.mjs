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


test('Ad startup and first-view native inventory require focused ads regression coverage', () => {
  const source = 'src/components/BuklodAdMobBanner.tsx';
  const without = assessChanges([source, 'tests/quiz-answers.test.mjs']);
  assert.ok(without.requiredAreas.includes('ads-monetization'));
  assert.match(without.failures.join(' '), /Missing focused regression test for ads-monetization/);
  const withCoverage = assessChanges([source, 'tests/buklod-ad-empty-slot-collapse.test.mjs']);
  assert.deepEqual(withCoverage.failures, []);
});


test('all runtime AdMob gate modules require ads-specific regression coverage', () => {
  const sources = [
    'src/lib/buklodGlobalAdController.ts',
    'src/lib/buklodAdViewport.ts',
    'src/lib/buklodAdUnits.ts',
    'src/lib/buklodAdMonetizationPolicy.ts',
    'src/lib/buklodAdOperationalTelemetry.ts',
    'src/lib/buklodAdDiagnostics.ts',
    'src/lib/buklodAds.ts',
    'src/lib/buklodAdPlacements.ts',
    'src/lib/buklodAdOpportunities.ts',
    'src/hooks/useBuklodCommunityAdViewability.ts',
  ];
  for (const source of sources) {
    const without = assessChanges([source, 'tests/quiz-answers.test.mjs']);
    assert.ok(without.requiredAreas.includes('ads-monetization'), source);
    assert.match(without.failures.join(' '), /Missing focused regression test for ads-monetization/, source);
    const withCoverage = assessChanges([source, 'tests/buklod-ad-request-gate-recovery.test.mjs']);
    assert.deepEqual(withCoverage.failures, [], source);
  }
});

test('Android and shared native/web ad renderers are covered by the ads risk classifier', () => {
  const sources = [
    'src/components/BuklodCommunityInlineAd.android.tsx',
    'src/components/BuklodCommunityInlineAd.tsx',
    'src/components/BuklodFirstViewAd.android.tsx',
    'src/components/BuklodScopedHeaderBanner.tsx',
    'src/components/BuklodVideoCompanionAd.tsx',
  ];
  for (const source of sources) {
    const changed = source.includes('BuklodVideoCompanionAd')
      ? [source, 'tests/buklod-ad-empty-slot-collapse.test.mjs', 'tests/buklod-wall-ad-stability.test.mjs']
      : [source, 'tests/buklod-ad-empty-slot-collapse.test.mjs'];
    const result = assessChanges(changed);
    assert.ok(result.requiredAreas.includes('ads-monetization'), source);
    if (source.includes('BuklodVideoCompanionAd')) {
      assert.ok(result.requiredAreas.includes('wall-media'), source);
    }
    assert.deepEqual(result.failures, [], source);
  }
});

test('scope allowlist rejects changed product or test paths omitted from the manifest', () => {
  const paths = [
    '.buklod/scopes/new.json',
    'src/components/BuklodCachedMediaImage.tsx',
    'tests/community-wall-behavior.test.mjs',
    'src/lib/buklodGlobalAdController.ts',
  ];
  const manifest = {
    ...goodManifest,
    allowedPaths: [
      'src/components/BuklodCachedMediaImage.tsx',
      'tests/community-wall-behavior.test.mjs',
    ],
  };
  assert.match(
    assessChanges(paths, manifest).failures.join(' '),
    /outside the declared scope allowlist: src\/lib\/buklodGlobalAdController\.ts/,
  );
  assert.deepEqual(
    assessChanges(paths.slice(0, 3), manifest).failures,
    [],
  );
});

test('cumulative RC permits only the exact named component scope set with complete allowlist', () => {
  const rc = '.buklod/scopes/nov11-consolidated-rc.json';
  const component = '.buklod/scopes/wall-media.json';
  const source = 'src/components/BuklodCachedMediaImage.tsx';
  const proof = 'tests/community-wall-behavior.test.mjs';
  const paths = [rc, component, source, proof];
  const manifest = {
    ...goodManifest,
    releaseMode: 'consolidated-main-rc',
    scopeManifestPath: rc,
    componentScopePaths: [component],
    allowedPaths: paths,
  };
  assert.deepEqual(assessChanges(paths, manifest, { consolidatedRc: true }).failures, []);
  assert.match(assessChanges(paths, manifest).failures.join(' '), /Only one new scope manifest/);
  assert.match(
    assessChanges([...paths, '.buklod/scopes/secret-extra.json'], manifest, { consolidatedRc: true }).failures.join(' '),
    /enumerate every changed component scope/,
  );
  assert.match(
    assessChanges([...paths, 'src/lib/buklodGlobalAdController.ts'], manifest, { consolidatedRc: true }).failures.join(' '),
    /outside the declared scope allowlist/,
  );
});

test('cumulative RC fails closed if own cumulative manifest is not explicitly declared', () => {
  const paths = ['.buklod/scopes/nov11-consolidated-rc.json', '.buklod/scopes/item.json', 'tests/community-wall-behavior.test.mjs'];
  const manifest = {
    ...goodManifest,
    releaseMode: 'consolidated-main-rc',
    scopeManifestPath: '.buklod/scopes/nov11-consolidated-rc.json',
    componentScopePaths: ['.buklod/scopes/item.json'],
    allowedPaths: paths.filter(p => !p.includes('nov11-consolidated-rc.json')),
  };
  assert.ok(
    assessChanges(paths, manifest, { consolidatedRc: true }).failures.join(' ')
      .includes('outside the declared scope allowlist: .buklod/scopes/nov11'),
  );
});


test('new post-production RC remains an exact named cumulative scope with strict allowlist', () => {
 const path='.buklod/scopes/nov11-postprod-single-rc.json';
 const parts=['.buklod/scopes/buklod-today-public-dugtong-inactivity-20261111.json',
  '.buklod/scopes/kingdom-cinematic-audio-20261111.json',
  ];
 const proof='tests/kingdom-cinematic-ui-audio-20261111.test.mjs';
 const files=[path,...parts,'src/features/games/runtime/rorkAudio.ts',proof];
 const manifest={...goodManifest,releaseMode:'consolidated-main-rc',
  scopeManifestPath:path,componentScopePaths:parts,allowedPaths:files,
  regressionTests:[proof],riskAreas:[]};
 assert.deepEqual(assessChanges(files,manifest,{consolidatedRc:true}).failures,[]);
 assert.match(assessChanges(files,manifest).failures.join(' '),/Only one new scope manifest/);
 assert.match(assessChanges([...files,'src/lib/buklodGlobalAdController.ts'],manifest,{consolidatedRc:true}).failures.join(' '),/outside the declared scope allowlist/);
});
