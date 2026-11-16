import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url));
const selector = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const contract = read('scripts/character-release-contract.mjs').toString('utf8');
const art = read('src/components/points/BuklodCharacterCollectibleVisual.tsx').toString('utf8');

test('protected Character presentation lock matches the exact current modified source blob', () => {
  const blobSha = createHash('sha1')
    .update('blob ' + selector.length + '\0')
    .update(selector)
    .digest('hex');
  const locked = contract.match(/'src\/components\/points\/BuklodProgressiveCharacterSelector\.tsx': '([a-f0-9]{40})'/)?.[1];
  assert.ok(locked, 'The original protected Character visual lock must remain active');
  assert.equal(locked, blobSha, 'Canonical selector lock must match the exact source bytes');
});

test('release art change keeps the approved 20-level controls and server Character selection', () => {
  const current = selector.toString('utf8');
  assert.match(current, /BUKLOD_CHARACTER_R31_APPROVED_LAYOUT/);
  assert.match(current, /Array\.from\(\{ length: 20 \}/);
  assert.match(current, /setMyBuklodCharacterActiveV2/);
  assert.match(current, /shownCollectiblePins/);
  assert.match(art, /buklod-character-art-v1/);
  assert.match(art, /BuklodEquippedCollectibleRail/);
});
