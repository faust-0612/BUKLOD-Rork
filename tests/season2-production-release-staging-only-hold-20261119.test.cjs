'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('Season 2 publishing workflow is scoped to staging channel, branch and guarded release manifest', () => {
  const workflow = read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
  assert.match(workflow, /branches: \[integration\/season2-conso-staging-20261119\]/);
  assert.match(workflow, /--channel staging-user/);
  assert.match(workflow, /manifest\('staging-user'\)/);
  assert.match(workflow, /manifest\('production'\)/);
  assert.match(workflow, /PRODUCTION CHANGED DURING STAGING/);
  assert.match(workflow, /req\.backendRewardsLive,false/);
  assert.match(workflow, /req\.season2RewardDbWritesAuthorized,false/);
  assert.match(workflow, /req\.requiresSeparateOwnerApprovalForRewards,true/);
  assert.match(workflow, /req\.rewardsHoldUntilManilaDay,'2026-12-06'/);
  assert.match(workflow, /tests\/season2-visual-only-hold-20261119\.test\.cjs/);
  assert.doesNotMatch(workflow, /(?:eas-cli\S*\s+update|eas-cli\S*\s+channel)\s+(?:--channel|--branch)\s+production/);
});
test('Staging reward hold does not authorize an automatic December 6 release', () => {
  const release = JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
  assert.equal(release.productionAuthorized, false);
  assert.equal(release.backendRewardsLive, false);
  assert.equal(release.season2RewardDbWritesAuthorized, false);
  assert.equal(release.requiresSeparateOwnerApprovalForRewards, true);
  assert.equal(release.rewardsHoldUntilManilaDay, '2026-12-06');
  assert.equal(release.expectedPackage, 'org.mzbministry.buklod.staging');
  assert.equal(release.expectedRuntime, '1.3.2');
});
