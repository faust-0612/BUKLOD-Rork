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
 * BUKLOD CHARACTER VISUAL + GATING LOCK — 2026-09-14
 *
 * R31 remains protected. R42 explicitly approves previews of all Special
 * identities while server-authoritative Circle Rank still gates activation.
 *
 * Git blob identity is checked instead of hashing working-tree text so Windows
 * CRLF conversion cannot create false failures.
 */
const LOCKED_VISUAL_BLOBS = {
  'src/components/points/BuklodProgressiveCharacterSelector.tsx': 'f94af7e2f6d20246c9c9fe983b06240ae50599ba',
  'src/components/points/BuklodCharacterCustomizeSheet.tsx': '8aa1a4dfdad33ba9aca7a07a32560765160fb176',
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
    failures.push(`Missing required R31/R40 file: ${rel}`);
    return false;
  }
  return true;
}

function read(rel) {
  if (!mustExist(rel)) return '';
  return fs.readFileSync(full(rel), 'utf8');
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
    if (text.includes(token)) failures.push(`${rel} contains forbidden alternate-layout token: ${token}`);
  }
  return text;
}

function requireOneOf(rel, alternatives, label) {
  const text = read(rel);
  if (!alternatives.some((token) => text.includes(token))) {
    failures.push(`${rel} is missing ${label}: expected one of ${alternatives.join(', ')}`);
  }
}

