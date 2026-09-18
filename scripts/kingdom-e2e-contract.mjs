import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const args = process.argv.slice(2);
const distIndex = args.indexOf('--dist');
const distDir = distIndex >= 0 ? path.resolve(ROOT, args[distIndex + 1] || 'dist') : null;
const TICK = String.fromCharCode(96);

const GAME_IDS = [
  'jawo-forest-trail',
  'trudice-playground-memory',
  'ace-rescue-grid',
  'mitch-restore-mural',
  'niel-mission-trail',
  'angel-kingdom-treasury',
  'vhen-farm-to-market',
  'elesur-village-builder',
  'phan-enterprise-builder',
  'van-living-city-dispatch',
  'christian-civic-leadership',
  'lhen-rhythm-journey',
  'quin-discovery-expedition',
];

const GAME_COMPONENTS = [
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

function abs(rel) { return path.join(ROOT, rel); }
function exists(rel) {
  if (!fs.existsSync(abs(rel))) {
    failures.push('Missing Kingdom E2E file: ' + rel);
    return false;
  }
  return true;
}
function read(rel) {
  return exists(rel) ? fs.readFileSync(abs(rel), 'utf8') : '';
}
function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(rel + ' missing required token: ' + token);
  }
  return text;
}
function rejectTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) failures.push(rel + ' contains obsolete/unsafe token: ' + token);
  }
  return text;
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const item = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(item));
    else out.push(item);
  }
  return out;
}

console.log('BUKLOD KINGDOM E2E CONTRACT R1');
console.log('===============================');

const registry = requireTokens('src/features/games/registry.ts', GAME_IDS);
if ((registry.match(/replayable:\\s*true/g) || []).length < 13) {
  failures.push('Registry no longer exposes 13 replayable Kingdom games.');
}

for (const gameId of GAME_IDS) {
  const route = 'src/app/games/' + gameId + '.tsx';
  const routeText = read(route);
  if (routeText.includes('recordBuklodKingdomPreviewResult')) {
    failures.push(route + ' still submits through the obsolete per-route preview recorder.');
  }
  if (!routeText.includes('BuklodGameStage')) {
    failures.push(route + ' is not wrapped by the shared Kingdom stage.');
  }
}

for (const rel of GAME_COMPONENTS) {
  const text = requireTokens(rel, ['BuklodGameText as Text', 'useBuklodKingdomLevel']);
  if (/import\\s*\\{[^}]*\\bText\\b[^}]*\\}\\s*from\\s*['"]react-native['"]/s.test(text)) {
    failures.push(rel + ' bypasses the shared EN/TL Text renderer.');
  }
}

const progress = requireTokens('src/features/games/kingdom/progress.ts', [
  'buklod.kingdom.progress.v2',
  'buklod.kingdom.pending-results.v1',
  "rpc('get_my_buklod_kingdom_v1'",
  "rpc('submit_my_buklod_kingdom_result_v1'",
  'flushPendingQueue',
  'pendingResults',
  'serverBacked',
  'currentLevel',
  'worldTier',
]);
if (progress.includes('buklod.kingdom.preview.progress.v1')) {
  failures.push('Legacy local-only Kingdom preview storage is still active.');
}

for (const rel of [
  'src/features/games/runtime/BuklodGameStage.web.tsx',
  'src/features/games/runtime/BuklodGameStage.native.tsx',
]) {
  requireTokens(rel, [
    'useBuklodGameKingdomRuntime',
    'BuklodKingdomLevelProvider',
    'BuklodGameProgressHud',
    'kingdom.submitResult',
    'kingdom.canPlay',
  ]);
  rejectTokens(rel, ['recordBuklodKingdomPreviewResult']);
}

requireTokens('src/features/games/runtime/BuklodGameKingdomRuntime.ts', [
  'difficulty',
  'speedMultiplier',
  'targetMultiplier',
  'resourceMultiplier',
  'station.unlocked',
  'submitResult',
]);

requireTokens('src/features/games/runtime/BuklodGameLevelContext.tsx', [
  'BuklodKingdomLevelProvider',
  'useBuklodKingdomLevel',
  'level: 1',
]);

