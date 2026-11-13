import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../src/app/admin/bsoc-conversations.tsx',import.meta.url),'utf8');
test('GPT uses only approved technical category, platform, version and an operator tap',()=>{
 assert.match(s,/if\(!canRead\|\|gptBusy/);
 assert.match(s,/onPress=\{\(\)=>\{void askGptForCase\(selected\);\}\}/);
 assert.match(s,/const area=bsoCaseIntervention\(target\)\.category/);
 assert.match(s,/functions\.invoke\('bsoc-gpt-debug-v1',\{body:\{prompt\}\}\)/);
 assert.match(s,/Never transmit user-entered report text/);
 assert.match(s,/GPT investigation proposal · NOT verified/);
 assert.match(s,/Never auto-reply, execute changes or mark resolved/);
});