import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {EXPECTED,evaluateOrder}=require('../scripts/buklod-season2-staging-order-gate.cjs');
const good={
  manifest:{id:EXPECTED.productionUpdateId,runtimeVersion:'1.3.2',extra:{expoClient:{android:{package:EXPECTED.productionPackage}}}},
  release:{id:EXPECTED.officialReleaseRunId,status:'completed',conclusion:'success',head_sha:EXPECTED.productionSourceSha},
  variant:'staging',environment:'staging',ref:'refs/heads/'+EXPECTED.stagingBranch,
  campaign:{officialOpeningPublished:false,redemptionLive:false,missionAwardsLive:false,
    chapterPublishingLive:false,inactivityDeductionsLive:false}
};
test('Approved read-only Season2 preview staging allowed immediately after verified Train A production',()=>{
  assert.deepEqual(evaluateOrder(good),{allowed:true,errors:[]});
});
test('Wrong or stale production update is never a proof of release order',()=>{
  assert.equal(evaluateOrder({...good,manifest:{...good.manifest,id:'stale'}}).allowed,false);
  assert.equal(evaluateOrder({...good,manifest:{...good.manifest,runtimeVersion:'1.3.3'}}).allowed,false);
  assert.equal(evaluateOrder({...good,release:{...good.release,conclusion:'failure'}}).allowed,false);
  assert.equal(evaluateOrder({...good,release:{...good.release,head_sha:'bad'}}).allowed,false);
});
test('Never stage Season2 into production or enable a reward behind an unpublished preview',()=>{
  assert.equal(evaluateOrder({...good,variant:'production'}).allowed,false);
  assert.equal(evaluateOrder({...good,ref:'refs/heads/main'}).allowed,false);
  assert.equal(evaluateOrder({...good,campaign:{...good.campaign,missionAwardsLive:true}}).allowed,false);
  assert.equal(evaluateOrder({...good,campaign:{...good.campaign,officialOpeningPublished:true}}).allowed,false);
});
