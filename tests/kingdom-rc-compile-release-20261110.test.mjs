import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/unified_rc_compiled_qa_20261108.yml',import.meta.url),'utf8');
const scope = JSON.parse(readFileSync(new URL('../.buklod/scopes/kingdom-continuation-ui-ads-20261110.json',import.meta.url),'utf8'));

test('Kingdom branch can compile Android and Expo Web without publishing or changing production identity',()=>{
  assert.match(workflow,/github\.head_ref == 'dev\/kingdom-continuation-ui-ads-20261110'/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/npx expo export --platform android --output-dir/);
  assert.match(workflow,/npx expo export --platform web --output-dir/);
  assert.match(workflow,/c\.runtimeVersion,'1\.3\.2'/);
  assert.match(workflow,/c\.android\.package,'org\.mzbministry\.buklod'/);
  assert.doesNotMatch(workflow,/npx eas update\b|eas update:configure\b|npx eas build --platform/);
  assert.ok(scope.riskAreas.includes('release-identity'));
  assert.ok(scope.regressionTests.includes('tests/kingdom-rc-compile-release-20261110.test.mjs'));
});
