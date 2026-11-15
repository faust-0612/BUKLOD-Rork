import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Android staging RC compile cannot auto-publish and targets verified runtime',()=>{
 const wf=read('.github/workflows/buklod-nov16-ad-dashboard-ota-rc-no-publish.yml');
 assert.match(wf,/branches: \[fix\/nov16-ads-dashboard-staging-ota-candidate\]/);
 assert.match(wf,/BUKLOD_AD_DASHBOARD_RC_PREP_20261116/);
 assert.match(wf,/expo export --platform android --output-dir/);
 assert.match(wf,/npx tsc --noEmit/);
 assert.match(wf,/org\.mzbministry\.buklod\.staging/);
 assert.match(wf,/runtimeVersion,'1\.3\.2'/);
 assert.match(wf,/deviceVerification:'SKIPPED_BY_OWNER'/);
 assert.match(wf,/tests\/ad-dashboard-focus-performance-20261116\.test\.mjs/);
 assert.match(wf,/tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
 assert.doesNotMatch(wf,/\beas-cli@[^\s]*\s+update(?:\s|:)|npx\s+expo\s+publish|channel\s+production\s+--platform/i);
 assert.match(wf,/otaPublished:false/);
});
test('Exact canonical AdMob source contract and scope manifest remain release-gated',()=>{
 const manifest=JSON.parse(read('.buklod/scopes/nov16-ad-dashboard-staging-ota-candidate.json'));
 assert.equal(manifest.releaseMode,'source-only-staging-ota-candidate');
 assert.equal(manifest.intendedExpoRuntime,'1.3.2');
 assert.equal(manifest.releaseTarget,'staging-user');
 assert.equal(manifest.otaPublished,false);
 assert.equal(manifest.actualDeviceVerification,'SKIPPED_BY_OWNER');
 assert.equal(manifest.readyForOta,false);
 assert.ok(manifest.allowedPaths.includes('.github/workflows/buklod-nov16-ad-dashboard-ota-rc-no-publish.yml'));
 assert.ok(manifest.regressionTests.includes('tests/nov16-ad-dashboard-ota-rc-preflight.test.mjs'));
});
