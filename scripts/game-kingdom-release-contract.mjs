import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const args = process.argv.slice(2);
const distIndex = args.indexOf('--dist');
const distDir = distIndex >= 0 ? path.resolve(ROOT, args[distIndex + 1] || 'dist') : null;
const webOutputIndex = args.indexOf('--web-output');
const webOutputMode = webOutputIndex >= 0
  ? String(args[webOutputIndex + 1] || '').trim().toLowerCase()
  : 'single';

if (!['single', 'static'].includes(webOutputMode)) {
  failures.push(`Unsupported --web-output mode: ${webOutputMode || '(empty)'}`);
}

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

function absolute(rel) {
  return path.join(ROOT, rel);
}

function exists(rel) {
  if (!fs.existsSync(absolute(rel))) {
    failures.push(`Missing Kingdom release file: ${rel}`);
    return false;
  }
  return true;
}

function read(rel) {
  return exists(rel) ? fs.readFileSync(absolute(rel), 'utf8') : '';
}

function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${rel} missing required Kingdom token: ${token}`);
  }
  return text;
}

function rejectTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) failures.push(`${rel} contains obsolete Kingdom token: ${token}`);
  }
  return text;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(file));
    else output.push(file);
  }
  return output;
}

console.log('BUKLOD KINGDOM GAME RELEASE CONTRACT — E2E R1');
console.log('===============================================');

const registry = requireTokens('src/features/games/registry.ts', GAME_IDS);
if (registry.split('replayable: true').length - 1 < 13) {
  failures.push('Game registry no longer exposes 13 replayable current stations.');
}

requireTokens('src/app/games/index.tsx', ['BuklodKingdomMap']);

const map = requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'KINGDOM UNITED',
  'progress.clearedRegions',
  'progress.kingdomXp',
  'progress.masteredRegions',
  'state?.unlocked',
  'state?.currentLevel',
  'state?.worldTier',
  'WORLD_GROWTH_MARK_POSITIONS',
  'href="/games/training-grounds"',
  'href="/igpat"',
  'href="/mentor"',
]);
for (const gameId of GAME_IDS) {
  if (!map.includes(gameId)) failures.push(`Kingdom Map missing station: ${gameId}`);
}

const homeShortcut = requireTokens('src/components/BuklodPublicWordShortcut.tsx', [
  'BUKLOD_KINGDOM_PROFILE_RELOCATION_R1',
]);
if (homeShortcut.includes('BUKLOD_KINGDOM_HOME_DOOR_R1')) {
  failures.push('Home shortcut still contains the obsolete Kingdom Home door marker.');
}
if (homeShortcut.includes('BUKLOD KINGDOM') || homeShortcut.includes("router.push('/games'")) {
  failures.push('Kingdom door was reintroduced into Home; canonical location is Profile.');
}

requireTokens('src/components/BuklodFoundationWorkspaceNav.tsx', [
  'BUKLOD_KINGDOM_PROFILE_RELOCATION_R1',
  'title="BUKLOD Kingdom"',
  "router.push('/games'",
]);

const progress = requireTokens('src/features/games/kingdom/progress.ts', [
  'buklod.kingdom.progress.v2',
  'buklod.kingdom.pending-results.v1',
  "rpc('get_my_buklod_kingdom_v1'",
  "rpc('submit_my_buklod_kingdom_result_v2'",
  'loadBuklodKingdomLevelDetails',
  'get_my_buklod_kingdom_level_details_v1',
  'isPermanentKingdomSubmissionError',
  'pendingResults',
]);
if (progress.includes('buklod.kingdom.preview.progress.v1')) {
  failures.push('Legacy local-only Kingdom preview storage is still active.');
}

for (const rel of GAME_COMPONENTS) {
  requireTokens(rel, [
    'BuklodGameText as Text',
    'useBuklodKingdomLevel',
  ]);
}

for (const gameId of GAME_IDS) {
  const route = `src/app/games/${gameId}.tsx`;
  requireTokens(route, ['BuklodGameStage']);
  rejectTokens(route, ['recordBuklodKingdomPreviewResult']);
}

for (const rel of [
  'src/features/games/runtime/BuklodGameStage.web.tsx',
  'src/features/games/runtime/BuklodGameStage.native.tsx',
]) {
  requireTokens(rel, [
    'BuklodGameBackdrop',
    'useRorkGameAmbience',
    'useBuklodGameKingdomRuntime',
    'BuklodKingdomLevelProvider',
    'BuklodGameProgressHud',
    'kingdom.submitResult',
    'kingdom.canPlay',
    'BuklodGameLanguageControl',
    'BuklodGameCharacterCompanion',
  ]);
  rejectTokens(rel, ['recordBuklodKingdomPreviewResult']);
}

requireTokens('src/features/games/runtime/BuklodGameKingdomRuntime.ts', [
  'useLocalSearchParams',
  'recordBuklodKingdomResult(result, level)',
  'difficulty',
  'speedMultiplier',
  'targetMultiplier',
  'resourceMultiplier',
]);

requireTokens('src/features/games/runtime/BuklodGameLanguage.tsx', [
  "export type BuklodGameLanguage = 'en' | 'tl'",
  'BuklodGameText',
  'translateBuklodGameText',
  'translateDynamicTagalog',
  'PAANO LARUIN',
  'NAGKAISANG KAHARIAN',
]);

requireTokens('src/app/games/training-grounds.tsx', [
  'loadBuklodKingdomLevelDetails',
  'REPLAY CLEARED LEVELS',
  'detail?.bestStars',
  'params: { level: String(levelNo) }',
]);

requireTokens('src/features/games/runtime/BuklodGameFeedback.web.ts', [
  'AudioContext',
  'tryPlayRorkGameFeedback',
  'emitBuklodGameCharacterMotion',
]);

requireTokens('src/features/games/runtime/BuklodGameFeedback.native.ts', [
  'expo-haptics',
  'tryPlayRorkGameFeedback',
  'buklod-reaction.wav',
  'buklod-points-claim.wav',
  'emitBuklodGameCharacterMotion',
]);

const rorkMedia = requireTokens('src/features/games/runtime/rorkMedia.ts', [
  'RORK_GAME_MEDIA',
  'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/',
]);
for (const gameId of GAME_IDS) {
  if (!rorkMedia.includes(`'${gameId}'`)) failures.push(`Rork media mapping missing game: ${gameId}`);
}
for (const forbidden of [
  'kp3ge50a5t6chyb7gv3jn-web.rork.live/kingdom',
  'RORK_AUDIO',
  'AUDIO_BASE',
]) {
  if (rorkMedia.includes(forbidden)) failures.push(`Rork media still contains remote audio dependency: ${forbidden}`);
}

const rorkAudio = requireTokens('src/features/games/runtime/rorkAudio.ts', [
  'createAudioPlayer',
  'useRorkGameAmbience',
  'tryPlayRorkGameFeedback',
  'playRorkSignatureSfx',
  'ambienceSources',
  'localSfx',
  'buklod-reaction.wav',
  'buklod-points-claim.wav',
  'assets/bible-ambience/sea.wav',
]);
for (const forbidden of [
  'REMOTE_RORK_AUDIO_ENABLED',
  'downloadFirst: true',
  'https://',
]) {
  if (rorkAudio.includes(forbidden)) failures.push(`Kingdom audio must be network-free; found: ${forbidden}`);
}

requireTokens('supabase/migrations/20260918213000_buklod_kingdom_e2e_v1.sql', [
  'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
  'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
  'public.get_my_buklod_kingdom_v1',
]);
requireTokens('supabase/migrations/20260918214500_buklod_kingdom_level_replay_v2.sql', [
  'public.submit_my_buklod_kingdom_result_v2',
  'p_level_no integer default null',
]);
requireTokens('supabase/migrations/20260918215500_buklod_kingdom_e2e_security_hardening_r1.sql', [
  'enable row level security',
  'revoke all on table private.buklod_kingdom_level_progress_v1',
]);
requireTokens('supabase/migrations/20260918220500_buklod_kingdom_level_details_v1.sql', [
  'public.get_my_buklod_kingdom_level_details_v1',
  'generate_series(1,20)',
]);

if (distDir) {
  if (!fs.existsSync(distDir)) {
    failures.push(`Compiled web directory missing: ${path.relative(ROOT, distDir)}`);
  } else {
    const compiled = walk(distDir)
      .filter((file) => /\.(?:js|html)$/i.test(file))
      .map((file) => {
        try {
          return fs.readFileSync(file, 'utf8');
        } catch {
          return '';
        }
      })
      .join('\n');

    for (const token of [
      'KINGDOM UNITED',
      'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
      'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
      'TRAINING GROUNDS',
      'PAANO LARUIN',
      ...GAME_IDS,
    ]) {
      if (!compiled.includes(token)) failures.push(`Compiled bundle missing Kingdom token: ${token}`);
    }

    const rootShell = path.join(distDir, 'index.html');
    if (!fs.existsSync(rootShell)) failures.push('Compiled web artifact is missing dist/index.html.');

    if (webOutputMode === 'static') {
      const gameShell = path.join(distDir, 'games', 'index.html');
      if (!fs.existsSync(gameShell)) failures.push('Compiled static web artifact is missing dist/games/index.html.');
    } else {
      const nestedHtml = walk(distDir).filter((file) => /games[\\/].*index\.html$/i.test(file));
      if (nestedHtml.length > 0) {
        failures.push('Single-output web artifact unexpectedly emitted per-route HTML shells.');
      }
    }
  }
}

for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nKINGDOM GAME RELEASE LOCK FAILED with ${failures.length} blocker(s).`);
  console.error('DEPLOYMENT MUST STOP. Restore the canonical Kingdom E2E layer before publishing.');
  process.exit(1);
}

console.log('\nKINGDOM GAME RELEASE LOCK PASSED.');
console.log('13 regions • Level 1–20 • server progression • EN/TL • local audio • replay-safe economy.');
