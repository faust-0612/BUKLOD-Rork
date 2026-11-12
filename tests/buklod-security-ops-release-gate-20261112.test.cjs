const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const workflow = fs.readFileSync('.github/workflows/unified_rc_compiled_qa_20261108.yml','utf8');
const manifest = JSON.parse(fs.readFileSync('.buklod/scopes/buklod-security-ops-r1-20261112.json','utf8'));
test('Security operations exact-source compiled Expo release gate is enabled', () => {
  assert.match(workflow,/github.head_ref == 'security\/buklod-security-ops-r1-20261112'/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/npx expo export --platform android/);
  assert.match(workflow,/npx expo export --platform web/);
  assert.match(workflow,/github.event.pull_request.head.sha/);
  assert.match(workflow,/test -n "\\$\{EXPO_TOKEN:-\}"/);
  assert.ok(manifest.allowedPaths.includes('.github/workflows/unified_rc_compiled_qa_20261108.yml'));
  assert.equal(manifest.contractVersion,2);
});
