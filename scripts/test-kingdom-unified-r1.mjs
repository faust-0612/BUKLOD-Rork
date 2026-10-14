import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const ids = [
  'jawo-forest-trail', 'trudice-playground-memory', 'ace-rescue-grid',
  'mitch-restore-mural', 'niel-mission-trail', 'angel-kingdom-treasury',
  'vhen-farm-to-market', 'elesur-village-builder', 'phan-enterprise-builder',
  'van-living-city-dispatch', 'christian-civic-leadership', 'lhen-rhythm-journey',
  'quin-discovery-expedition',
];
const registry = read('src/features/games/registry.ts');
const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
const auth = read('src/app/games/_layout.tsx');
const progress = read('src/features/games/kingdom/progress.ts');
const character = read('src/features/games/runtime/BuklodGameCharacterCompanion.tsx');
const stage = read('src/features/games/runtime/BuklodGameStage.native.tsx');
const guides = read('src/features/games/runtime/BuklodGameLanguage.tsx');
for (const id of ids) {
  assert(registry.includes("'" + id + "'"), 'missing registry game: ' + id);
  assert(map.includes(id), 'missing map station: ' + id);
  assert(guides.includes("'" + id + "'"), 'missing bilingual guide: ' + id);
  assert(fs.existsSync('src/app/games/' + id + '.tsx'), 'missing game route: ' + id);
}
assert.equal(ids.length, 13);
assert(auth.includes('useAuth()') && auth.includes('<Slot />'), 'auth layout missing');
assert(progress.includes('preview.progress.v2.'), 'account-scoped progress missing');
assert(progress.includes('LEGACY_OWNER_KEY'), 'consent-based legacy ownership protection missing');
assert(map.includes('importLegacyBuklodKingdomProgress'), 'legacy import UI missing');
assert(character.includes('BuklodActiveCharacterArt'), 'selected character bridge missing');
assert(stage.includes('BuklodGameCharacterCompanion'), 'game companion missing');
for (const [id, component, title] of [
  ['mitch-restore-mural', 'KingdomBlocksGameR1', 'Block Forge'],
  ['christian-civic-leadership', 'KingdomQuestionArcadeR1', 'Bible Quest'],
  ['van-living-city-dispatch', 'KingdomQuestionArcadeR1', 'Mind Challenge'],
  ['quin-discovery-expedition', 'KingdomQuestionArcadeR1', 'Guessing Quest'],
]) {
  const route = read('src/app/games/' + id + '.tsx');
  assert(route.includes(component), 'route not connected: ' + id);
  assert(route.includes('recordBuklodKingdomPreviewResult'), 'result callback missing: ' + id);
  assert(registry.includes("title: '" + title + "'"), 'registry title mismatch: ' + id);
}
for (const p of [
  'src/features/games/arcade/KingdomBlocksGameR1.tsx',
  'src/features/games/arcade/KingdomQuestionArcadeR1.tsx',
]) {
  const source = read(p);
  assert(source.includes('onFinish?.('), 'result callback missing: ' + p);
  assert(source.includes('xp: 0, kingdomXp: 0'), 'XP reward nonzero: ' + p);
}
console.log('PASS: Kingdom R1 static routes, guides, account boundary, character and game identity checks');
