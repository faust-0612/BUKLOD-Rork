import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml','utf8');
test('nov12 cumulative RC gets only nonpublishing exact-source Android and web compile',()=>{
 assert.match(workflow,/github\.head_ref == 'integration\/buklod-nov12-publish-candidate-20261112'/);
 assert.match(workflow,/github\.head_ref == 'integration\/buklod-nov12-conso-rc-seen-avatar-ads'/);
 assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(workflow,/Compile V28-compatible Android OTA bundle \(no publish\)/);
 assert.match(workflow,/Compile Main Expo Hosting web bundle \(no publish\)/);
 assert.doesNotMatch(workflow,/eas-cli@latest update --channel production|eas-cli@latest deploy --prod/);
});
