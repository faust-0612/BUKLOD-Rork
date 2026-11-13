import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('BSOC GPT requires authorized explicit opening and does not send member case text',()=>{
 const s=read('src/app/admin/bsoc-conversations.tsx');
 assert.match(s,/disabled=\{!canRead\}/);
 assert.match(s,/router\.push\('\/admin\/bsoc-gpt-debug'/);
 assert.match(s,/never forwarded automatically/);
 assert.doesNotMatch(s,/functions\.invoke\('bsoc-gpt-debug-v1'/);
 const g=read('src/app/admin/bsoc-gpt-debug.tsx');
 assert.match(g,/bsoc-gpt-debug-v1/);assert.match(g,/Only authorized BSOC support personnel/);
});