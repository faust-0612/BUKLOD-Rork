import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {inspectFreePlan,EXPECTED_EXPO_OWNER}=require('../scripts/season2-expo-free-plan-guard.cjs');
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
const release=JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
const freeFixture={account:{name:'faust_0612',plan:'Free'},billing:{estimated:{recurringCents:0,overageCents:0,totalCents:0}},updates:{overageCostCents:0}};
test('only canonical Expo account with actual CLI Free plan & no estimated charges qualifies',()=>{
  assert.equal(EXPECTED_EXPO_OWNER,'faust_0612');
  assert.equal(inspectFreePlan(freeFixture).free,true);
  assert.equal(inspectFreePlan({...freeFixture,billing:{estimated:{...freeFixture.billing.estimated,recurringCents:null}}}).free,true);
  for(const v of [
    null,{},[],{plan:'Free'},
    {...freeFixture,account:{name:'other_user',plan:'Free'}},
    {...freeFixture,account:{name:'faust_0612',plan:'Starter'}},
    {...freeFixture,account:{name:'faust_0612',plan:'Production'}},
    {...freeFixture,account:{name:'faust_0612',plan:null}},
    {...freeFixture,billing:{estimated:{...freeFixture.billing.estimated,overageCents:1}}},
    {...freeFixture,billing:{estimated:{...freeFixture.billing.estimated,totalCents:1}}},
    {...freeFixture,billing:{estimated:{...freeFixture.billing.estimated,recurringCents:1}}},
    {...freeFixture,updates:{overageCostCents:1}},
    {...freeFixture,updates:{}}
  ])assert.equal(inspectFreePlan(v).free,false,JSON.stringify(v));
});
test('billing gate runs before staging verification and EAS publication, no native EAS build',()=>{
  const guard=workflow.indexOf('node scripts/season2-expo-free-plan-guard.cjs');
  const firstEasBuildView=workflow.indexOf('npx --yes eas-cli@27.9.0 build:view');
  const publish=workflow.indexOf('update --channel staging-user');
  assert.ok(guard>0&&firstEasBuildView>guard&&publish>firstEasBuildView);
  assert.match(workflow,/eas-cli@27\.9\.0 account:usage faust_0612 --json --non-interactive/);
  assert.match(workflow,/private_file="\$\(mktemp \/tmp\/buklod-eas-plan\./);
  assert.match(workflow,/trap 'rm -f "\$private_file"' EXIT/);
  assert.doesNotMatch(workflow,/eas-cli[^\n]*build --platform/i);
});
test('production and active Season2 reward embargo remain in force',()=>{
  assert.equal(release.target,'staging-user');
  assert.equal(release.productionAuthorized,false);
  assert.equal(release.backendRewardsLive,false);
  assert.equal(release.season2RewardDbWritesAuthorized,false);
  assert.equal(release.requiresSeparateOwnerApprovalForRewards,true);
  assert.match(workflow,/PRODUCTION CHANGED DURING STAGING/);
});
