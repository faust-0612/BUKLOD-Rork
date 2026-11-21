import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'assets/season2/arena/generated-manifest.json'), 'utf8'));
const registry = readFileSync(resolve(root, 'src/features/games/empire/arenaGeneratedAssets.ts'), 'utf8');
const media = readFileSync(resolve(root, 'src/features/games/runtime/rorkMedia.ts'), 'utf8');

test('All three canonical Arena scene plates are committed, stable and integrity verified', () => {
  assert.equal(manifest.schema, 1);
  for (const id of ['genesis_rift', 'aurora_foundry', 'verdant_fracture']) {
    const matching = manifest.assets.filter(e => e.key === 'scene:' + id);
    assert.equal(matching.length, 1, 'Exactly one registered scene for ' + id);
    const entry = matching[0];
    assert.equal(entry.status, 'dev-baseline');
    assert.ok(entry.file.startsWith('assets/season2/arena/generated/scene/' + id + '-'));
    assert.match(entry.file, /-[a-f0-9]{12}\.png$/);
    const data = readFileSync(resolve(root, entry.file));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(data.readUInt32BE(16) >= 256 && data.readUInt32BE(20) >= 256);
    assert.equal(data.length, entry.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256);
    assert.ok(registry.includes("'scene:" + id + "': require('../../../../" + entry.file + "')"));
  }
});

test('Scene art sources are existing BUKLOD media plates, never unverified hosts', () => {
  for (const marker of ['r2-pub.rork.com', 'const BG = {', 'ruins:', 'treasury:', 'forest:']) {
    assert.ok(media.includes(marker));
  }
  assert.doesNotMatch(registry, /https?:\/\/|file:\/\//);
});
