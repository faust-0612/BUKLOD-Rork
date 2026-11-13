import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p,'utf8');
const marker = JSON.parse(read('.buklod/scopes/nov13-keyboard-gif-conso-production-marker-20261113.json'));

test('exact RC and source-identical main are required for this keyboard GIF production marker',()=>{
 assert.equal(marker.sourceMergeSha,'a2b5fef9e8529c0098b7f6ad6efb542a3aa71353');
 assert.equal(marker.baseRef,marker.sourceMergeSha);
 assert.equal(marker.rc.sourceHead,'18f0f235960f7962638612ebc34b733280cb4ffa');
 assert.equal(marker.rc.sourceTreeSha,'14302b82c29eb4b2bee473fd70a21040669b60d5');
 assert.equal(marker.rc.compiledAndroidWebRun,43354238892);
 assert.equal(marker.rc.androidBundleFiles,263);
 assert.equal(marker.rc.webBundleFiles,255);
 assert.equal(marker.rc.requiredChecksPassed,4);
 assert.equal(marker.target.runtimeVersion,'1.3.2');
 assert.equal(marker.target.androidVersionCode,30);
 assert.equal(marker.target.androidPackage,'org.mzbministry.buklod');
 assert.equal(marker.target.channel,'production');
 assert.equal(marker.target.web,'Expo Hosting');
});
test('canonical prefix triggers only guarded Android OTA and Expo Hosting publishers',()=>{
 const android=read('.github/workflows/production_android_ota.yml');
 const web=read('.github/workflows/production_web_deploy.yml');
 assert.equal(marker.releasePrefix,'BUKLOD_CONSOLIDATED_PROD_20261108');
 for(const w of [android,web]){
  assert.match(w,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_CONSOLIDATED_PROD_20261108'\)/);
  assert.match(w,/ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(w,/^  workflow_dispatch:/m);
 }
 assert.match(android,/node scripts\/android-ota-rc\.cjs freeze/);
 assert.match(android,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(web,/eas-cli@latest deploy --prod --export-dir dist/);
});
test('marker is metadata-only and includes the final verified scoped GIF implementation',()=>{
 assert.deepEqual(marker.allowedPaths,['.buklod/scopes/nov13-keyboard-gif-conso-production-marker-20261113.json','tests/nov13-keyboard-gif-conso-production-marker-20261113.test.mjs']);
 const wall=read('src/app/(tabs)/buklod.tsx');
 const scope=read('src/components/BuklodExclusiveScopeCommunity.tsx');
 const handoff=read('src/app/handle-share.tsx');
 assert.match(wall,/getActiveCommentGifTarget/);
 assert.doesNotMatch(wall,/Alert\.alert\('GIF ready for comment'/);
 assert.match(handoff,/getActiveCommentGifContext/);
 assert.match(scope,/scopedCommentOpenRef\.current/);
 assert.match(scope,/buklod_scope_social_add_comment_v1/);
 assert.match(scope,/scope\/\$\{scope\.scope_id\}\/\$\{user\.id\}\/comment-gif-/);
});
