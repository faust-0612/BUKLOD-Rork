import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const info = [];

const args = process.argv.slice(2);
const distIndex = args.indexOf('--dist');
const distDir = distIndex >= 0 ? path.resolve(ROOT, args[distIndex + 1] || 'dist') : null;

// EXACT visual source approved/locked on 2026-09-13.
// Any byte-level change requires an explicit new Character unlock/revision phase.
const LOCKED_VISUAL_BLOBS = {
  'src/components/points/BuklodCharacterCustomizeSheet.tsx': '9d3e8264e80654330cfa692def167cd26b9f1b91',
  'src/components/points/BuklodProgressiveCharacterSelector.tsx': '685f4b16dfa5bf8ced3be1296565c4493c092dbd',
  'src/components/points/BuklodSpecialCharacterSeries.tsx': 'df742294795aeb58a9651fd8514983d8cf8411a8',
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

function sha256(rel) {
  const buffer = fs.readFileSync(full(rel));
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function gitBlobSha(rel) {
  const buffer = fs.readFileSync(full(rel));
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${rel} is missing required contract token: ${token}`);
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

for (const [rel, expected] of Object.entries(LOCKED_VISUAL_BLOBS)) {
  if (!mustExist(rel)) continue;
  const actual = gitBlobSha(rel);
  if (actual !== expected) {
    failures.push(`LOCKED CHARACTER VISUAL CHANGED: ${rel} expected_blob=${expected} actual_blob=${actual}`);
  }
}
info.push('Exact 2026-09-13 R31/R40 visual source lock checked.');

const selector = requireTokens('src/components/points/BuklodProgressiveCharacterSelector.tsx', [
  'Browse all 20 levels',
  'Use This Character',
  'state.character_level',
  'starts at Level 1',
]);
if (/levelForPoints\s*\(\s*lifetimePoints\s*\)/.test(selector)) {
  failures.push('Legacy transferable lifetime-points Character leveling returned in locked R31 selector.');
}

requireTokens('src/components/points/BuklodCharacterCustomizeSheet.tsx', [
  'BuklodProgressiveCharacterSelector',
  'BuklodSpecialCharacterSeries',
  'getMyBuklodCharacterSelectionV2',
  'subscribeBuklodCharacterSelectionV2',
]);

const r40 = requireTokens('src/components/points/BuklodSpecialCharacterSeries.tsx', [
  'Special Character Journey',
  'visible_special_character_ids',
  'setMyBuklodCharacterActiveV2',
  'get_my_buklod_special_collectibles_v2',
  'set_my_buklod_special_character_pursuit_v1',
]);
if (r40.includes("rpc('set_my_buklod_special_character_active_v1'")) {
  failures.push('Legacy R40 active-character RPC became authoritative again.');
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
    for (const token of ['Browse all 20 levels', 'Use This Character', 'Special Character Journey', 'get_my_buklod_special_collectibles_v2']) {
      if (!compiled.includes(token)) failures.push(`Compiled bundle is missing locked R31/R40 token: ${token}`);
    }
    info.push(`Compiled bundle checked: ${path.relative(ROOT, distDir)}`);
  }
}

for (const line of info) console.log(`INFO: ${line}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nCHARACTER RELEASE LOCK FAILED with ${failures.length} blocker(s).`);
  console.error('DEPLOYMENT MUST STOP. The exact locked R31/R40 visual source may not be changed or overlaid.');
  process.exit(1);
}

console.log('\nCHARACTER RELEASE LOCK PASSED — exact 2026-09-13 R31/R40 visual source + V2 authority are preserved.');
