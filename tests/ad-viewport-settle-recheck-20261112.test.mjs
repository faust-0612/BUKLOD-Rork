import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { isBuklodAdSlotVisible } from '../src/lib/buklodAdViewportVisibility.ts';

const hook = fs.readFileSync(new URL('../src/lib/buklodAdViewport.ts', import.meta.url), 'utf8');

test('ad viewability is based on real screen bounds, not just mount', () => {
  const viewport={width:360,height:700};
  assert.equal(isBuklodAdSlotVisible({x:0,y:250,width:300,height:120},viewport),true);
  assert.equal(isBuklodAdSlotVisible({x:0,y:750,width:300,height:120},viewport),false);
  assert.equal(isBuklodAdSlotVisible({x:0,y:-150,width:300,height:100},viewport),false);
  assert.equal(isBuklodAdSlotVisible({x:0,y:250,width:0,height:120},viewport),false);
  assert.equal(isBuklodAdSlotVisible({x:NaN,y:5,width:300,height:120},viewport),false);
});
test('fast scroll after initial visibility must remeasure before native ad eligibility',()=>{
  assert.match(hook,/setTimeout\(\(\) => \{[\s\S]*?measureInWindow\(\(sx, sy, sw, sh\) =>/);
  assert.match(hook,/isBuklodAdSlotVisible\([\s\S]*?setEligible\(true\)/);
  assert.match(hook,/generation !== generationRef\.current/);
  assert.match(hook,/clearInterval\(poll\)/);
  assert.match(hook,/app\.remove\(\)/);
  assert.ok(!hook.includes('expo-video'));
});
