import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('long navigation instructions are separate, optional, accessible and reachable from both Settings and Home',()=>{
  const help=read('src/app/settings/navigation-help.tsx');
  const finder=read('src/components/BuklodFeatureFinder.tsx');
  const settings=read('src/app/settings/index.tsx');
  const root=read('src/app/_layout.tsx');
  assert.match(root,/Stack.Screen name="settings\/navigation-help"/);
  assert.match(settings,/route: '\/settings\/navigation-help'/);
  assert.match(finder,/router\.push\('\/settings\/navigation-help'/);
  assert.match(help,/How to use BUKLOD/);
  assert.match(help,/allowFontScaling/);
  assert.match(help,/onPress=\{\(\) => router\.push\('\/support\/live'/);
});
test('new Settings controls use existing reduced-motion-aware press transitions, not a heavy animation dependency',()=>{
  const settings=read('src/app/settings/index.tsx');
  const press=read('src/components/BuklodProfileMotion.tsx');
  assert.match(settings,/<ProfilePressable/);
  assert.match(press,/useBuklodReduceMotion\(\)/);
  assert.match(press,/useNativeDriver: true/);
});
