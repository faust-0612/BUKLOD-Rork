'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const scope=JSON.parse(read('.buklod/scopes/season2-dec6-economy-inventory-only-20261119.json'));
const inventory=JSON.parse(read('contracts/season2-dec6-complete-reward-inventory-20261119.json'));
const workflow=read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
test('Season 2 member reward guide cannot authorize production identity or app update',()=>{
 assert.equal(scope.productionChange,false);
 assert.equal(scope.releaseAuthorized,false);
 assert.equal(scope.season2RewardsEnabled,false);
 assert.equal(inventory.release.productionAuthorized,false);
 assert.equal(inventory.release.backendRewardWritesAllowed,false);
 assert.equal(inventory.release.automaticLaunch,false);
 assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
 assert.match(workflow,/production-id\.json/);
 assert.match(workflow,/season2-expo-free-plan-guard\.cjs/);
});
test('release identity and exact SHA owner gate remain explicit and unskipped',()=>{
 assert.ok(scope.riskAreas.includes('release-identity'));
 assert.ok(!scope.lockedFeatureChanges.some(x=>x.id==='release-identity'));
 assert.ok(scope.lockedFeatureChanges.some(x=>x.id==='production-release'));
 assert.match(workflow,/BUKLOD_S2_CONSO_STAGE_20261119:/);
 assert.equal(inventory.release.earliestProductionPHT,'2026-12-06T00:00:00+08:00');
});
