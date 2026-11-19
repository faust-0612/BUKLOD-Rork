import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('protected-feature-lock uses an exact manifest for the Season2 Proverbs integration PR', () => {
  const workflow = read('.github/workflows/engineering-accountability.yml');
  assert.match(workflow, /dev\/season2-daily-proverbs-show-faith-20261119\)/);
  assert.match(workflow, /BUKLOD_SCOPE_MANIFEST=\.buklod\/scopes\/season2-daily-proverbs-show-faith-20261119\.json/);
  const manifest = JSON.parse(read('.buklod/scopes/season2-daily-proverbs-show-faith-20261119.json'));
  assert.equal(manifest.contractVersion, 2);
  assert.equal(manifest.productionChange, false);
  assert.equal(manifest.releaseAuthorized, false);
  assert.equal(manifest.season2ExclusiveTenLockUnchanged, true);
  assert.equal(manifest.rewardWritesAllowed, false);
  const ids = manifest.lockedFeatureChanges.map(x => x.id).sort();
  assert.deepEqual(ids, ['app-runtime','cluster-faith','governance-lock','navigation-auth']);
  for (const path of [
    'src/app/(tabs)/buklod.tsx',
    'src/components/BuklodExclusiveScopeCommunity.tsx',
    'src/components/BuklodSeason2ProverbsDailyVerse.tsx',
    'src/lib/season2/buklodDailyProverbsR1.ts',
    '.github/workflows/engineering-accountability.yml'
  ]) assert.ok(manifest.allowedPaths.includes(path));
  const ten = JSON.parse(read('contracts/season2-owner-approved-exclusives-20261119.json'));
  assert.equal(ten.approvedFeatureIds.length, 10);
  assert.equal(ten.productionAuthorized, false);
  assert.equal(ten.firstPossibleProductionManila, '2026-12-06T00:00:00+08:00');
});
