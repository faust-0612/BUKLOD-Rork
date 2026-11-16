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


const androidZoomFile = new URL('../src/components/points/BuklodProgressiveCharacterArt.android.tsx', import.meta.url);
if (!fs.existsSync(androidZoomFile)) {
  console.error('Android high-quality Character zoom renderer missing.');
  process.exit(1);
}
const androidZoomSource = fs.readFileSync(androidZoomFile, 'utf8');
for (const required of [
  'NATIVE_SPRITE_WIDTH = 4940',
  'NATIVE_CELL_WIDTH = NATIVE_SPRITE_WIDTH / 20',
  'fullSource && !fullSourceFailed',
  '<ExpoImage',
  'contentFit="fill"',
  'allowDownscaling={false}',
  'cachePolicy="memory-disk"',
  'priority="high"',
  '<NativeImage',
  'resizeMethod="scale"',
  'onError={() => setFullSourceFailed(true)}',
]) {
  if (!androidZoomSource.includes(required)) {
    console.error('Android Character zoom quality gate failed:', required);
    process.exit(1);
  }
}

console.log('Character active-renderer gate passed.');
