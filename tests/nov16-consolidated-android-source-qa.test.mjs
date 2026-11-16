import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url),'utf8');
const workflow = read('.github/workflows/buklod-nov16-consolidated-android-source-qa.yml');

test('exact Nov16 cumulative Android staging source compiles with native parity and no OTA',()=>{
  assert.match(workflow,/integration\/nov16-current-wall-ads-zoom-rc-safe/);
  assert.match(workflow,/git diff --exit-code origin\/main\.\.\.HEAD -- app\.config\.js eas\.json package-lock\.json android\/ ios\/ plugins\/ babel\.config\.js/);
  assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
  assert.match(workflow,/runtimeVersion,'1\.3\.2'/);
  assert.match(workflow,/expo export --platform android/);
  assert.match(workflow,/test -s \/tmp\/buklod-nov16-consolidated-android\/metadata\.json/);
  assert.doesNotMatch(workflow,/\beas (?:update|build|submit)\b/);
  assert.doesNotMatch(workflow,/\bexpo publish\b/);
});
