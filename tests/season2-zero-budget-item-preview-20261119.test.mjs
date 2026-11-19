import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const release=JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
const rollout=read('src/lib/season2/buklodSeason2RewardContractR1.ts');
const guide=read('src/lib/season2/buklodSeason2CollectibleGuideR1.ts');
const candidate=read('docs/season2/sql/BUKLOD_S2_COLLECTIBLE_MASTERY_DRAFT_NOT_DEPLOY.sql');
const workflow=read('.github/workflows/buklod-season2-consolidated-staging-ota-20261119.yml');
test('no cost-sensitive backend or production Season2 activation is authorized',()=>{
  assert.equal(release.productionAuthorized,false);
  assert.equal(release.backendRewardsLive,false);
  assert.equal(release.season2RewardDbWritesAuthorized,false);
  assert.equal(release.mode,'preview_only_rewards_off');
  assert.equal(release.rewardsHoldUntilManilaDay,'2026-12-06');
  assert.match(rollout,/journeyTokenMint: false, journeyTokenSpend: false/);
  assert.match(rollout,/season2BadgeGrant: false/);
  assert.match(rollout,/productionAuthorized: false/);
  assert.match(guide,/grantsEnabled: false/);
  assert.match(candidate,/DRAFT. NEVER APPLY TO PRODUCTION/);
  assert.match(candidate,/revoke all on function buklod_s2.claim_collectible_mastery/);
});
test('consolidated update is staging-only and never invokes paid native builds',()=>{
  assert.match(workflow,/branches: \[integration\/season2-conso-staging-20261119\]/);
  assert.match(workflow,/update --channel staging-user --platform android/);
  assert.match(workflow,/org.mzbministry.buklod.staging/);
  assert.match(workflow,/PRODUCTION CHANGED DURING STAGING/);
  assert.doesNotMatch(workflow,/eas-cli[^\n]*build --platform/i);
});
test('the existing deployed Supabase migrations contain no S2 grant schema',()=>{
  const root=new URL('../supabase/migrations/',import.meta.url);
  for(const name of fs.readdirSync(root)){
    if(!name.endsWith('.sql'))continue;
    const sql=fs.readFileSync(new URL(name,root),'utf8');
    assert.doesNotMatch(sql,/\b(?:create|alter)\s+(?:schema|table|function)\s+(?:if not exists\s+)?buklod_s2\b/i,name);
  }
});
