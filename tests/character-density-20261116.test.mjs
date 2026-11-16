import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Character cards are compact while art, levels, collectibles and zoom remain visible',()=>{
  const character=read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
  assert.match(character,/roster:\s*\{ marginTop: 8, marginHorizontal: 12, gap: 6 \}/);
  assert.match(character,/featuredArt:\s*\{ width: 108, height: 148/);
  assert.match(character,/progressionArt:\s*\{[\s\S]{0,100}width: 90,\s*height: 138/);
  assert.match(character,/save:\s*\{[\s\S]{0,125}minHeight: 44/);
  assert.ok(character.includes('setZoom('));
  assert.ok(character.includes('shownCollectiblePins('));
});