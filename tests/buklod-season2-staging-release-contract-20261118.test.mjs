import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/buklod-season2-preview-staging-ota-20261118.yml','utf8');
const m=JSON.parse(readFileSync('.buklod/scopes/season2-staging-visual-preview-post-traina-prod-20261118.json','utf8'));
test('Season2 preview cannot publish production OTA or change package/season source',()=>{
 assert.match(w,/update --channel staging-user --platform android/);
 assert.doesNotMatch(w,/update --channel production|update --branch production|build --profile production/);
 assert.match(w,/APPROVED: 0895e932107904861319cbf800e19b3305de539e/);
 assert.match(w,/MAIN: 404c87e55c62a88c95c7389ac8665f237149702a/);
 assert.match(w,/production\.id,'01a1ee79-b1f1-7295-9d48-0238ffe0202a'/);
 assert.match(w,/BUKLOD_SEASON2_PREVIEW_STAGE_20261118:/);
 assert.match(w,/GH_TOKEN: \$\{\{ github\.token \}\}/);
});
test('Staging preflight and postpublish require signed compatible APK and unchanged production manifest',()=>{
 for(const k of ['verifyBuild(read','verifyChannels(read','manifest(\\x27production\\x27)'.replaceAll('\\x27',"'"),
    'org.mzbministry.buklod.staging','runtime:\\x271.3.2\\x27'.replaceAll('\\x27',"'"),
    'PRODUCTION CHANGED','actualAdFillVerified:false'])
    assert.ok(w.includes(k),k);
 assert.equal(m.releaseAuthorized,false);
 assert.equal(m.productionStatus,'UNCHANGED_SEASON2_EMBARGO');
 assert.ok(m.lockedFeatureChanges.some(x=>x.id==='production-release'));
});
