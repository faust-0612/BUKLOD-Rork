import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { collectibleArtworkKey, collectibleArtworkPath, collectibleArtworkUri, BUKLOD_ART_CHARACTER_IDS } from '../src/lib/buklodCollectibleArtwork.ts';

test('full 13x20x5 collectible art path contract', () => {
  const paths = new Set();
  assert.equal(BUKLOD_ART_CHARACTER_IDS.length, 13);
  for(const id of BUKLOD_ART_CHARACTER_IDS) for(let level=1;level<=20;level++) for(let item=1;item<=5;item++){
    const paddedLevel=String(level).padStart(2,'0'), paddedItem=String(item).padStart(2,'0');
    assert.equal(collectibleArtworkKey(id,level,item),id+':L'+paddedLevel+':I'+paddedItem);
    const path='character-collectibles/'+id+'/l'+paddedLevel+'-i'+paddedItem+'.webp';
    assert.equal(collectibleArtworkPath(id,level,item),path);
    assert.equal(paths.has(path),false);
    paths.add(path);
  }
  assert.equal(paths.size,1300);
});

test('invalid path rejected; unconfigured art is safely absent', () => {
  assert.equal(collectibleArtworkPath('../phan',1,1),null);
  assert.equal(collectibleArtworkPath('phan',21,1),null);
  assert.equal(collectibleArtworkPath('phan',1,6),null);
  assert.equal(collectibleArtworkPath('phan',1.5,1),null);
  const base=process.env.EXPO_PUBLIC_BUKLOD_CHARACTER_ART_BASE_URL;
  assert.equal(collectibleArtworkUri('phan',1,1),typeof base==='string' && /^https:\/\/[^?#\s]+$/i.test(base)
    ? base.replace(/\/$/,'')+'/character-collectibles/phan/l01-i01.webp' : null);
});

test('animation, profile display and collectible preview are present', () => {
  const sheet=fs.readFileSync('src/components/points/BuklodCharacterCustomizeSheet.tsx','utf8');
  const selector=fs.readFileSync('src/components/points/BuklodProgressiveCharacterSelector.tsx','utf8');
  const motion=fs.readFileSync('src/components/points/BuklodCharacterIdleMotion.tsx','utf8');
  assert.match(sheet,/<BuklodCharacterIdleMotion active=\{visible\}>/);
  assert.match(sheet,/\{activeName\.toUpperCase\(\)\}/);
  assert.match(selector,/<BuklodCollectibleArt characterId=\{draft\}/);
  assert.match(selector,/setItemZoom\(\{/);
  const special=fs.readFileSync('src/components/points/BuklodSpecialCharacterSeries.tsx','utf8');
  assert.match(special,/<BuklodCollectibleArt characterId=\{selected\.id\}/);
  assert.match(special,/<BuklodCharacterIdleMotion active=\{selectedUnlocked && active\}>/);
  assert.match(motion,/isReduceMotionEnabled/);
  assert.match(motion,/AppState\.addEventListener/);
  assert.match(motion,/useNativeDriver: true/);
  assert.match(selector,/state\.character_levels\[draft\]/);
  assert.match(special,/state\.character_levels\[selected\.id\]/);
});
