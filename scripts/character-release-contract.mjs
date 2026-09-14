import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const info = [];

const args = process.argv.slice(2);
const distIndex = args.indexOf('--dist');
const distDir = distIndex >= 0 ? path.resolve(ROOT, args[distIndex + 1] || 'dist') : null;

/*
 * R31 FIRST-FIVE VISUAL FREEZE
 * These are exact repository blob identities from the Sept 13 approved state.
 * R40 is intentionally NOT hash-frozen in this recovery PR until the user
 * visually confirms the restored dual-layer Special presentation. After that
 * confirmation, Customize + both R40 presentation files must be hash-locked.
 */
const LOCKED_R31_VISUAL_BLOBS = {
  'src/components/points/BuklodProgressiveCharacterSelector.tsx': '685f4b16dfa5bf8ced3be1296565c4493c092dbd',
  'src/components/points/BuklodProgressiveCharacterArt.tsx': '7b6eef608b9844e21e412df19348de87d0468bbe',
};

const CORE_ASSETS = {
  'assets/images/characters/phan_r26.jpg': '1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB',
  'assets/images/characters/quin_r26.jpg': '769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892',
  'assets/images/characters/van_r26.jpg': 'B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66',
  'assets/images/characters/christian_r26.jpg': '1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739',
  'assets/images/characters/lhen_r26.jpg': '17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB',
};

const SPECIAL_IDS = ['ace', 'ellusur', 'jawo', 'mitch', 'niel', 'angel', 'vhen', 'trudice'];

function full(rel) {
  return path.join(ROOT, rel);
}

function mustExist(rel) {
  if (!fs.existsSync(full(rel))) {
    failures.push(`Missing required Character file: ${rel}`);
    return false;
  }
  return true;
}

function read(rel) {
  if (!mustExist(rel)) return '';
  return fs.readFileSync(full(rel), 'utf8');
}

