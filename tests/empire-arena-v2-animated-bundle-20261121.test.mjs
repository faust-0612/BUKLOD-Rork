import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = relative => resolve(root, relative);
const manifest = JSON.parse(readFileSync(path('assets/season2/arena/generated-manifest.json'),'utf8'));
const registry = readFileSync(path('src/features/games/empire/arenaGeneratedAssets.ts'),'utf8');
const CHARACTERS = ['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice'];

test('Exactly 13 SHA-verified nonempty real animated WebP source-owned actor assets', () => {
  for (const id of CHARACTERS) {
    const items = manifest.assets.filter(e => e.key === 'sprite:' + id);
    assert.equal(items.length, 1, 'Missing unique '+id);
    const a = items[0];
    assert.ok(a.file.startsWith('assets/season2/arena/generated/sprite/'+id+'-'));
    assert.match(a.file, /-[a-f0-9]{12}\.webp$/);
    assert.equal(a.status, 'dev-baseline');
    const binary = readFileSync(path(a.file));
    assert.ok(binary.byteLength > 10000);
    assert.equal(binary.subarray(0,4).toString(),'RIFF');
    assert.equal(binary.subarray(8,12).toString(),'WEBP');
    assert.ok(binary.includes(Buffer.from('ANIM')),id+' is not truly animated');
    assert.equal(createHash('sha256').update(binary).digest('hex'),a.sha256);
    assert.ok(registry.includes("'sprite:" + id + "': require('../../../../" + a.file + "')"),
       'Missing static Metro import for '+id);
  }
});

test('All 13 sprite assets remain cosmetic and practice must not produce account entitlements', () => {
  const screen = readFileSync(path('src/app/games/empire-arena.tsx'),'utf8');
  const art = readFileSync(path('src/features/games/empire/ArenaAnimatedActor.tsx'),'utf8');
  const original = readFileSync(path('src/features/games/empire/arenaVisualBaseline.ts'),'utf8');
  for(const id of CHARACTERS) assert.ok(original.includes(id+': require('));
  assert.match(screen, /ARENA_GENERATED_ART\['sprite:' \+ p.hero\]/);
  assert.match(screen, /ArenaAnimatedActor/);
  assert.match(art, /withRepeat\(/);
  assert.doesNotMatch(screen,/supabase\.|\.rpc\(|awardBp|awardDiamond|settleWorldTrade/);
});
