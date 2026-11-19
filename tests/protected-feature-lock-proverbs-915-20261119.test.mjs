import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('915-day Proverbs owner change has an exact, source-only, protected Season2 integration scope', () => {
  const manifest = JSON.parse(read('.buklod/scopes/season2-proverbs-915-day-cycle-20261119.json'));
  const workflow = read('.github/workflows/engineering-accountability.yml');
  assert.match(workflow, /dev\\/season2-proverbs-915-day-cycle-20261119\\)/);
  assert.match(workflow, /BUKLOD_SCOPE_MANIFEST=\\.buklod\\/scopes\\/season2-proverbs-915-day-cycle-20261119\\.json/);
  assert.equal(manifest.contractVersion, 2);
  assert.equal(manifest.baseRef, 'integration/season2-conso-staging-20261119');
  assert.equal(manifest.productionChange, false);
  assert.equal(manifest.releaseAuthorized, false);
  assert.equal(manifest.rewardWritesAllowed, false);
  assert.equal(manifest.season2ExclusiveTenLockUnchanged, true);
  assert.equal(manifest.productionEmbargoUntilManila, '2026-12-06T00:00:00+08:00');
  assert.deepEqual(manifest.allowedPaths.slice().sort(), ["src/lib/season2/buklodProverbsKjvFullR1.ts","src/lib/season2/buklodDailyProverbsR1.ts","tests/season2-daily-proverbs-faith-wall-navigation-20261119.test.mjs","tests/protected-feature-lock-proverbs-915-20261119.test.mjs","contracts/season2-proposals/daily-proverbs-show-faith-20261119.json","contracts/season2-implementation-ledger.json",".github/workflows/engineering-accountability.yml",".buklod/scopes/season2-proverbs-915-day-cycle-20261119.json"].sort());
  for (const testPath of ["tests/season2-daily-proverbs-faith-wall-navigation-20261119.test.mjs", "tests/protected-feature-lock-proverbs-915-20261119.test.mjs"]) {
    assert.ok(manifest.regressionTests.includes(testPath));
  }
  const ten = JSON.parse(read('contracts/season2-owner-approved-exclusives-20261119.json'));
  assert.equal(ten.approvedFeatureIds.length, 10);
  assert.equal(ten.productionAuthorized, false);
  const proposal = JSON.parse(read('contracts/season2-proposals/daily-proverbs-show-faith-20261119.json'));
  assert.equal(proposal.fullProverbsVerses, 915);
  assert.equal(proposal.cycleDays, 915);
  assert.equal(proposal.automaticMonthlyReset, false);
  assert.equal(proposal.productionAuthorized, false);
  const ledger = JSON.parse(read('contracts/season2-implementation-ledger.json'));
  assert.equal(ledger.workstreams.find(v => v.id === 'show_faith_daily_proverbs_wall').status, 'DEV_IMPLEMENTED');
  assert.equal(ledger.environment, 'DEV_GOVERNANCE_ONLY');
});
