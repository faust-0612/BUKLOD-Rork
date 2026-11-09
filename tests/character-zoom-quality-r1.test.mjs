import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('Fullscreen zoom decodes full native sprites; small cards retain lightweight decoding', () => {
  const art = read('src/components/points/BuklodProgressiveCharacterArt.tsx');
  const selector = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
  assert.match(art, /highQuality = false/);
  assert.match(art, /allowDownscaling=\{false\}/);
  assert.match(art, /cachePolicy="memory-disk"/);
  assert.match(art, /resizeMethod="scale"/);
  const zoom = selector.split('<Modal visible={zoom != null}')[1];
  assert.ok(zoom, 'fullscreen zoom modal exists');
  assert.match(zoom, /<BuklodProgressiveCharacterArt[\s\S]*?height=\{zoomHeight\}[\s\S]*?highQuality/);
  assert.match(selector, /lastLiveLevel\.current/);
  assert.match(selector, /shown === previous\.level \? current\.level : shown/);
});
