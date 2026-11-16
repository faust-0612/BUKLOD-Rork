import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const workflow=readFileSync(new URL('../.github/workflows/buklod-nov16-current-staging-ota.yml',import.meta.url),'utf8');
test('Only explicitly owner-marked reviewed main merge may deploy staging',()=>{
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/BUKLOD_OWNER_STAGE_20261116:/);
  assert.match(workflow,/git rev-parse HEAD\^2\^\{tree\}/);
  assert.match(workflow,/test "\$\(git ls-remote origin refs\/heads\/main/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/expo export --platform android/);
});
test('Staging release checks signed APK runtime, separation and live manifests',()=>{
  assert.match(workflow,/verifyBuild,verifyChannels,manifest/);
  assert.match(workflow,/verifyUpdate\(read/);
  assert.match(workflow,/channel:view staging-user/);
  assert.match(workflow,/channel:view production/);
  assert.match(workflow,/prodUpdateId/);
  assert.match(workflow,/BUKLOD_NOV16_STAGING_/);
  assert.match(workflow,/physicalDeviceVerified:false/);
});
test('Staging automation never promotes, creates a native APK or publishes production/web',()=>{
  assert.match(workflow,/update --channel staging-user --platform android/);
  assert.doesNotMatch(workflow,/update --channel production/);
  assert.doesNotMatch(workflow,/build --profile/);
  assert.doesNotMatch(workflow,/deploy --prod|update --platform ios/);
});