function sha256(rel) {
  const buffer = fs.readFileSync(full(rel));
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function trackedGitBlobSha(rel) {
  try {
    return execFileSync('git', ['rev-parse', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    failures.push(`Could not resolve tracked Git blob: ${rel}`);
    return null;
  }
}

function lockedPathIsDirty(rel) {
  const worktree = spawnSync('git', ['diff', '--quiet', '--', rel], { cwd: ROOT, stdio: 'ignore' });
  const index = spawnSync('git', ['diff', '--cached', '--quiet', '--', rel], { cwd: ROOT, stdio: 'ignore' });
  if (worktree.status == null || index.status == null) {
    failures.push(`Could not verify clean Git state: ${rel}`);
    return true;
  }
  return worktree.status !== 0 || index.status !== 0;
}

function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${rel} is missing required contract token: ${token}`);
  }
  return text;
}

function forbidTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) failures.push(`${rel} contains forbidden legacy token: ${token}`);
  }
  return text;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else out.push(absolute);
  }
  return out;
}

console.log('BUKLOD CHARACTER RELEASE CONTRACT — R31 + R40');
console.log('================================================');

for (const [rel, expected] of Object.entries(LOCKED_R31_VISUAL_BLOBS)) {
  if (!mustExist(rel)) continue;
  const tracked = trackedGitBlobSha(rel);
  if (tracked && tracked !== expected) {
    failures.push(`LOCKED R31 VISUAL CHANGED: ${rel} expected_blob=${expected} tracked_blob=${tracked}`);
  }
  if (lockedPathIsDirty(rel)) failures.push(`LOCKED R31 VISUAL HAS LOCAL/STAGED EDITS: ${rel}`);
}
info.push('Exact Sept 13 first-five R31 visual source checked.');

const selector = requireTokens('src/components/points/BuklodProgressiveCharacterSelector.tsx', [
  'Browse all 20 levels',
  'Use This Character',
  'state.character_level',
  'starts at Level 1',
]);
if (/levelForPoints\s*\(\s*lifetimePoints\s*\)/.test(selector)) {
  failures.push('Legacy transferable lifetime-points Character leveling returned in R31 selector.');
}

requireTokens('src/components/points/BuklodCharacterCustomizeSheet.tsx', [
  'BuklodProgressiveCharacterSelector',
  'BuklodSpecialCharacterSeries',
  'BuklodSpecialSeriesOne',
  'getMyBuklodCharacterSelectionV2',
  'subscribeBuklodCharacterSelectionV2',
]);

const premium = requireTokens('src/components/points/BuklodSpecialCharacterSeries.tsx', [
  'BUKLOD_CHARACTER_R40_LAYOUT_LOCK_V3',
  'Special Character Journey',
  'More than a character. A mission.',
  'LEVEL 1 - 20 JOURNEY',
  'COLLECTIBLES & BADGES',
  'nestedScrollEnabled',
  'visible_special_character_ids',
  'setMyBuklodCharacterActiveV2',
  'get_my_buklod_special_collectibles_v2',
  'set_my_buklod_special_character_pursuit_v1',
]);
if (premium.includes("rpc('set_my_buklod_special_character_active_v1'")) {
  failures.push('Legacy R40 active-character RPC returned in premium Special journey.');
}

const passport = requireTokens('src/components/points/BuklodSpecialSeriesOne.tsx', [
  'BUKLOD_CHARACTER_R37B_SPECIAL_SERIES1_PREVIEW_V2_SAFE',
  'SPECIAL CHARACTERS · SERIES 1',
  'Eight new BUKLOD journeys',
  'ACTIVE SPECIAL CHARACTER · MAIN VIEW',
  'SERIES 1 · CHARACTER PASSPORT PREVIEW',
  'STAGES 1–20',
  'visible_special_character_ids',
  'setMyBuklodCharacterActiveV2',
  'nestedScrollEnabled',
]);
forbidTokens('src/components/points/BuklodSpecialSeriesOne.tsx', [
  'set_my_buklod_special_character_active_v1',
  'discover_my_buklod_special_character_v1',
  'unlock_my_buklod_special_character_v1',
  'special-series1/',
]);
if (!passport.includes('SPECIAL_CHARACTER_HERO')) {
  failures.push('Series 1 passport layer is not using the verified R40 hero art family.');
}

requireTokens('src/lib/buklodProgressiveCharacter.ts', [
  'saveProgressiveCharacter',
  'setMyBuklodCharacterActiveV2',
]);

for (const [rel, expected] of Object.entries(CORE_ASSETS)) {
  if (!mustExist(rel)) continue;
  const actual = sha256(rel);
  if (actual !== expected) failures.push(`R31 core art changed: ${rel} expected=${expected} actual=${actual}`);
}

const registry = read('src/lib/buklodSpecialCharacterAssets.ts');
for (const id of SPECIAL_IDS) {
  if (!registry.includes(`${id}_hero.jpg`)) failures.push(`R40 registry is missing ${id}_hero.jpg`);
  for (let level = 1; level <= 20; level += 1) {
    const suffix = String(level).padStart(2, '0');
    if (!registry.includes(`${id}_level_${suffix}.jpg`)) failures.push(`R40 registry is missing ${id}_level_${suffix}.jpg`);
  }
}

const specialRoot = full('assets/images/characters/special/batch1');
if (!fs.existsSync(specialRoot)) {
  failures.push('Missing R40 special asset folder: assets/images/characters/special/batch1');
} else {
  const jpgs = walk(specialRoot).filter((file) => /\.jpg$/i.test(file));
  if (jpgs.length < 168) failures.push(`R40 special asset set incomplete: found ${jpgs.length}, expected at least 168.`);
  info.push(`R40 special JPG count: ${jpgs.length}`);
}

if (distDir) {
  if (!fs.existsSync(distDir)) {
    failures.push(`Compiled bundle directory does not exist: ${path.relative(ROOT, distDir)}`);
  } else {
    const compiled = walk(distDir)
      .filter((file) => /\.(?:js|html)$/i.test(file))
      .map((file) => {
        try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
      })
      .join('\n');
    for (const token of [
      'Browse all 20 levels',
      'Use This Character',
      'Special Character Journey',
      'More than a character. A mission.',
      'SPECIAL CHARACTERS · SERIES 1',
      'Eight new BUKLOD journeys',
      'SERIES 1 · CHARACTER PASSPORT PREVIEW',
      'get_my_buklod_special_collectibles_v2',
    ]) {
      if (!compiled.includes(token)) failures.push(`Compiled bundle is missing Character presentation token: ${token}`);
    }
    info.push(`Compiled bundle checked: ${path.relative(ROOT, distDir)}`);
  }
}

for (const line of info) console.log(`INFO: ${line}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nCHARACTER RELEASE LOCK FAILED with ${failures.length} blocker(s).`);
  console.error('DEPLOYMENT MUST STOP. Preserve the frozen R31 first-five layout and the V2-safe dual-layer R40 candidate.');
  process.exit(1);
}

console.log('\nCHARACTER RELEASE LOCK PASSED — R31 first five remain frozen; dual-layer V2-safe R40 candidate is present for visual confirmation.');
