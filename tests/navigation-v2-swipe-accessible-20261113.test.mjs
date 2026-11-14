import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { isBuklodNavigationOptionsSwipe } from '../src/lib/buklodNavSwipe.ts';
const read = p => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('only deliberate leftward horizontal swipe opens optional actions', () => {
  assert.equal(isBuklodNavigationOptionsSwipe({x:200,y:20},{x:100,y:26}),true);
  assert.equal(isBuklodNavigationOptionsSwipe({x:200,y:20},{x:128,y:20}),true);
  assert.equal(isBuklodNavigationOptionsSwipe({x:100,y:20},{x:200,y:20}),false);
  assert.equal(isBuklodNavigationOptionsSwipe({x:200,y:20},{x:100,y:80}),false);
  assert.equal(isBuklodNavigationOptionsSwipe({x:200,y:20},{x:170,y:25}),false);
  assert.equal(isBuklodNavigationOptionsSwipe({x:NaN,y:20},{x:100,y:20}),false);
  assert.equal(isBuklodNavigationOptionsSwipe(null,{x:100,y:20}),false);
});
test('swipe is progressive enhancement, never the only menu or navigation control', () => {
  const ui=read('src/components/BuklodFeatureFinder.tsx');
  assert.match(ui,/onTouchStart=\{event => rememberSwipeStart/);
  assert.match(ui,/onTouchEnd=\{event => maybeOpenSwipeMenu/);
  assert.match(ui,/isBuklodNavigationOptionsSwipe\(start, \{ x, y \}\)/);
  assert.match(ui,/lastSwipeRef.current = \{ id: item.id, until: Date.now\(\) \+ 500 \}/);
  assert.match(ui,/if \(lastSwipeRef.current\?\.id === item.id/);
  assert.match(ui,/onLongPress=\{\(\) => setMenuItem\(item\)\}/);
  assert.match(ui,/accessibilityLabel=\{`More options for/);
  assert.match(ui,/accessibilityLabel=\{isPinned \?/);
  assert.match(ui,/onPress=\{\(\) => openAndRemember\(item\)\}/);
  assert.doesNotMatch(ui,/PanResponder|GestureDetector/);
});
