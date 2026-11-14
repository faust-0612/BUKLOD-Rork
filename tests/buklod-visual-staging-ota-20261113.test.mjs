import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const workflow = read('.github/workflows/buklod-visual-staging-ota-20261113.yml');
const manifest = JSON.parse(read('.buklod/scopes/full-visual-transformation-20261113.json'));
const visual = JSON.parse(read('release/visual/full-transformation-20261113.json'));

test('staging-only OTA is scoped to isolated authorized branch and draft PR', () => {
  assert.match(workflow,/branches: \[dev\/full-visual-transformation-20261113\]/);
  assert.match(workflow,/BUKLOD_OWNER_VISUAL_STAGING_OTA_20261113:/);
  assert.match(workflow,/pull_number:791/);
  assert.match(workflow,/pr\.draft/);
  assert.match(workflow,/pr\.head\.sha!==context\.sha/);
  assert.match(workflow,/Required|Mandatory exact-source CI failed/);
  assert.match(workflow,/Engineering Accountability/);
  assert.match(workflow,/Legacy Integration PR QA/);
});
test('signed staging APK and runtime, separate preview and production channels are required', () => {
  assert.match(workflow,/build:view bc4be208-bfb0-42f3-95cb-358353d0600f/);
  assert.match(workflow,/verifyBuild\(build\)/);
  assert.match(workflow,/verifyChannels\(/);
  assert.match(workflow,/--environment preview/);
  assert.match(workflow,/staging-user/);
  assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
  assert.match(workflow,/1\.3\.2/);
  assert.match(workflow,/git merge-base --is-ancestor/);
  assert.match(workflow,/git diff --exit-code/);
  for (const path of ['app.config.js','eas.json','package-lock.json','android/','ios/','plugins/','supabase/','src/providers/AuthProvider.tsx']) {
    assert.ok(workflow.includes(path), 'Native, auth, backend compatibility guard omitted: '+path);
  }
});
test('OTA is Android-only, once per exact head, and served staging manifest is verified', () => {
  const releases = workflow.match(/eas-cli@27\.9\.0 update --channel staging-user --platform android/g) ?? [];
  assert.equal(releases.length,1,'One bounded Android staging update command');
  assert.match(workflow,/--skip-bundler --input-dir/);
  assert.match(workflow,/BUKLOD_VISUAL_STAGING_QA_/);
  assert.match(workflow,/Duplicate source updates/);
  assert.match(workflow,/git ls-remote origin/);
  assert.match(workflow,/update:view/);
  assert.match(workflow,/stage\.id\.toLowerCase\(\),update\.id\.toLowerCase\(\)/);
  assert.match(workflow,/unchangedProductionManifestId/);
  assert.match(workflow,/prod\.id,pre\.productionManifestId/);
  assert.doesNotMatch(workflow,/eas-cli@27\.9\.0 (?:build(?!:view)|submit|deploy|channel:edit)/);
});
test('visual acceptance is not fabricated by staging QA publication', () => {
  assert.equal(visual.otaPublished,false,'Original evidence is prepipeline only');
  assert.equal(visual.implementationPercentage,0);
  assert.equal(visual.physicalInfinix,'SKIPPED BY OWNER');
  assert.ok(manifest.allowedPaths.includes('tests/buklod-visual-staging-ota-20261113.test.mjs'));
  assert.ok(manifest.regressionTests.includes('tests/buklod-visual-staging-ota-20261113.test.mjs'));
  assert.ok(manifest.lockedFeatureChanges.some(item=>item.id==='production-release'));
  assert.match(workflow,/authenticatedNativeVisualAcceptedScreens:0/);
  assert.match(workflow,/productionUpdated:false,mainUpdated:false,webDeployed:false/);
});
