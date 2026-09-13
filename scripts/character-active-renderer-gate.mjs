import fs from 'node:fs';

const file = new URL('../src/components/points/BuklodActiveCharacterArt.tsx', import.meta.url);
const source = fs.readFileSync(file, 'utf8');

const requiredTokens = [
  'getMyBuklodCharacterSelectionV2',
  'subscribeBuklodCharacterSelectionV2',
  'BuklodProgressiveCharacterArt',
  'getBuklodSpecialLevelAsset',
];

const missing = requiredTokens.filter((token) => !source.includes(token));
if (missing.length > 0 || source.includes('BuklodCharacterLayeredArt')) {
  console.error('Character active-renderer gate failed.');
  process.exit(1);
}

console.log('Character active-renderer gate passed.');
