import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Obsolete R24 dispatch cannot auto-start or call a production publisher', () => {
  const source=readFileSync('.github/workflows/org_profile_setup_hub_r24_dispatch.yml','utf8');
  assert.match(source,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(source,/^  push:/m);
  assert.doesNotMatch(source,/^\s*actions: write/m);
  assert.doesNotMatch(source,/gh workflow run|eas-cli.*update|expo export|workflow_dispatch.*production_web_deploy/);
});
test('Canonical web publication still requires the vetted explicit main marker', () => {
  const web=readFileSync('.github/workflows/production_web_deploy.yml','utf8');
  assert.match(web,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_CONSOLIDATED_PROD_20261108'\)/);
  assert.doesNotMatch(web,/^  workflow_dispatch:/m);
  assert.match(web,/branches: \[main\]/);
});
test('Android production OTA continues to require explicit marker or manual main dispatcher', () => {
  const android=readFileSync('.github/workflows/production_android_ota.yml','utf8');
  assert.match(android,/BUKLOD_CONSOLIDATED_PROD_20261108/);
  assert.match(android,/Publish exact frozen Android RC/);
});
