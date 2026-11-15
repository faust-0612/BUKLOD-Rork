
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Kingdom compact invitation retains game route and 13 stations',()=>{
 const s=readFileSync(new URL('../src/components/home/BuklodKingdomHubCard.tsx',import.meta.url),'utf8');
 assert.match(s,/router\.push\('\/games'/);
 assert.match(s,/13 CHARACTER CENTERS/);
 assert.match(s,/background: \{ minHeight: 174/);
 assert.match(s,/minHeight: 44/);
 assert.match(s,/accessibilityRole="button"/);
});
