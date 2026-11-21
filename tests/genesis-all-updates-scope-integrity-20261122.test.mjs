import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessChanges } from '../scripts/engineering-regression-gate.mjs';

const manifest = JSON.parse(fs.readFileSync('.buklod/scopes/genesis-all-updates-conso-20261122.json','utf8'));

test('staging-only cumulative source has an exact enumerated component scope and valid V2 provenance', () => {
  assert.equal(manifest.contractVersion,2);
  assert.equal(manifest.releaseMode,'consolidated-staging-source-hold');
  assert.equal(manifest.releaseStatus,'DEV_SOURCE_ONLY_NEW_SIGNED_SOS_APK_AND_ISOLATED_BACKEND_REQUIRED');
  assert.equal(manifest.componentScopePaths.length,7);
  assert.deepEqual(manifest.componentScopePaths,[...manifest.componentScopePaths].sort());
  for (const path of manifest.componentScopePaths) {
    assert.equal(JSON.parse(fs.readFileSync(path,'utf8')).contractVersion,2,path);
  }
  assert.ok(manifest.allowedPaths.includes('scripts/engineering-regression-gate.mjs'));
  assert.ok(manifest.regressionTests.includes('tests/genesis-all-updates-scope-integrity-20261122.test.mjs'));
});

test('source-only staging scope cannot skip the separate signed SOS native and isolated database gates', () => {
  const release = JSON.parse(fs.readFileSync('.buklod/releases/genesis-all-updates-conso-20261122.json','utf8'));
  assert.equal(release.releaseSafety.doNotPublishToExistingRuntime,true);
  assert.equal(release.releaseSafety.newSignedStagingApkRequired,true);
  assert.equal(release.releaseSafety.isolatedSupabaseStagingRequiredForSOSAndEstate,true);
  assert.equal(release.releaseSafety.season2ProductionApkAabOtaProhibited,true);
  const source = fs.readFileSync('scripts/engineering-regression-gate.mjs','utf8');
  assert.match(source,/process\.env\.BUKLOD_CONSOLIDATED_STAGING_SCOPE_GATE === 'true'/);
  assert.match(source,/base === 'integration\/season2-genesis-full-conso-staging-20261121'/);
  assert.match(source,/process\.env\.GITHUB_HEAD_REF === 'integration\/genesis-all-updates-conso-staging-20261122'/);
  assert.match(source,/const cumulativeRc = cumulativeMainRc \|\| stagingSourceHold/);
  assert.match(source,/manifest\?\.releaseStatus !== 'DEV_SOURCE_ONLY_NEW_SIGNED_SOS_APK_AND_ISOLATED_BACKEND_REQUIRED'/);
});

test('manifest fails closed on untracked component path, missing source proof and missing release-risk coverage', () => {
  const minimal = [manifest.scopeManifestPath,...manifest.componentScopePaths,
    'src/components/BuklodMaritesBoard.tsx','app.config.js',
    'tests/todays-best-wall-header-20261120.test.mjs',
    'tests/sos-urgent-release-20261121.test.mjs',
    'tests/genesis-all-updates-scope-integrity-20261122.test.mjs'];
  assert.deepEqual(assessChanges(minimal,manifest,{consolidatedRc:true,requireScope:true}).failures,[]);
  assert.match(assessChanges([...minimal,'src/lib/unknown-unreviewed-secrets.ts'],manifest,{consolidatedRc:true,requireScope:true}).failures.join(' '),/outside the declared scope allowlist/);
  const bad={...manifest,componentScopePaths:[]};
  assert.match(assessChanges(minimal,bad,{consolidatedRc:true,requireScope:true}).failures.join(' '),/enumerate every changed component scope/);
  const missingRisk={...manifest,riskAreas:[]};
  assert.match(assessChanges(minimal,missingRisk,{consolidatedRc:true,requireScope:true}).failures.join(' '),/nonempty riskAreas|omits impacted area/);
});

test('isolated per-feature PRs continue rejecting multi-manifest changes', () => {
 const paths=['.buklod/scopes/one.json','.buklod/scopes/two.json','src/app/games/empire-arena.tsx','tests/arena-kingdom-game-premium-20261121.test.mjs'];
 assert.match(assessChanges(paths,manifest,{consolidatedRc:false,requireScope:true}).failures.join(' '),/Only one new scope manifest/);
});
