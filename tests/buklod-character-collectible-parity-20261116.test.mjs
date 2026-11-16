import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const art = read('src/components/points/BuklodCharacterCollectibleVisual.tsx');
const state = read('src/lib/buklodCharacterCollectibles.ts');
const active = read('src/components/points/BuklodActiveCharacterArt.tsx');
const selector = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');

test('all 13-character collectible art uses real 20-by-5 public storage mapping', () => {
  assert.match(art, /buklod-character-art-v1/);
  assert.match(art, /character-collectibles\/\$\{characterId\}\/l\$\{String\(level\)/);
  assert.match(art, /getPublicUrl\(path\)/);
  assert.match(art, /Number\.isInteger\(level\)/);
  assert.match(art, /Number\.isInteger\(itemIndex\)/);
  assert.match(art, /onError=/);
});

test('equipped pins use exact redeemed item and notify all mounted views', () => {
  assert.match(state, /if \(!owned \|\| !owned\.redeemedAt \|\| owned\.characterId !== pin\.characterId\) return \[\]/);
  assert.match(state, /level: owned\.level/);
  assert.match(state, /itemIndex: owned\.itemIndex/);
  assert.match(state, /notifyCollectibleChange\(characterId\)/);
});

test('Customize, Profile, Points and Economy share bounded artwork presentation', () => {
  assert.match(selector, /BuklodEquippedCollectibleRail pins=\{besidePins\}/);
  assert.match(selector, /BuklodCharacterCollectibleArtwork characterId=\{draft\} level=\{collectionLevel\}/);
  assert.doesNotMatch(selector, /characterTokenIcon/);
  assert.match(active, /BuklodEquippedCollectibleRail pins=\{pins\}/);
  assert.match(active, /subscribeBuklodCharacterCollectibles/);
  assert.match(active, /overflow: 'hidden'/);
  for (const name of ['BuklodProfileCharacterCard', 'BuklodPointsRewardsScreen', 'BuklodEconomyDashboard']) {
    assert.match(read('src/components/points/' + name + '.tsx'), /BuklodActiveCharacterArt/);
  }
});
