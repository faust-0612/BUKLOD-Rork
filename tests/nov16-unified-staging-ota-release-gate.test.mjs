import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/buklod-nov16-unified-character-staging-ota.yml',import.meta.url),'utf8');
const scope=JSON.parse(readFileSync(new URL('../.buklod/scopes/nov16-unified-character-kingdom-connect-staging132.json',import.meta.url),'utf8'));
test('Nov16 publisher targets exact staging package and reviewed RC only',()=>{
 for(const proof of ['branches: [integration/nov16-unified-character-kingdom-connect-staging132]','BUKLOD_STAGE132_NOV16_PUBLISH:','RELEASE_BASE: 00132deaae3413adfdf8228690517b21cf4c0a06','org.mzbministry.buklod.staging',"a.equal(c.runtimeVersion,'1.3.2')",'--channel staging-user --platform android'])assert.ok(workflow.includes(proof),proof);
 assert.ok(!workflow.includes('update --channel production'));
 assert.ok(!workflow.includes('eas build --platform android'));
 assert.ok(scope.allowedPaths.includes('.github/workflows/buklod-nov16-unified-character-staging-ota.yml'));
});
test('Nov16 publisher requires full source QA, AdMob regressions, frozen RC and production readback',()=>{
 for(const proof of ['objective-scope-gate','typecheck-and-unit-tests','main-report-integration-qa','tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs','tests/buklod-ads-production-release-contract-20261111.test.mjs','tests/buklod-shared-dashboard-scroll-20261111.test.mjs','tests/marites-wall-scroll-video-navigation-20261113.test.mjs','sha256sum -c',"assert.equal(p.id,pre.prodUpdateId",'BUKLOD_NOV16_UNIFIED_STAGING_'])assert.ok(workflow.includes(proof),proof);
 assert.ok(workflow.includes('git ls-remote origin refs/heads/main'));
});