function trackedGitBlobSha(rel) {
  try {
    return execFileSync('git', ['rev-parse', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().toLowerCase();
  } catch (error) {
    failures.push(`Could not read tracked Git blob for locked Character file: ${rel}`);
    return '';
  }
}

function lockedPathIsDirty(rel) {
  const unstaged = spawnSync('git', ['diff', '--quiet', '--', rel], { cwd: ROOT });
  const staged = spawnSync('git', ['diff', '--cached', '--quiet', '--', rel], { cwd: ROOT });
  return unstaged.status !== 0 || staged.status !== 0;
}

function enforceExactVisualLock() {
  for (const [rel, expected] of Object.entries(LOCKED_VISUAL_BLOBS)) {
    if (!mustExist(rel)) continue;
    const actual = trackedGitBlobSha(rel);
    if (actual && actual !== expected.toLowerCase()) {
      failures.push(`CHARACTER VISUAL/GATING LOCK CHANGED: ${rel} expected=${expected} actual=${actual}. Review and explicitly re-baseline the Character contract before release.`);
    }
    if (lockedPathIsDirty(rel)) {
      failures.push(`CHARACTER VISUAL/GATING LOCK has local/staged edits: ${rel}. Commit or restore the canonical Character surface before release.`);
    }
    if (actual === expected.toLowerCase()) info.push(`Locked Character blob OK: ${rel} @ ${actual}`);
  }
}

function sha256(rel) {
  const buffer = fs.readFileSync(full(rel));
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
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

console.log('BUKLOD CHARACTER RELEASE CONTRACT — R31 + R40 CANONICAL');
console.log('========================================================');
console.log('LOCK POLICY: locked Special identities may be previewed; activation and rewards remain server-gated.');

enforceExactVisualLock();

const r31 = requireTokens('src/components/points/BuklodProgressiveCharacterSelector.tsx', [
  'BUKLOD_CHARACTER_R31_APPROVED_LAYOUT',
  'Choose Your BUKLOD Character',
  'LEVEL 1-20 PROGRESSION',
  'COLLECTIBLES -',
  'Browse all 20 levels',
  'Use This Character',
  'nestedScrollEnabled',
  'state.character_level',
  'state.character_points_since_selection',
]);
if (/levelForPoints\s*\(\s*lifetimePoints\s*\)/.test(r31)) {
  failures.push('R31 legacy lifetime-points transferable Character leveling returned. V2/server Character level must remain authoritative.');
}
if (/lifetimePoints\s*[:=]/.test(r31)) {
  failures.push('R31 selector regained lifetimePoints as a progression authority/input. Layout may use V2 state only.');
}

requireTokens('src/lib/buklodProgressiveCharacter.ts', [
  'PROGRESSIVE_LEVEL_THRESHOLDS',
  'collectibleNames',
  'loadProgressiveCharacter',
  'saveProgressiveCharacter',
  'setMyBuklodCharacterActiveV2',
  'ProgressiveCharacterId',
  'loadProgressiveShowcase',
  'subscribeProgressiveShowcase',
]);
mustExist('src/components/points/BuklodProgressiveCharacterArt.tsx');
mustExist('src/components/points/BuklodProfileCharacterCard.tsx');

requireTokens('src/components/points/BuklodCharacterCustomizeSheet.tsx', [
  'BUKLOD_CHARACTER_R31_R40_LAYOUT_HOST_LOCK_V3',
  'BuklodProgressiveCharacterSelector',
  'BuklodSpecialCharacterSeries',
  'nestedScrollEnabled',
  'getMyBuklodCharacterSelectionV2',
]);

const r40 = requireTokens('src/components/points/BuklodSpecialCharacterSeries.tsx', [
  'BUKLOD_SPECIAL_BATCH1_R40_PREMIUM_UI',
  'SPECIAL_ORDER',
  'Special Character Journey',
  'Special Characters appear only when your Circle Rank unlocks them.',
  'More than a character. A mission.',
  'LEVEL 1 - 20 JOURNEY',
  'COLLECTIBLES & BADGES',
  'VIEW ALL LEVELS',
  'VIEW ALL COLLECTIBLES',
  'LOCKED',
  'nestedScrollEnabled',
  'visible_special_character_ids',
  'setMyBuklodCharacterActiveV2',
  'get_my_buklod_special_collectibles_v2',
  'ACE',
  'MITCH',
  'NIEL',
  'ANGEL',
  'VHEN',
  'TRUDICE',
]);
if (r40.includes("rpc('set_my_buklod_special_character_active_v1'")) {
  failures.push('Legacy R40 active-character RPC is authoritative again. Activation must use setMyBuklodCharacterActiveV2.');
}
if (!r40.includes('return SPECIAL_ORDER;') || !r40.includes('railIds.map(')) {
  failures.push('R42 must show all Special identities in the preview rail.');
}
if (!r40.includes('setMyBuklodCharacterActiveV2') ||
    !r40.includes('if (!userId || active || using || !selectedUnlocked)')) {
  failures.push('R42 must preserve locked activation gating before the server RPC.');
}
forbidTokens('src/components/points/BuklodSpecialCharacterSeries.tsx', [
  'BUKLOD_CHARACTER_R41',
  'Character Passport Preview',
  'BuklodSpecialSeriesOne',
]);
requireOneOf('src/components/points/BuklodSpecialCharacterSeries.tsx', ['JAVVO', 'JAWO', 'Jawo'], 'Jawo identity');
requireOneOf('src/components/points/BuklodSpecialCharacterSeries.tsx', ['ELLUSUR', 'ELESUR'], 'ELESUR identity');

const registry = requireTokens('src/lib/buklodSpecialCharacterAssets.ts', ['ace_hero.jpg']);
for (const id of SPECIAL_IDS) {
  if (!registry.includes(`${id}_hero.jpg`)) failures.push(`R40 registry is missing ${id}_hero.jpg`);
  for (let level = 1; level <= 20; level += 1) {
    const suffix = String(level).padStart(2, '0');
    if (!registry.includes(`${id}_level_${suffix}.jpg`)) failures.push(`R40 registry is missing ${id}_level_${suffix}.jpg`);
  }
}

for (const [rel, expected] of Object.entries(CORE_ASSETS)) {
  if (!mustExist(rel)) continue;
  const actual = sha256(rel);
  if (actual !== expected) failures.push(`R31 core art changed: ${rel} expected=${expected} actual=${actual}`);
}

const specialRoot = full('assets/images/characters/special/batch1');
if (!fs.existsSync(specialRoot)) {
  failures.push('Missing R40 special asset folder: assets/images/characters/special/batch1');
} else {
  const jpgs = walk(specialRoot).filter((file) => /\.jpg$/i.test(file));
  if (jpgs.length < 168) failures.push(`R40 special asset set incomplete: found ${jpgs.length}, expected at least 168.`);
  for (const id of SPECIAL_IDS) {
    const hero = path.join(specialRoot, `${id}_hero.jpg`);
    if (!fs.existsSync(hero)) failures.push(`Missing R40 hero asset: ${path.relative(ROOT, hero)}`);
    for (let level = 1; level <= 20; level += 1) {
      const suffix = String(level).padStart(2, '0');
      const file = path.join(specialRoot, `${id}_level_${suffix}.jpg`);
      if (!fs.existsSync(file)) failures.push(`Missing R40 level asset: ${path.relative(ROOT, file)}`);
    }
  }
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
      'Choose Your BUKLOD Character',
      'LEVEL 1-20 PROGRESSION',
      'COLLECTIBLES -',
      'Use This Character',
      'Special Character Journey',
      'Special Characters appear only when your Circle Rank unlocks them.',
      'More than a character. A mission.',
      'LEVEL 1 - 20 JOURNEY',
      'COLLECTIBLES & BADGES',
      'VIEW ALL LEVELS',
      'VIEW ALL COLLECTIBLES',
      'get_my_buklod_special_collectibles_v2',
    ]) {
      if (!compiled.includes(token)) failures.push(`Compiled bundle is missing canonical R31/R40 layout token: ${token}`);
    }
    if (compiled.includes('NEXT TO UNLOCK')) {
      failures.push('Compiled bundle exposes a locked Special Character identity preview.');
    }
    if (!(compiled.includes('JAVVO') || compiled.includes('JAWO') || compiled.includes('Jawo'))) {
      failures.push('Compiled bundle is missing Jawo special-character identity.');
    }
    if (!(compiled.includes('ELLUSUR') || compiled.includes('ELESUR'))) {
      failures.push('Compiled bundle is missing ELESUR special-character identity.');
    }
    info.push(`Compiled bundle checked: ${path.relative(ROOT, distDir)}`);
  }
}

for (const line of info) console.log(`INFO: ${line}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nCHARACTER RELEASE LOCK FAILED with ${failures.length} blocker(s).`);
  console.error('DEPLOYMENT MUST STOP. Restore the canonical R31 + R40 Character presentation and hidden-Special gating before publishing.');
  process.exit(1);
}

console.log('\nCHARACTER RELEASE LOCK PASSED — R31 visuals, R40 unlocked presentation, hidden locked Special identities, badges surface, and assets are preserved.');