const language = requireTokens('src/features/games/runtime/BuklodGameLanguage.tsx', [
  "export type BuklodGameLanguage = 'en' | 'tl'",
  'BuklodGameText',
  'translateBuklodGameText',
  'translateDynamicTagalog',
  'PAANO LARUIN',
  'NAGKAISANG KAHARIAN',
  'HANGGANAN NG MISYON',
]);
for (const gameId of GAME_IDS) {
  if (!language.includes("'" + gameId + "'")) failures.push('Language guide missing game: ' + gameId);
}
if (language.includes('=> \\' + TICK) || language.includes('\\\\\\d+')) {
  failures.push('Language translator contains escaped template/regex syntax from an earlier generated patch.');
}

const map = requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'KINGDOM UNITED',
  'progress.clearedRegions',
  'progress.kingdomXp',
  'progress.masteredRegions',
  'state?.unlocked',
  'state?.currentLevel',
  'state?.worldTier',
  'disabled={!unlocked}',
  'href="/games/training-grounds"',
  'href="/igpat"',
  'href="/mentor"',
  'BuklodGameLanguageProvider',
]);
for (const gameId of GAME_IDS) {
  if (!map.includes(gameId)) failures.push('Kingdom Map missing canonical station: ' + gameId);
}

requireTokens('src/app/games/training-grounds.tsx', [
  'TrainingGroundsContent',
  'progress.landmarks.trainingGrounds',
  'station.currentLevel',
  'station.clearedLevels',
  'station.worldTier',
  'router.push',
  'station.gameId',
]);

const migration = requireTokens('supabase/migrations/20260918213000_buklod_kingdom_e2e_v1.sql', [
  'private.buklod_kingdom_level_progress_v1',
  'private.buklod_kingdom_wallet_v1',
  'private.buklod_kingdom_collectibles_v1',
  'private.buklod_kingdom_result_events_v1',
  'public.get_my_buklod_kingdom_v1',
  'public.submit_my_buklod_kingdom_result_v1',
  'pg_advisory_xact_lock',
  'first_cleared_at',
  'kingdom_xp_awarded',
  'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
  'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
  "when 'jawo-forest-trail' then 3",
  "when 'elesur-village-builder' then 17",
]);
for (const gameId of GAME_IDS) {
  if (!migration.includes("'" + gameId + "'")) failures.push('Backend progression migration missing game: ' + gameId);
}

requireTokens('src/features/games/runtime/BuklodGameProgressHud.tsx', [
  'LEVEL CLEAR SAVED',
  'BEST RUN UPDATED',
  'NEW COLLECTIBLE',
  'PENDING SYNC',
]);

if (distDir) {
  if (!fs.existsSync(distDir)) {
    failures.push('Compiled web directory missing: ' + path.relative(ROOT, distDir));
  } else {
    const compiled = walk(distDir)
      .filter((file) => /\\.(?:js|html)$/i.test(file))
      .map((file) => {
        try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
      })
      .join('\\n');

    const requiredCompiled = [
      'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
      'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
      'KINGDOM UNITED',
      'TRAINING GROUNDS',
      'PAANO LARUIN',
      ...GAME_IDS,
    ];
    for (const token of requiredCompiled) {
      if (!compiled.includes(token)) failures.push('Compiled bundle missing Kingdom E2E token: ' + token);
    }

    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      failures.push('Compiled web artifact is missing index.html.');
    }
  }
}

for (const failure of failures) console.error('FAIL: ' + failure);
if (failures.length) {
  console.error('\\nKINGDOM E2E CONTRACT FAILED with ' + failures.length + ' blocker(s).');
  console.error('DEPLOYMENT MUST STOP. Do not merge or publish until every blocker is resolved.');
  process.exit(1);
}

console.log('13/13 games: shared EN/TL renderer + Level 1-20 context');
console.log('Server progression: RPC + offline queue + non-farmable first-clear XP');
console.log('Map: rank gates + world tiers + Stage 5 + functional landmarks');
console.log('KINGDOM E2E CONTRACT PASSED.');
