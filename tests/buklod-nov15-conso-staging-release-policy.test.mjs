import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyReleaseScope} from '../scripts/buklod-nov15-conso-staging-ota-policy.mjs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-nov15-conso-staging-ota.yml');
const policy=read('scripts/buklod-nov15-conso-staging-ota-policy.mjs');
const release=JSON.parse(read('release/nov14-staging-conso-excluding-health-saliksik.json'));

test('new staging release remains confined to signed staging identity and unchanged prod',()=>{
  assert.match(workflow,/branches: \[integration\/nov15-conso-staging-video-ads-20261115\]/);
  assert.ok(workflow.includes("pull_number:818"));
  assert.ok(workflow.includes("BUKLOD_NOV15_CONSO_STAGING_OTA"));
  assert.ok(workflow.includes("BUKLOD Navigation V2 Staging Android Compile QA"));
  assert.ok(workflow.includes("Engineering Accountability"));
  assert.ok(workflow.includes("BUKLOD Main - Report Door and Legacy Integration PR QA"));
  assert.ok(workflow.includes("update --channel staging-user --platform android --environment preview"));
  assert.ok(!workflow.includes("update --channel production"));
  assert.match(workflow,/channel:view production/);
  assert.match(workflow,/production nonmutation verification/i);
  assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
  assert.match(workflow,/1\.3\.2/);
});

test('release source controls keep exact previous staging baseline and native exclusions',()=>{
  assert.ok(policy.includes("CONSOLIDATED_BASE='2e7dc3aa69d2362b7b360013ccaac9917c353e2b'"));
  assert.ok(policy.includes("Only the 17 reviewed consolidated"));
  assert.ok(policy.includes("Unreviewed source, release workflow or test delta"));
  assert.ok(policy.includes("const forbidden=git('diff','--name-only',APK_SOURCE,source"));
  assert.ok(policy.includes("verifyMetroChange(before,after)"));
  assert.ok(policy.includes("productionUpdateIdUnchanged"));
  assert.doesNotThrow(()=>verifyReleaseScope(release));
  assert.throws(()=>verifyReleaseScope({...release,stagingQaPublicationAuthorized:false}));
});
