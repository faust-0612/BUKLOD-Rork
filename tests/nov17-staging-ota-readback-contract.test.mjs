import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/buklod-nov17-staging-ota-readback-audit.yml','utf8');
test('receipt audit is scoped to exact immutable staging SHA and a single read-only PR job',()=>{
 assert.match(workflow,/TARGET_RELEASE_SHA: 2cdb53bbe5aec18ad2c44a653b2e4bcfde4135d1/);
 assert.match(workflow,/name: BUKLOD Nov17 Staging OTA Receipt Audit - READ ONLY/);
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/audit\/nov17-staging-ota-readback-20261117/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read\s*\n\s*actions: read/);
 assert.doesNotMatch(workflow,/issues: write|contents: write|actions: write/);
});
test('readback checks actual release run, archived receipt, staging manifest and production integrity',()=>{
 for(const fragment of [
  'BUKLOD Nov17 Current Main Consolidated Android Staging OTA',
  'actions/runs?head_sha=',
  '/actions/runs/',
  '/artifacts/',
  'verification.json',
  "manifest('staging-user')",
  "manifest('production')",
  'productionUnchanged',
  'org.mzbministry.buklod.staging',
  'org.mzbministry.buklod',
  '1.3.2',
  'TARGET_RELEASE_SHA'
 ]) assert.ok(workflow.includes(fragment),'missing '+fragment);
 assert.doesNotMatch(workflow,/eas-cli|eas update|eas build|supabase db push|npx expo update|upload-artifact/);
});
