import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/buklod-s2-avatar-android-compile-qa-20261119.yml',import.meta.url),'utf8');
test('Season2 avatar Android QA compiles only staging source with no publication capability',()=>{
 assert.match(y,/branches: \[staging\/season2-consolidated-avatar-20261119\]/);
 assert.match(y,/org\.mzbministry\.buklod\.staging/);
 assert.match(y,/runtimeVersion,'1\.3\.2'/);
 assert.match(y,/npx expo export --platform android/);
 assert.match(y,/npx tsc --noEmit/);
 assert.match(y,/season2-avatar-admob-guard-20261119\.test\.mjs/);
 assert.doesNotMatch(y,/eas-cli[^\n]*\bupdate\b|\beas update\b|publish[^\n]*--channel|channel: production/i);
});
