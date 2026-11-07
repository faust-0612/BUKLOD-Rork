/**
 * BUKLOD Kingdom modular gaming R1 — focused source/data contract tests.
 * Run: node scripts/test-kingdom-game-platform-r1.mjs
 * Does not require a database, native binary, test account or CI credits.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const catalog = json('src/features/games/kingdom/platform/game-catalog.json');
const questions = json('src/features/games/christian/BibleCrownQuestions.json');
const registry = read('src/features/games/registry.ts');
const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
const center = read('src/app/games/christian-civic-leadership.tsx');
const bible = read('src/features/games/christian/BibleCrownGameV1.tsx');
const preview = read('src/features/games/kingdom/platform/previewStore.ts');
const blueprint = read('docs/BUKLOD_KINGDOM_MODULAR_GAME_PLATFORM_BLUEPRINT_20261107.md');

function gitBlobSha(text) {
  const bytes = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes).digest('hex');
}

// No Kingdom map editing is authorized in this game-interior workstream.
assert.equal(gitBlobSha(map), '88a4b1b4a70fc4acd59579419058b47f21be2554', 'Kingdom map changed');
assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.immutableMap, true);
assert.equal(catalog.characters.length, 13);
const all = catalog.characters.flatMap((c) => c.games);
assert.equal(all.length, 39);
assert.equal(new Set(all.map((g) => g.id)).size, 39, 'duplicate game IDs');
assert.equal(new Set(catalog.characters.map((c) => c.characterId)).size, 13, 'duplicate characters');
assert.equal(new Set(catalog.characters.map((c) => c.stationId)).size, 13, 'duplicate stations');
assert.equal(all.filter((g) => g.status === 'existing').length, 13);
assert.equal(all.filter((g) => g.status === 'pilot').length, 9);
assert.equal(all.filter((g) => g.status === 'planned').length, 17);
assert.deepEqual(
  all.filter((g) => g.status === 'pilot').map(g => g.id).sort(),
  ['christian-bible-crown', 'christian-scripture-word-search', 'mitch-block-forge', 'van-sudoku-master', 'quin-code-breaker', 'elesur-domino-village', 'jawo-trail-maze', 'trudice-picture-pairs', 'angel-number-vault'].sort(),
);

for (const centerData of catalog.characters) {
  assert.equal(centerData.games.length, 3, 'exactly three games per character');
  assert.equal(centerData.games.filter((g) => g.status === 'existing').length, 1);
  assert.equal(centerData.games[0].id, centerData.stationId, 'original game/route must remain the anchor');
  assert.ok(registry.includes("'" + centerData.stationId + "'"), 'missing old station ID');
  assert.ok(map.includes("/games/" + centerData.stationId), 'missing canonical map route');
  assert.ok(fs.existsSync(path.join(root, 'src/app/games', centerData.stationId + '.tsx')));
}
assert.ok(catalog.characters.some((c) => c.characterId === 'ellusur' && c.stationId === 'elesur-village-builder'), 'preserve canonical V2 ELESUR ID and legacy route');

assert.equal(questions.length, 15);
assert.equal(new Set(questions.map((q) => q.id)).size, 15);
for (const q of questions) {
  assert.match(q.id, /^q\d\d$/);
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3);
  assert.match(q.reference, /^[1-3]?\s?[A-Za-z]+\s+\d+:\d+/);
  for (const lang of ['en', 'tl']) {
    assert.ok(q.prompt[lang].trim().length > 12);
    assert.equal(q.choices[lang].length, 4);
    assert.equal(new Set(q.choices[lang].map((s) => s.trim().toLowerCase())).size, 4);
    assert.ok(q.choices[lang][q.correct]?.trim());
    assert.ok(q.explanation[lang]?.trim());
    assert.ok(q.mentor[lang]?.trim());
  }
}

for (const token of [
  'BibleCrownGameV1', 'ScriptureWordSearchGameV1', 'CivicLeadershipGameV1', 'ChristianGameCenterContent',
  'recordKingdomPreviewResult', 'recordBuklodKingdomPreviewResult',
]) assert.ok(center.includes(token), 'Christian route regressed: ' + token);

for (const token of [
  'LADDER', 'checkpointScore', 'secondChanceUsed', 'halfUsed', 'mentorUsed',
  'setPaused', 'onFinish?.(', "gameId: GAME_ID", 'kingdomXp: 0',
]) assert.ok(bible.includes(token), 'Bible Crown missing: ' + token);

for (const token of ['KEY_PREFIX + userId.toLowerCase()', 'recentSessionIds.includes(sessionId)', 'pendingByKey', 'AsyncStorage.setItem']) {
  assert.ok(preview.includes(token), 'account-scoped preview missing: ' + token);
}
assert.ok(!preview.includes("from '@/lib/buklodR38Economy'"));
assert.ok(!preview.includes('.rpc('));
assert.ok(!center.includes('maybeShowBuklodInterstitial('));
assert.ok(blueprint.includes('BUKLOD Empire is an independent'));
assert.ok(blueprint.includes('No economy grant from client code') || blueprint.includes('Do NOT silently reuse globally keyed'));

console.log('KINGDOM GAME PLATFORM TEST PASSED: immutable map; 13 centers; 39 unique games; nine pilots; 15 bilingual questions; original games and economy isolation.');
