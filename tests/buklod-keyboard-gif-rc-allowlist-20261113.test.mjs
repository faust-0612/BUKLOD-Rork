import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../.github/workflows/unified_rc_compiled_qa_20261108.yml',import.meta.url),'utf8');
const manifest = JSON.parse(readFileSync(new URL('../.buklod/scopes/keyboard-gif-comment-return-20261113.json',import.meta.url),'utf8'));
test('Exact isolated GIF branch receives Android and Web compile-only QA',()=>{
 assert.match(workflow,/github\.head_ref == 'fix\/keyboard-gif-comment-direct-20261113'/);
 assert.match(workflow,/npx expo export --platform android --output-dir \/tmp\/buklod-rc-android --clear/);
 assert.match(workflow,/npx expo export --platform web --output-dir \/tmp\/buklod-rc-web --clear/);
 assert.match(workflow,/github\.event\.pull_request\.head\.sha/);
 assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
 assert.match(workflow,/runtimeVersion,'1\.3\.2'/);
 assert.match(workflow,/versionCode,30/);
});
test('No publish and exact regression scope remain guarded',()=>{
 assert.doesNotMatch(workflow,/^\s+- name:.*(eas update|production publish)/m);
 assert.equal(manifest.contractVersion,2);
 assert.ok(manifest.allowedPaths.includes('.github/workflows/unified_rc_compiled_qa_20261108.yml'));
 assert.ok(manifest.regressionTests.includes('tests/buklod-keyboard-gif-rc-allowlist-20261113.test.mjs'));
});
