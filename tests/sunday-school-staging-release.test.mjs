import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, BRANCH, PREVIOUS_UPDATE, PREVIOUS_GROUP, PREVIOUS_MESSAGE, verifyPriorUpdate } from '../scripts/sunday-school-staging-132-policy.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const wf=file('.github/workflows/buklod-sunday-school-staging-132-ota-20261115.yml');
test('staging publication uses verified 1.3.2 source, exact draft PR and Android-only Expo channel',()=>{
  assert.equal(BASE,'6b9981e200e4dfa9faa43f5d2691bc858a3f56f1');
  assert.equal(BRANCH,'feature/sunday-school-continuous-stories-20261115');
  assert.match(wf,/pull_number:826/);
  assert.match(wf,/!pr\.draft/);
  assert.match(wf,/--channel staging-user --platform android --environment preview/);
  assert.match(wf,/--skip-bundler --input-dir/);
  assert.match(wf,/build:view bc4be208-bfb0-42f3-95cb-358353d0600f/);
  assert.match(wf,/postpublish/);
  assert.doesNotMatch(wf,/update --channel production|eas build --platform|eas submit/);
});
test('release blocks an unknown or newer EAS staging update even when runtime stays 1.3.2',()=>{
  const row={group:PREVIOUS_GROUP,runtimeVersion:'1.3.2',message:'"'+PREVIOUS_MESSAGE+'" (1 hour ago by owner)'};
  assert.equal(verifyPriorUpdate({currentPage:[row]},PREVIOUS_UPDATE).group,PREVIOUS_GROUP);
  assert.throws(()=>verifyPriorUpdate({currentPage:[{...row,group:'newer'}]},PREVIOUS_UPDATE),/advanced/);
  assert.throws(()=>verifyPriorUpdate({currentPage:[{...row,message:'different'}]},PREVIOUS_UPDATE),/not the previously verified/);
  assert.throws(()=>verifyPriorUpdate({currentPage:[row]},'newer'),/manifest advanced/);
  assert.throws(()=>verifyPriorUpdate({currentPage:[{...row,runtimeVersion:'1.4.0'}]},PREVIOUS_UPDATE),/runtime changed/);
});
test('runtime, production nonmutation, exact source and second prepublish recheck are mandatory',()=>{
  const script=file('scripts/sunday-school-staging-132-policy.mjs');
  assert.match(script,/verifyBuild\(read\(dir\+'\/build\.json'\)\)/);
  assert.match(script,/ancestor\(APK_SOURCE,sha\)/);
  assert.match(script,/verifySource\(sha\)/);
  assert.match(script,/verifyPriorUpdate\(read\(dir\+'\/staging-updates-recheck\.json'\)/);
  assert.match(script,/prod\.id,pre\.productionId/);
  assert.match(script,/SKIPPED BY OWNER/);
  assert.match(wf,/Recheck live staging and production immediately before OTA/);
});
