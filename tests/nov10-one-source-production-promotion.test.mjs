import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const marker='BUKLOD_CONSOLIDATED_PROD_20261108';
test('release is documentation-only from exact verified single source',()=>{
 const doc=read('release/BUKLOD_NOV10_ONE_SOURCE_PRODUCTION_PROMOTION.md');
 assert.match(doc,/94d5c8101a995a06e610b8ae9c14ca5da83a48ad/);
 assert.match(doc,/5bc842920a114a3ea9655e2f061ee8451fedcc4c/);
 assert.match(doc,/NOT proof that any OTA has been published/);
 assert.match(doc,/42802264905/);
});
test('original Android and web pipelines share one exact protected main commit marker',()=>{
 const android=read('.github/workflows/production_android_ota.yml');
 const web=read('.github/workflows/production_web_deploy.yml');
 for(const workflow of [android,web]){
  assert.match(workflow,/github.ref == 'refs\\/heads\\/main'/);
  assert.ok(workflow.includes(marker));
  assert.match(workflow,/git ls-remote origin refs\\/heads\\/main/);
 }
 assert.match(android,/android-ota-rc\\.cjs baseline/);
 assert.match(android,/android-ota-rc\\.cjs freeze/);
 assert.match(android,/android-ota-rc\\.cjs published/);
 assert.match(android,/eas-cli@latest update --channel production --platform android/);
 assert.match(web,/eas-cli@latest deploy --prod --export-dir dist/);
});
