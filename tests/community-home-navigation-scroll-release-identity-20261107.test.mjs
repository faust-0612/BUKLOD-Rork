import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const home = read('src/app/(tabs)/home.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const contribution = read('src/components/BuklodCommunityContributionCard.tsx');
const releaseContract = read('scripts/community-contribution-economy-release-contract.mjs');
const prodConfig = read('app.config.js');
const prodRuntimeGate = read('scripts/android-ota-rc.cjs');
const prodWorkflow = read('.github/workflows/production_android_ota.yml');

test('navigation-scroll: approved Wall remains scrollable with location tabs and canonical composer', () => {
  assert.match(wall, /<BuklodPublicLocationChips/);
  assert.match(wall, /<BuklodMaritesBoard/);
  assert.match(wall, /<BuklodLifeWallCard/);
  assert.match(wall, /Share with your Community\.\.\./);
  assert.match(home, /<ScrollView/);
  assert.match(home, /showsVerticalScrollIndicator=\{/);
  assert.match(contribution, /router\.push\('\/community-contribution\?guide=1'/);
  assert.doesNotMatch(wall, /<BuklodCommunityContributionCard\s*\/>/);
});

test('release-identity: moving QMP display does not alter the production Android target or rollout gate', () => {
  assert.match(releaseContract, /src\/app\/\(tabs\)\/home\.tsx.*Home card mount/);
  assert.match(releaseContract, /forbid\('src\/app\/\(tabs\)\/buklod\.tsx'.*No duplicate Wall card mount/);
  assert.match(prodConfig, /version:\s*'1\.3\.4'/);
  assert.match(prodConfig, /org\.mzbministry\.buklod'/);
  assert.match(prodRuntimeGate, /const runtime = '1\.3\.2'/);
  assert.match(prodRuntimeGate, /assert\.equal\(config\.android\.package, 'org\.mzbministry\.buklod'\)/);
  assert.match(prodWorkflow, /workflow_dispatch:/);
  assert.match(prodWorkflow, /--channel production/);
});
