import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('children stories navigation preserves legacy Home doors and adds a discoverable route',()=>{
 const home=source('src/components/home/BuklodHomeUtilityCards.tsx');
 const links=source('src/lib/buklodNavigationV2.ts');
 const root=source('src/app/_layout.tsx');
 assert.match(home,/router\.push\('\/children-stories'/);
 assert.match(home,/router\.push\('\/personal-home'/);
 assert.match(home,/Online Consultation/);
 assert.match(links,/id: 'stories'.*route: '\/children-stories'/);
 assert.match(root,/Stack.Screen name="children-stories\/index"/);
 assert.match(root,/Stack.Screen name="children-stories\/\[id\]"/);
});
test('children-directed stories suppress generic ad placements including resume warm-up',()=>{
 const controller=source('src/lib/buklodGlobalAdController.ts');
 const bridge=source('src/components/BuklodAdSafetyRouteBridge.tsx');
 assert.match(controller,/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
 assert.match(bridge,/if \(!isBuklodAdRouteSensitive\(\)\)/);
 assert.match(bridge,/setBuklodAdRoute\(pathname\)/);
});
