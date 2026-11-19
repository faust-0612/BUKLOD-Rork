const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const release=JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
const workflow=read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
const governance=read('.github/workflows/buklod-season2-governance-drift.yml');
const embargo=read('scripts/buklod-season2-production-embargo.cjs');
const manifest=JSON.parse(read('contracts/season2-owner-approved-exclusives-20261119.json'));
test('Season2 OTA remains staging-user only, no production scope or rewards',()=>{
 assert.equal(release.target,'staging-user');
 for(const k of ['productionAuthorized','backendRewardsLive','season2RewardDbWritesAuthorized'])assert.equal(release[k],false);
 assert.equal(release.mode,'preview_only_rewards_off');
 assert.equal(manifest.automaticDec6Launch,false);
 assert.match(workflow,/branch(?:es)?: \[integration\/season2-conso-staging-20261119\]/);
 assert.match(workflow,/BUKLOD_S2_CONSO_STAGE_20261119/);
 assert.match(workflow,/node scripts\/season2-owner-scope-lock.cjs/);
 assert.match(workflow,/NONZERO_OR_UNKNOWN_BILLING|season2-expo-free-plan-guard.cjs/);
 assert.match(workflow,/PRODUCTION CHANGED DURING STAGING/);
});
test('Production embargo is source-guarded, not an automatic Dec6 launch',()=>{
 assert.ok(embargo.includes('2026-12-05T16:00:00.000Z'));
 assert.ok(embargo.includes('season2-production-authorization.json'));
 assert.ok(embargo.includes('ownerAuthorizationId'));
 assert.equal(manifest.productionShaBoundApprovalRequired,true);
 assert.match(governance,/season2-owner-scope-lock.cjs/);
});
