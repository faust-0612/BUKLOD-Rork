import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBuklodNavTypographyExtraHeight } from '../src/lib/buklodNavTypography.ts';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url),'utf8');

test('bottom nav respects normal phone setting and grows reserve without clipping on large fonts',()=>{
  assert.equal(getBuklodNavTypographyExtraHeight(1),0);
  assert.equal(getBuklodNavTypographyExtraHeight(0.8),0);
  assert.equal(getBuklodNavTypographyExtraHeight(NaN),0);
  const scaled=[1.25,1.5,2,3,4].map(getBuklodNavTypographyExtraHeight);
  for(let i=1;i<scaled.length;i++) assert.ok(scaled[i]>scaled[i-1]);
  assert.ok(getBuklodNavTypographyExtraHeight(2)>=45);
  assert.ok(getBuklodNavTypographyExtraHeight(3)>=70);
});
test('global five-tab nav labels use phone text scale and reserve matching dynamic shell area',()=>{
  const nav=read('src/components/BuklodPersistentBottomNav.tsx');
  const safe=read('src/lib/buklodSafeArea.ts');
  assert.match(nav, /<Text allowFontScaling numberOfLines=\{2\} style=\{\{ fontSize: 12,/);
  assert.match(nav, /BUKLOD_HIT_SLOP|styles\.item/);
  assert.match(safe, /getBuklodNavTypographyExtraHeight\(fontScale\)/);
  assert.match(safe, /const \{ fontScale \} = useWindowDimensions\(\)/);
  assert.match(safe, /getBuklodPersistentNavOccupiedHeight\(\s*insets\.bottom,\s*fontScale/);
  assert.match(nav, /route: '\/hub'/);
  assert.match(nav, /route: '\/clusters'/);
  assert.match(nav, /route: '\/buklod'/);
  assert.match(nav, /route: '\/messages'/);
  assert.match(nav, /route: '\/me'/);
});
