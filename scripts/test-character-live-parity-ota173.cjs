// Current Character source-quality baseline after the intentional fullscreen
// sharpness change. Android OTA #173 is a historical production baseline,
// NOT proof that this new DEV revision has shipped to Android users.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const lockedLive = new Map([
  ['src/components/points/BuklodProgressiveCharacterSelector.tsx', '3547d7c87a1e0d696430da26b6c8bb51ac8d5204'],
  ['src/components/points/BuklodSpecialCharacterSeries.tsx', '4cf837d453c4c33c867e2b0ae714e6f81f1ffeb6'],
  ['src/components/points/BuklodCharacterCustomizeSheet.tsx', '33fdfd5d1c599183f80eb4d7a4e99e7511c3bbc0'],
  ['src/components/points/BuklodProgressiveCharacterArt.tsx', 'e328dd696193e7680d2df2ddd3e178d32a1bfac9'],
]);
for (const [path, expected] of lockedLive) {
  assert.ok(fs.existsSync(path), `Missing shipped Character component: ${path}`);
  const actual = execFileSync('git', ['hash-object', path], {encoding:'utf8'}).trim();
  assert.equal(actual, expected, `Character UI changed versus reviewed current source baseline: ${path}`);
}
const character = fs.readFileSync('src/lib/buklodCharacterSelectionV2.ts','utf8');
assert.match(character,/await ensureCharacterSession\(userId\)/);
assert.match(character,/data\.session\.user\.id !== userId/);
assert.match(character,/set_my_buklod_character_active_v2/);
console.log('PASS: reviewed current Character visual source baseline and V2 session guard intact.');
console.log('R31/R40 original-layout debt stays recorded in Character PR #277 and is NOT declared resolved.');
const selector = fs.readFileSync('src/components/points/BuklodProgressiveCharacterSelector.tsx','utf8');
assert.match(selector,/They start at Level 1\./);
const baseGate = fs.readFileSync('scripts/release-gate.mjs','utf8');
assert.match(baseGate,/ATOMIC_RESET_LEVEL_1_V2/);
assert.match(baseGate,/They start at Level 1\./);
console.log('PASS: visible Level-1 explanation and atomic V2 reset assertions remain required.');
