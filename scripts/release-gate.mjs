import fs from 'node:fs';

const failures = [];
const warnings = [];

function fileUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function read(path) {
  return fs.readFileSync(fileUrl(path), 'utf8');
}

function readFirst(paths) {
  for (const path of paths) {
    if (fs.existsSync(fileUrl(path))) {
      return read(path);
    }
  }

  throw new Error(`None of the expected files exist: ${paths.join(', ')}`);
}

const legal = read('src/lib/legal.ts');
const envExample = read('.env.example');
const appConfig = readFirst(['app.config.js', 'app.config.ts']);

if (legal.includes('REQUIRED BEFORE LAUNCH')) {
  failures.push('Privacy notice still contains REQUIRED BEFORE LAUNCH placeholders.');
}

if (/service_role|sb_secret_/i.test(envExample)) {
  failures.push('.env.example appears to contain a server-side Supabase secret/service key reference.');
}

if (!appConfig.includes("org.mzbministry.buklod")) {
  failures.push('Expected final app identifier org.mzbministry.buklod was not found.');
}

const sqlFiles = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter(name => /^\d+_.*\.sql$/.test(name));

if (sqlFiles.length < 14) {
  failures.push(`Expected at least 14 SQL migration files; found ${sqlFiles.length}.`);
}

const requiredDocs = [
  'PRODUCTION_SECURITY_GATE.md',
  'V9_PRODUCTION_HARDENING.md',
  'V10_QA_PILOT.md',
  'qa/TEST_MATRIX.csv',
  'qa/PILOT_ROLLOUT.md',
];

for (const file of requiredDocs) {
  if (!fs.existsSync(new URL(`../${file}`, import.meta.url))) {
    failures.push(`Missing release artifact: ${file}`);
  }
}

/* BUKLOD_CHARACTER_CANONICAL_V2_RELEASE_LOCK
 * R31/R40 art may be recovered, but legacy progression authority must never be
 * recovered with it. Selection/reset authority remains server-backed V2:
 *   - selecting/changing Character starts the newly selected Character at L1
 *   - Character levels do not transfer
 *   - Circle Points / Circle Rank remain intact
 *   - locked Special Characters remain hidden
 *   - Profile and the floating Character navigator render the V2 selection
 *
 * PointsStage visible-sync is intentionally deferred to the hardened release
 * phase because the current main production-web workflow watches that path.
 */
const characterSelection = read('src/lib/buklodCharacterSelectionV2.ts');
const progressiveCharacter = read('src/lib/buklodProgressiveCharacter.ts');
const progressiveSelector = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const specialSeries = read('src/components/points/BuklodSpecialCharacterSeries.tsx');
const customizeSheet = read('src/components/points/BuklodCharacterCustomizeSheet.tsx');
const activeCharacterArt = read('src/components/points/BuklodActiveCharacterArt.tsx');
const profileCharacterCard = read('src/components/points/BuklodProfileCharacterCard.tsx');
const characterNavigator = read('src/components/points/BuklodCharacterNavigator.tsx');

if (!characterSelection.includes('ATOMIC_RESET_LEVEL_1_V2')) {
  failures.push('Character V2 atomic Level-1 reset contract is missing.');
}
if (!characterSelection.includes('CANONICAL_CIRCLE_RANK_PLUS_2_STEPS')) {
  failures.push('Canonical Circle Rank Special Character gate contract is missing.');
}
if (!characterSelection.includes('visible_special_character_ids')) {
  failures.push('Hidden-until-unlocked Special Character visibility contract is missing.');
}
if (!progressiveCharacter.includes('setMyBuklodCharacterActiveV2')) {
  failures.push('Recovered R31 selection is not delegated to V2/server authority.');
}
if (/levelForPoints\s*\(\s*lifetimePoints\s*\)/.test(progressiveSelector)) {
  failures.push('Legacy transferable lifetime-points Character leveling returned in R31 selector.');
}
if (!progressiveSelector.includes('starts at Level 1')) {
  failures.push('R31 selector is missing the visible Level-1 reset rule.');
}
if (!specialSeries.includes('setMyBuklodCharacterActiveV2')) {
  failures.push('R40 Special Character activation is not delegated to V2/server authority.');
}
if (specialSeries.includes("rpc('set_my_buklod_special_character_active_v1'")) {
  failures.push('Legacy R40 active-character RPC is authoritative again; use V2 selection authority.');
}
if (!customizeSheet.includes('BuklodProgressiveCharacterSelector') ||
    !customizeSheet.includes('BuklodSpecialCharacterSeries')) {
  failures.push('R31/R40 Character journeys are not integrated into the live Customize surface.');
}
if (!activeCharacterArt.includes('getMyBuklodCharacterSelectionV2') ||
    !activeCharacterArt.includes('subscribeBuklodCharacterSelectionV2')) {
  failures.push('Visible Character art is not synchronized to V2 active selection state.');
}
if (!activeCharacterArt.includes('BuklodProgressiveCharacterArt') ||
    !activeCharacterArt.includes('getBuklodSpecialLevelAsset')) {
  failures.push('Visible Character adapter is missing R31 or R40 art rendering.');
}
if (!profileCharacterCard.includes('BuklodActiveCharacterArt')) {
  failures.push('Profile Character card is not rendering the canonical V2 active Character.');
}
if (!characterNavigator.includes('BuklodActiveCharacterArt') ||
    characterNavigator.includes('BuklodCharacterFaceAvatar')) {
  failures.push('Points Character navigator is not locked to the canonical V2 active Character.');
}

if (!process.env.EAS_PROJECT_ID && !process.env.EXPO_PUBLIC_EAS_PROJECT_ID) {
  warnings.push('EAS project ID is not present in this shell environment.');
}

console.log('BUKLOD Release Gate');
console.log('===================');

for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nRelease gate FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nRelease gate PASSED.');
