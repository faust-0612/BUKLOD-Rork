// A scoped non-visual client recovery may only use the *unchanged* Character
// sources already successfully shipped in Android Production OTA #173.
// This is not approval of drift from original R31/R40: dedicated Character
// releases continue through the unmodified full canonical contract.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const lockedLive = new Map([
  ['src/components/points/BuklodProgressiveCharacterSelector.tsx', '1debd5659a96c97f83f32eeebb37c309a527d4ae'],
  ['src/components/points/BuklodSpecialCharacterSeries.tsx', '4cf837d453c4c33c867e2b0ae714e6f81f1ffeb6'],
  ['src/components/points/BuklodCharacterCustomizeSheet.tsx', '33fdfd5d1c599183f80eb4d7a4e99e7511c3bbc0'],
  ['src/components/points/BuklodProgressiveCharacterArt.tsx', '3000d9e03b77fc48f345c093fd5bd2a88bfad26d'],
]);
for (const [path, expected] of lockedLive) {
  assert.ok(fs.existsSync(path), `Missing shipped Character component: ${path}`);
  const actual = execFileSync('git', ['hash-object', path], {encoding:'utf8'}).trim();
  assert.equal(actual, expected, `Character UI changed versus verified Android OTA #173: ${path}`);
}
const character = fs.readFileSync('src/lib/buklodCharacterSelectionV2.ts','utf8');
assert.match(character,/await ensureCharacterSession\(userId\)/);
assert.match(character,/data\.session\.user\.id !== userId/);
assert.match(character,/set_my_buklod_character_active_v2/);
console.log('PASS: exact four-file Character visual parity with verified production OTA #173; Character selection session guard intact.');
console.log('R31/R40 original-layout debt stays recorded in Character PR #277 and is NOT declared resolved.');
const selector = fs.readFileSync('src/components/points/BuklodProgressiveCharacterSelector.tsx','utf8');
assert.match(selector,/They start at Level 1\./);
const baseGate = fs.readFileSync('scripts/release-gate.mjs','utf8');
assert.match(baseGate,/ATOMIC_RESET_LEVEL_1_V2/);
assert.match(baseGate,/They start at Level 1\./);
console.log('PASS: visible Level-1 explanation and atomic V2 reset assertions remain required.');
