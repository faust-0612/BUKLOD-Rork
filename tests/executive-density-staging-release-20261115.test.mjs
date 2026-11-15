import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, BRANCH, PREVIOUS_UPDATE, PREVIOUS_MESSAGE, verifyPriorUpdate } from '../scripts/executive-density-staging-132-policy.mjs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const flow = read('.github/workflows/buklod-executive-density-staging-132-ota-20261115.yml');
test('publish is staging only with exact frozen source and signed app build',()=>{
 assert.equal(BASE,'ab864a2b17e6078252be8ff8c7ce067043c7ce1c');
 assert.equal(BRANCH,'dev/executive-density-staging-20261115');
 assert.ok(flow.includes('pull_number:830'));
 assert.ok(flow.includes('!pr.draft'));
 assert.ok(flow.includes('build:view bc4be208-bfb0-42f3-95cb-358353d0600f'));
 assert.ok(flow.includes('update --channel staging-user --platform android --environment preview'));
 assert.ok(!flow.includes('update --channel production'));
 assert.ok(!flow.includes('eas build --platform') && !flow.includes('eas submit'));
});
test('a newer EAS staging publication blocks this release',()=>{
 const latest={group:'current-verified-group-12345678',runtimeVersion:'1.3.2',message:'"'+PREVIOUS_MESSAGE+'" (1 hour ago by owner)'};
 assert.equal(verifyPriorUpdate({currentPage:[latest]},PREVIOUS_UPDATE).updateId,PREVIOUS_UPDATE);
 assert.throws(()=>verifyPriorUpdate({currentPage:[{...latest,message:'different'}]},PREVIOUS_UPDATE),/not the previously verified/);
 assert.throws(()=>verifyPriorUpdate({currentPage:[latest]},'newer'),/manifest advanced/);
 assert.throws(()=>verifyPriorUpdate({currentPage:[{...latest,runtimeVersion:'1.4.0'}]},PREVIOUS_UPDATE),/runtime changed/);
});
test('publisher enforces CI, recheck, production identity and postpublish readback',()=>{
 const policy=read('scripts/executive-density-staging-132-policy.mjs');
 for(const required of ['ancestor(APK_SOURCE,sha)','verifyBuild(read(dir+\\'/build.json\\'))','staging-updates-recheck.json','pre.productionId','verifyUpdate(read(dir+\\'/update-view.json\\')','SKIPPED BY OWNER']) assert.ok(policy.includes(required),required);
 for(const required of ['Engineering Accountability','BUKLOD Main - Report Door and Legacy Integration PR QA','BUKLOD Live Motion R1 QA','--skip-bundler --input-dir','Independently verify staging manifest']) assert.ok(flow.includes(required),required);
});
