import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Navigation and Connect preserve safe scroll geometry and focus behavior',()=>{
  const visual=read('src/lib/buklodVisual.ts');
  const layout=read('src/app/(tabs)/_layout.tsx');
  const inbox=read('src/app/(tabs)/messages.tsx');
  assert.match(visual,/touch:\s*48/);
  assert.match(layout,/freezeOnBlur:\s*true/);
  assert.match(inbox,/useBuklodScrollBottomInset/);
  assert.match(inbox,/searchDock:\s*\{[\s\S]{0,200}marginTop:\s*4/);
  assert.ok(inbox.indexOf('<View style={styles.hero}>') < inbox.indexOf('<View style={styles.searchDock}>'));
  assert.ok(inbox.includes('BuklodFirstViewAd'));
});