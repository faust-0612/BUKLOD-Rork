import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=(p)=>readFileSync(resolve(root,p),'utf8');
test('Kingdom map retains canonical renderer and exposes an in-app Arena door',()=>{
  const map=read('src/app/games/index.tsx');
  assert.match(map,/BuklodKingdomMapPremium/);
  assert.match(map,/BuklodKingdomAdSlot/);
  assert.match(map,/\/games\/empire-arena/);
  assert.doesNotMatch(map,/Linking\.openURL|WebBrowser\.openBrowserAsync/);
});
test('Arena stays in BUKLOD package with canonical hero art and original game simulation',()=>{
  const route=read('src/app/games/empire-arena.tsx');
  const art=read('src/features/games/empire/arenaVisualBaseline.ts');
  assert.match(route,/\/experiments\/empire-arena-v2\/arena-v2-engine\.mjs/);
  assert.match(route,/getCachedBuklodCharacterSelectionV2/);
  assert.match(route,/useAuth/);
  assert.match(route,/getRorkGameMedia/);
  assert.match(route,/ARENA_GENERATED_ART/);
  assert.match(art,/ARENA_HERO_ART: Record<BuklodCharacterId/);
  for (const hero of ['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice']) {
    assert.match(art,new RegExp('^\\s*'+hero+': require','m'));
  }
  assert.ok(existsSync(resolve(root,'experiments/empire-arena-v2/arena-v2-engine.mjs')));
});
