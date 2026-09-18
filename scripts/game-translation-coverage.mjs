import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGUAGE_FILE = 'src/features/games/runtime/BuklodGameLanguage.tsx';
const GAME_FILES = [
  'src/features/games/jawo/ForestTrailGameV2.tsx',
  'src/features/games/trudice/PlaygroundPathGameV2.tsx',
  'src/features/games/ace/RescueGridGameV1.tsx',
  'src/features/games/mitch/RestoreMuralGameV1.tsx',
  'src/features/games/niel/MissionTrailGameV1.tsx',
  'src/features/games/angel/KingdomTreasuryGameV1.tsx',
  'src/features/games/vhen/FarmToMarketGameV1.tsx',
  'src/features/games/elesur/VillageBuilderGameV1.tsx',
  'src/features/games/phan/EnterpriseBuilderGameV1.tsx',
  'src/features/games/van/LivingCityDispatchGameV1.tsx',
  'src/features/games/christian/CivicLeadershipGameV1.tsx',
  'src/features/games/lhen/RhythmJourneyGameV1.tsx',
  'src/features/games/quin/DiscoveryExpeditionGameV1.tsx',
];

const failures = [];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

const language = read(LANGUAGE_FILE);
const keys = new Set();

for (const match of language.matchAll(/^\s*'((?:\\'|[^'])+)'\s*:/gm)) {
  keys.add(match[1].replace(/\\'/g, "'"));
}
for (const match of language.matchAll(/^\s*"((?:\\"|[^"])*)"\s*:/gm)) {
  keys.add(match[1].replace(/\\"/g, '"'));
}

function ignoreLiteral(value) {
  const text = value.trim();
  if (!text || text.length < 3) return true;
  if (/^#[0-9a-f]+$/i.test(text) || /^rgba?\(/i.test(text)) return true;
  if (/^[−+-]?\d+(?:\.\d+)?%?$/.test(text)) return true;
  if (/^\/?(?:[A-Za-z0-9_.@-]+\/)+[A-Za-z0-9_.@-]+$/.test(text)) return true;
  if (/^[a-z0-9._-]+$/i.test(text)) return true;
  if (/^(row|column|center|absolute|relative|hidden|visible|flex-start|space-between|nowrap)$/i.test(text)) return true;
  if (/^(won|lost|idle|playing|ready|watch|input|intro|running|result|failed|finished)$/i.test(text)) return true;
  return false;
}

for (const rel of GAME_FILES) {
  const source = read(rel);

  if (!source.includes('BuklodGameText as Text')) {
    failures.push(`${rel} does not route Text through BuklodGameText.`);
  }

  const candidates = new Set();

  for (const match of source.matchAll(/<Text[^>]*>\s*([^<{][^<]*?)\s*<\/Text>/gs)) {
    const value = match[1].replace(/\s+/g, ' ').trim();
    if (!value.includes('{') && !ignoreLiteral(value)) candidates.add(value);
  }

  for (const match of source.matchAll(/\b(?:title|subtitle|label|description|copy|detail|location|feedback|effect|name)\s*:\s*(['"])(.*?)\1/g)) {
    const value = match[2].replace(/\s+/g, ' ').trim();
    if (!ignoreLiteral(value)) candidates.add(value);
  }

  for (const value of candidates) {
    if (!keys.has(value)) {
      failures.push(`${rel} has visible static EN text without a direct TL entry: ${JSON.stringify(value)}`);
    }
  }
}

const requiredHeadings = [
  'JAWO • WHISPERING FOREST',
  'TRUDICE • CHILDREN’S HAVEN',
  'ACE • STRATEGY DISTRICT',
  'MITCH • ART VILLAGE',
  'NIEL • MISSION FRONTIER',
  'ANGEL • KINGDOM TREASURY',
  'VHEN • AGRICULTURAL VALLEY',
  'ELESUR • HIGHLAND COMMUNITY',
  'PHAN • FARMSTEAD TO ENTERPRISE',
  'VAN • THE LIVING CITY',
  'CHRISTIAN • CIVIC ACADEMY',
  'LHEN • MUSIC & MISSION CITY',
  'QUIN • DISCOVERY WORLD',
];

for (const heading of requiredHeadings) {
  if (!keys.has(heading)) failures.push(`Missing required 13-game heading translation: ${heading}`);
}

for (const failure of failures) console.error('FAIL: ' + failure);

if (failures.length) {
  console.error(`\nGAME TRANSLATION COVERAGE FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('13/13 game components use the shared EN/TL Text renderer.');
console.log('Static visible labels/scenario headings have Tagalog entries.');
console.log('GAME TRANSLATION COVERAGE PASSED.');
