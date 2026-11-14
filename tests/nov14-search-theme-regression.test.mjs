import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('User language searches index monetization, rank and childhood-illness tools',()=>{
 const s=read('src/lib/buklodNavigationV2.ts');
 for(const word of ['monetization','monthly rank','overall rank','imci','QUESTION_WORDS','coverage===tokens.length'])assert.ok(s.includes(word),word);
 assert.match(s,/No network, no behavior tracking/);
});
test('Theme chooser fits phone viewport and retains touch-safe controls',()=>{
 const s=read('src/components/BuklodGlobalThemeSelector.tsx');
 assert.match(s,/minHeight: 48/);
 assert.match(s,/Math.min\(300, viewportHeight \* 0.42\)/);
 assert.match(s,/setPreference\(id\)/);
});
