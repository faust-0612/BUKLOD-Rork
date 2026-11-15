import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow = source('.github/workflows/buklod-children-stories-staging-132-ota-20261115.yml');
const policy = source('scripts/children-stories-staging-132-policy.mjs');
const config = source('app.config.js');
const eas = JSON.parse(source('eas.json'));

test('staging OTA is triggered by one scoped push and cannot target production', () => {
  assert.match(workflow,/branches: \[integration\/children-stories-staging-132-20261115\]/);
  assert.match(workflow,/paths: \[\.github\/workflows\/buklod-children-stories-staging-132-ota-20261115\.yml\]/);
  assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_CHILDREN_STORIES_STAGING_132_PUBLISH:'/);
  assert.match(workflow,/update --channel staging-user --platform android --environment preview/);
  assert.doesNotMatch(workflow,/eas-cli@[^\n]+update --channel production/);
  assert.doesNotMatch(workflow,/eas-cli@[^\n]+build --platform android/);
  assert.match(workflow,/pull_number:825/);
  assert.match(workflow,/!pr\.draft/);
});

test('release source must inherit signed APK and accepted staging baseline without native changes', () => {
  assert.match(policy,/const BASE = '2e7dc3aa69d2362b7b360013ccaac9917c353e2b'/);
  assert.match(policy,/compatible\(APK_SOURCE,sha\)/);
  assert.match(policy,/app\.config\.js/);
  assert.match(policy,/package-lock\.json/);
  assert.match(policy,/android\//);
  assert.match(policy,/const RUNTIME = '1\.3\.2'/);
  assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  assert.equal(eas.build['staging-user'].channel,'staging-user');
  assert.equal(eas.build['staging-user'].environment,'preview');
});

test('live staging must be previous source ancestor; unknown or newer source is blocked', () => {
  assert.match(policy,/verifyPreviousStage/);
  assert.match(policy,/gitCommitHash/);
  assert.match(policy,/compatible\(previousSha,newSha\)/);
  assert.match(policy,/current live staging update is not the most recent recorded branch update/);
  assert.match(workflow,/staging-previous-update-view\.json/);
});

test('postpublish verifies exact EAS receipt and preserves production manifest', () => {
  assert.match(policy,/verifyUpdate\(updates,sha,pre\.branch\.name\)/);
  assert.match(policy,/prod\.id,pre\.productionUpdateId/);
  assert.match(policy,/verifyChannels\(read\(dir\+'\/staging-channel-after\.json'\)/);
  assert.match(policy,/SERVER-SIDE ANDROID STAGING 1\.3\.2 OTA/);
  assert.match(policy,/SKIPPED BY OWNER/);
  assert.match(policy,/NOT APPLIED/);
  assert.match(workflow,/update:view/);
});
