import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const marker=JSON.parse(read('.buklod/scopes/nov12-final-consolidated-production-publish-20261112.json'));
test('single reviewed source, package and runtime for Nov12 cumulative release',()=>{
 assert.equal(marker.sourceMergeSha,'222f2d4adc8887f8ffcc422806fe3d4162c30304');
 assert.equal(marker.baseRef,marker.sourceMergeSha);
 assert.equal(marker.rc.sourceHead,'39dd187403f0a15f9f73e63749b9fd4290c0dc24');
 assert.equal(marker.rc.compiledAndroidWebRun,43160679575);
 assert.equal(marker.rc.requiredChecksPassed,4);
 assert.equal(marker.target.androidPackage,'org.mzbministry.buklod');
 assert.equal(marker.target.runtimeVersion,'1.3.2');
 assert.equal(marker.target.androidVersionCode,30);
 assert.equal(marker.target.easProjectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
 assert.equal(marker.target.channel,'production');
});
test('both canonical guarded production publishers require explicit prefix, exact source checkout and frozen proof',()=>{
 const android=read('.github/workflows/production_android_ota.yml');
 const web=read('.github/workflows/production_web_deploy.yml');
 assert.equal(marker.releasePrefix,'BUKLOD_CONSOLIDATED_PROD_20261108');
 for(const workflow of [android,web]){
  assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_CONSOLIDATED_PROD_20261108'\)/);
  assert.match(workflow,/ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow,/^  workflow_dispatch:/m);
 }
 assert.match(android,/node scripts\/android-ota-rc\.cjs freeze/);
 assert.match(android,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(web,/eas-cli@latest deploy --prod --export-dir dist/);
});
test('release metadata cannot imply automatic quiz success or change member points',()=>{
 const kl=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
 const bsoc=read('src/app/admin/bsoc-conversations.tsx');
 assert.match(kl,/kl_quiz_admin_review_v1/);
 assert.match(bsoc,/isValidBdocCaseId\(routeCaseId\)/);
 assert.equal(marker.knownPending.klChapterBanks,5);
 assert.equal(marker.knownPending.enforceQuiz,false);
 assert.deepEqual(marker.allowedPaths,[
  '.buklod/scopes/nov12-final-consolidated-production-publish-20261112.json',
  'tests/nov12-final-consolidated-release-marker-20261112.test.mjs',
 ]);
});
