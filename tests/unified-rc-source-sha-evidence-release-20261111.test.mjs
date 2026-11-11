import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Compiled RC metadata SHA comes from checked out PR source rather than GitHub synthetic merge ref',()=>{
  const workflow=readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml','utf8');
  assert.match(workflow,/sha:require\('node:child_process'\)\.execFileSync\('git',\['rev-parse','HEAD'\]/);
  assert.doesNotMatch(workflow,/sha:process\.env\.GITHUB_SHA/);
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
  assert.match(workflow,/if\(saved\.sha!==source\)/);
});
test('Compiled QA is non-publishing, while production source keeps its guarded OTA marker',()=>{
  const workflow=readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml','utf8');
  const prod=readFileSync('.github/workflows/production_android_ota.yml','utf8');
  assert.match(workflow,/expo export --platform android/);
  assert.match(workflow,/expo export --platform web/);
  assert.doesNotMatch(workflow,/eas-cli@latest update --channel production/);
  assert.match(prod,/BUKLOD_CONSOLIDATED_PROD_20261108/);
});
