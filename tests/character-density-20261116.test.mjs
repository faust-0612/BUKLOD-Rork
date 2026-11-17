import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('R31/R40 Character source retains canonical levels, 1300 artwork, safe zoom and compact rail',()=>{
  const character=read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
  assert.match(character,/roster:\s*\{ marginTop: 10, marginHorizontal: 14, gap: 8 \}/);
  assert.match(character,/featuredArt:\s*\{ width: 124, height: 148/);
  assert.match(character,/progressionArt:\s*\{[\s\S]{0,100}width: 90,\s*height: 138/);
  assert.match(character,/save:\s*\{[\s\S]{0,125}minHeight: 44/);
  assert.ok(character.includes('setZoom('));
  assert.ok(character.includes('shownCollectiblePins('));
});