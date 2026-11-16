import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/buklod-nov16-compact-art-staging-release.yml','utf8');
test('release is only a named, gated Android staging-user push',()=>{
  assert.match(workflow,/release\/nov16-compact-art-staging132/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/release\/nov16-compact-art-staging132'/);
  assert.match(workflow,/BUKLOD Compact Layout Source QA/);
  assert.match(workflow,/BUKLOD Character R31-R40 Recovery QA/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/npm run character:contract/);
  assert.match(workflow,/npm run compact:contract/);
  assert.match(workflow,/expo export --platform android/);
  assert.match(workflow,/update --channel staging-user --platform android/);
  assert.match(workflow,/productionUpdateId/);
  assert.match(workflow,/public artwork manifest/);
  assert.match(workflow,/physicalDeviceVerified:false/);
  assert.doesNotMatch(workflow,/update --channel production|build --profile production|submit --platform android/);
});
