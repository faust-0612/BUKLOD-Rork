import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml','utf8');
test('Nov12 consolidated RC can compile Android and Expo Web from its exact PR source',()=>{
 assert.match(source,/github\.head_ref == 'integration\/buklod-nov12-conso-rc-seen-avatar-ads'/);
 assert.match(source,/github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
 assert.match(source,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
 assert.match(source,/npx expo export --platform android/);
 assert.match(source,/npx expo export --platform web/);
 assert.match(source,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
});
test('Compiled RC verification has no OTA or web production publish commands',()=>{
 assert.doesNotMatch(source,/\b(?:eas update|eas deploy|expo publish|gh release create)\b/);
});
