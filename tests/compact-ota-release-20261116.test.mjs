import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('OTA preparation remains staging-only with exact identity and source checks',()=>{
  const workflow=read('.github/workflows/buklod-nov16-current-staging-ota.yml');
  const quality=read('.github/workflows/buklod-compact-layout-qa.yml');
  const scripts=read('package.json');
  assert.ok(workflow.includes('BUKLOD_OWNER_STAGE_20261116:'));
  assert.ok(workflow.includes('npm run compact:contract'));
  assert.ok(workflow.includes("APP_VARIANT: staging"));
  assert.ok(workflow.includes("runtimeVersion,'1.3.2'"));
  assert.ok(workflow.includes("test \"$(git rev-parse HEAD^1)\" = \"$RELEASE_BASE\""));
  assert.ok(workflow.includes('channel:view staging-user'));
  assert.ok(scripts.includes('npm run compact:contract'));
  assert.ok(quality.includes('pull_request:'));
  assert.doesNotMatch(quality,/npx\s+eas\s+update|eas-cli.*update|expo\s+publish/);
});