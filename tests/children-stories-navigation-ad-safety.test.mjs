import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('children stories are discoverable; personal household and Health have their own Focus doors',()=>{
  const home=source('src/components/home/BuklodHomeUtilityCards.tsx');
  const family=source('src/app/profile/buklod-family.tsx');
  const health=source('src/app/profile/buklod-health.tsx');
  const links=source('src/lib/buklodNavigationV2.ts');
  const root=source('src/app/_layout.tsx');
  assert.ok(home.includes("router.push('/children-stories'"));
  assert.ok(family.includes("router.push('/personal-home'"));
  assert.ok(health.includes('Online Consultation'));
  assert.ok(links.includes("id: 'stories'"));
  assert.ok(root.includes('children-stories/index') && root.includes('children-stories/[id]'));
});
test('children-directed stories suppress generic ad placements including resume warm-up',()=>{
 const controller=source('src/lib/buklodGlobalAdController.ts');
 const bridge=source('src/components/BuklodAdSafetyRouteBridge.tsx');
 assert.match(controller,/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
 assert.match(bridge,/if \(!isBuklodAdRouteSensitive\(\)\)/);
 assert.match(bridge,/setBuklodAdRoute\(pathname\)/);
});
