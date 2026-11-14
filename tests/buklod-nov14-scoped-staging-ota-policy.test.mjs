import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { verifyReleaseScope, verifyMetroChange } from '../scripts/buklod-nov14-scoped-staging-ota-policy.mjs';
const release=JSON.parse(fs.readFileSync(new URL('../release/nov14-staging-conso-excluding-health-saliksik.json',import.meta.url),'utf8'));
const workflow=fs.readFileSync(new URL('../.github/workflows/buklod-nov14-scoped-staging-ota-publish.yml',import.meta.url),'utf8');
test('staging QA release is explicitly scoped to Android and has backend exclusions',()=>{
  assert.doesNotThrow(()=>verifyReleaseScope(release));
  assert.throws(()=>verifyReleaseScope({...release,target:{...release.target,channel:'production'}}));
  assert.throws(()=>verifyReleaseScope({...release,stagingQaPublicationAuthorized:false}));
  assert.throws(()=>verifyReleaseScope({...release,readyForOta:true}));
});
test('Metro only adds existing OGG music asset registration, never native ABI',()=>{
  const before=fs.readFileSync(new URL('../metro.config.js',import.meta.url),'utf8');
  assert.ok(before.includes("assetExts.includes('ogg')"));
  assert.throws(()=>verifyMetroChange(before,before+'// unexpected mutation\n'));
});
test('release workflow runs from isolated branch and never targets production update',()=>{
  assert.match(workflow,/integration\/buklod-conso-staging-no-hc-saliksik-20261114/);
  assert.match(workflow,/BUKLOD_OWNER_SCOPED_STAGING_OTA_20261114:/);
  assert.match(workflow,/--channel staging-user --platform android --environment preview/);
  assert.doesNotMatch(workflow,/eas-cli@27\.9\.0 update --channel production/);
  assert.match(workflow,/buklod-nov14-scoped-staging-ota-policy\.mjs postpublish/);
  assert.match(workflow,/github\.rest\.actions\.listWorkflowRunsForRepo/);
});
