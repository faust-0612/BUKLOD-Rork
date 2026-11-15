import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BASE,BRANCH,PREVIOUS_UPDATE,PREVIOUS_MESSAGE,verifyPriorUpdate} from '../scripts/notifications-staging-132-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const flow=read('.github/workflows/buklod-notifications-staging-132-ota-20261115.yml');
test('publish only notification JS to signed 1.3.2 staging based on the latest verified OTA',()=>{
 assert.equal(BASE,'ab3ed7c375b09b31dcac2369c106eba4bd8a6ca0');
 assert.equal(BRANCH,'fix/notifications-dark-contrast-executive-20261115');
 assert.equal(PREVIOUS_UPDATE,'01a1df87-139b-7da4-9e69-4e5ed36024df');
 assert.ok(flow.includes('pull_number:838'));
 assert.ok(flow.includes("pr.base.ref!=='dev/executive-density-staging-20261115'"));
 assert.ok(flow.includes('build:view bc4be208-bfb0-42f3-95cb-358353d0600f'));
 assert.ok(flow.includes('update --channel staging-user --platform android --environment preview'));
 assert.ok(!flow.includes('update --channel production'));
 assert.ok(!flow.includes('eas build --platform') && !flow.includes('eas submit'));
});
test('newer staging versions and changed runtime fail closed',()=>{
 const latest={group:'verified-current-group-12345678',runtimeVersion:'1.3.2',message:'"'+PREVIOUS_MESSAGE+'" (2 minutes ago by admin)'};
 assert.equal(verifyPriorUpdate({currentPage:[latest]},PREVIOUS_UPDATE).updateId,PREVIOUS_UPDATE);
 assert.throws(()=>verifyPriorUpdate({currentPage:[{...latest,message:'other'}]},PREVIOUS_UPDATE),/not the verified executive density release/);
 assert.throws(()=>verifyPriorUpdate({currentPage:[latest]},'newer'),/manifest advanced/);
 assert.throws(()=>verifyPriorUpdate({currentPage:[{...latest,runtimeVersion:'2.0.0'}]},PREVIOUS_UPDATE),/runtime changed/);
});
test('exact SHA, independent production readback and runtime are mandatory',()=>{
 const p=read('scripts/notifications-staging-132-policy.mjs');
 for(const x of ['ancestor(APK_SOURCE,sha)',"verifyBuild(read(dir+'/build.json'))",'staging-updates-recheck.json','pre.productionId',"verifyUpdate(read(dir+'/update-view.json')",'SKIPPED BY OWNER'])assert.ok(p.includes(x),x);
 for(const x of ['Engineering Accountability','BUKLOD Main - Report Door and Legacy Integration PR QA','npx tsc --noEmit','expo export --platform android','--skip-bundler --input-dir','Independently verify staging manifest'])assert.ok(flow.includes(x),x);
});
