import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {inspectFreePlan}=require('../scripts/season2-expo-free-plan-guard.cjs');
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
const release=JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
test('billing checks are fail-closed, not inferred from public Expo pricing',()=>{
  for(const input of [null,{},[],{plan:'Starter'},{plan:'Production'},{billing:{currentPlan:{name:'Paid'}}},{usage:{freeTier:true}},{plan:'Free',billing:{amountDue:1}}])
    assert.equal(inspectFreePlan(input).free,false,JSON.stringify(input));
  assert.equal(inspectFreePlan({plan:'Free'}).free,true);
  assert.equal(inspectFreePlan({billing:{currentPlan:{name:'Free',overageCharges:0}}}).free,true);
  assert.equal(inspectFreePlan({plan:'Free',subscription:{planName:'Starter'}}).free,false);
});
test('staging-only publisher checks billing BEFORE any EAS build/view/export/update',()=>{
  const guard=workflow.indexOf('node scripts/season2-expo-free-plan-guard.cjs');
  const chargeSensitive=workflow.indexOf('npx --yes eas-cli@27.9.0 build:view');
  const publish=workflow.indexOf('update --channel staging-user');
  assert.ok(guard>0&&chargeSensitive>guard&&publish>chargeSensitive);
  assert.match(workflow,/eas-cli@27\.9\.0 account:usage --json --non-interactive/);
  assert.match(workflow,/private_file="\$\(mktemp \/tmp\/buklod-eas-plan\./);
  assert.match(workflow,/trap 'rm -f "\$private_file"' EXIT/);
  assert.doesNotMatch(workflow,/eas-cli[^\n]*build --platform/i);
});
test('production and live reward embargo remains preserved',()=>{
  assert.equal(release.target,'staging-user');
  assert.equal(release.productionAuthorized,false);
  assert.equal(release.backendRewardsLive,false);
  assert.equal(release.season2RewardDbWritesAuthorized,false);
  assert.equal(release.requiresSeparateOwnerApprovalForRewards,true);
  assert.match(workflow,/PRODUCTION CHANGED DURING STAGING/);
});
