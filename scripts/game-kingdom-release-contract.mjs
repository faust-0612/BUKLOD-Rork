import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const args = process.argv.slice(2);
const distIndex = args.indexOf('--dist');
const distDir = distIndex >= 0 ? path.resolve(ROOT, args[distIndex + 1] || 'dist') : null;

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

const INTERNAL_GAME_FILES = {
  'jawo-forest-trail': 'src/features/games/jawo/ForestTrailGameV2.tsx',
  'trudice-playground-memory': 'src/features/games/trudice/PlaygroundPathGameV2.tsx',
  'ace-rescue-grid': 'src/features/games/ace/RescueGridGameV1.tsx',
  'mitch-restore-mural': 'src/features/games/mitch/RestoreMuralGameV1.tsx',
  'niel-mission-trail': 'src/features/games/niel/MissionTrailGameV1.tsx',
  'angel-kingdom-treasury': 'src/features/games/angel/KingdomTreasuryGameV1.tsx',
  'vhen-farm-to-market': 'src/features/games/vhen/FarmToMarketGameV1.tsx',
  'elesur-village-builder': 'src/features/games/elesur/VillageBuilderGameV1.tsx',
  'phan-enterprise-builder': 'src/features/games/phan/EnterpriseBuilderGameV1.tsx',
  'van-living-city-dispatch': 'src/features/games/van/LivingCityDispatchGameV1.tsx',
  'christian-civic-leadership': 'src/features/games/christian/CivicLeadershipGameV1.tsx',
  'lhen-rhythm-journey': 'src/features/games/lhen/RhythmJourneyGameV1.tsx',
  'quin-discovery-expedition': 'src/features/games/quin/DiscoveryExpeditionGameV1.tsx',
};

const STALE_PROTOTYPE_COPY = [
  'once Kingdom persistence is connected',
  'Later, this clear can permanently',
  'Later this can unlock',
  'can later become a permanent visual upgrade',
  'Later, this result can permanently',
  'audio stems plug into this same timing grid later',
  'Final music stems and Lhen animation can synchronize',
];

function absolute(rel) { return path.join(ROOT, rel); }
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

console.log('BUKLOD KINGDOM GAME RELEASE CONTRACT');
console.log('====================================');

const registry = requireTokens('src/features/games/registry.ts', GAME_IDS);
if ((registry.match(/replayable:\s*true/g) || []).length < 13) {
  failures.push('Game registry no longer exposes 13 replayable current stations.');
}

requireTokens('src/app/games/index.tsx', [
  'BuklodKingdomMap',
  'setBuklodKingdomProgressOwner',
]);

const map = requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'BUKLOD_KINGDOM_ILLUSTRATED_MAP_R2',
  'BUKLOD KINGDOM',
  'WORLD → REGION / BIOME → CHARACTER STATION → GAME',
  'A SMALL BEGINNING',
  'STRONGER TOGETHER',
  'A GROWING KINGDOM',
  'A BRIGHTER TOMORROW',
  'COMING SOON',
  'SCRIPTURE GARDEN',
  'KINGDOM CITADEL',
  'Major hub • never the ending',
  'EXPLORE THE KINGDOM',
  'BuklodKingdomAtmosphere',
  'BuklodKingdomAdminQa',
  'playBuklodGameFeedback',
  'stageFor',
  'clearedCount',
]);
for (const gameId of GAME_IDS) {
  if (!map.includes(gameId)) failures.push(`Kingdom Map missing station: ${gameId}`);
}

requireTokens('src/features/games/kingdom/BuklodKingdomAtmosphere.tsx', [
  'Animated.loop',
  'DriftingCloud',
  'waterShimmer',
]);

requireTokens('src/features/games/kingdom/BuklodKingdomAdminQa.tsx', [
  'BUKLOD_KINGDOM_SYSTEM_ADMIN_QA_R1',
  'SYSTEM ADMIN QA',
  "hasRole('system_admin')",
  'resetBuklodKingdomPreviewProgress',
]);

requireTokens('src/components/BuklodPublicWordShortcut.tsx', [
  'BUKLOD_KINGDOM_HOME_DOOR_R1',
  'BUKLOD_KINGDOM_PREMIUM_DOOR_R2',
  'BUKLOD KINGDOM',
  'EXPLORE • PLAY • GROW',
  "router.push('/games'",
]);

const language = requireTokens('src/features/games/runtime/BuklodGameLanguage.tsx', [
  "export type BuklodGameLanguage = 'en' | 'tl'",
  'TAGALOG GAME GUIDE',
  'PAANO LARUIN',
]);
for (const gameId of GAME_IDS) {
  if (!language.includes(`'${gameId}'`)) failures.push(`EN/TL guide missing game: ${gameId}`);
}

for (const [gameId, componentFile] of Object.entries(INTERNAL_GAME_FILES)) {
  const component = requireTokens(componentFile, [
    'useBuklodGameLanguage',
    'playBuklodGameFeedback',
    'onFinish?.',
    'gameId: GAME_ID',
  ]);

  if (!component.includes('language') || !component.includes('t(')) {
    failures.push(`${componentFile} must render actual internal gameplay UI through the shared EN/TL language context.`);
  }

  for (const staleCopy of STALE_PROTOTYPE_COPY) {
    if (component.includes(staleCopy)) {
      failures.push(`${componentFile} still contains stale prototype/future copy: ${staleCopy}`);
    }
  }

  if (!component.includes('Kingdom station progress') && !component.includes('Kingdom Map')) {
    failures.push(`${componentFile} must describe current recorded Kingdom progress instead of future persistence.`);
  }

  if (!GAME_IDS.includes(gameId)) {
    failures.push(`Internal game contract contains unknown game id: ${gameId}`);
  }
}

if (Object.keys(INTERNAL_GAME_FILES).length !== GAME_IDS.length) {
  failures.push('Internal gameplay EN/TL contract must cover exactly all 13 current games.');
}

requireTokens('src/features/games/runtime/BuklodGameVisualFX.tsx', [
  'BuklodGameVisualFX',
  'BuklodGameEntrance',
  'Animated.loop',
]);
requireTokens('src/features/games/runtime/BuklodGameChrome.tsx', [
  'BUKLOD_KINGDOM_PREMIUM_GAME_CHROME_R1',
  'MISSION COMPLETE',
  'VIEW KINGDOM',
  'KEEP PLAYING',
  'KINGDOM XP',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.web.tsx', [
  'BuklodGameVisualFX',
  'BuklodGameChrome',
  'recordBuklodKingdomPreviewResult',
  'setBuklodKingdomProgressOwner',
  'useEffect',
  'withResultHandler',
  'props?.children',
  'BuklodGameLanguageControl',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.native.tsx', [
  '@shopify/react-native-skia',
  'BuklodGameVisualFX',
  'BuklodGameChrome',
  'recordBuklodKingdomPreviewResult',
  'setBuklodKingdomProgressOwner',
  'useEffect',
  'withResultHandler',
  'props?.children',
  'BuklodGameLanguageControl',
]);
requireTokens('src/features/games/runtime/BuklodGameFeedback.web.ts', [
  'AudioContext',
  "case 'collect'",
  "case 'impact'",
  "case 'success'",
  "case 'failure'",
]);
requireTokens('src/features/games/runtime/BuklodGameFeedback.native.ts', [
  'createAudioPlayer',
  'buklod-reaction.wav',
  'buklod-points-claim.wav',
  'expo-haptics',
]);
requireTokens('src/features/games/kingdom/progress.ts', [
  'STORAGE_PREFIX',
  'setBuklodKingdomProgressOwner',
  'recordBuklodKingdomPreviewResult',
  'resetBuklodKingdomPreviewProgress',
  'bestScore',
  'bestStars',
  'clears',
  'DUPLICATE_RESULT_WINDOW_MS',
]);
requireTokens('scripts/RUN_KINGDOM_LOCALHOST.ps1', [
  'VERIFIED LOCALHOST PREVIEW',
  'NO EAS DEPLOY / NO PRODUCTION PROMOTION',
  'kingdom-native-readiness.mjs',
]);
requireTokens('scripts/kingdom-native-readiness.mjs', [
  'BUKLOD KINGDOM NATIVE READINESS',
  '@shopify/react-native-skia',
  'expo-audio',
  'expo-haptics',
]);

for (const gameId of GAME_IDS) {
  const route = `src/app/games/${gameId}.tsx`;
  if (!exists(route)) {
    failures.push(`Missing current game route: /games/${gameId}`);
    continue;
  }

  const routeText = read(route);
  if (!routeText.includes('<BuklodGameStage')) {
    failures.push(`${route} must render through BuklodGameStage.`);
  }
  if (!routeText.includes('gameId={GAME_ID}')) {
    failures.push(`${route} must pass its exact GAME_ID to BuklodGameStage.`);
  }
  if (routeText.includes('recordBuklodKingdomPreviewResult')) {
    failures.push(`${route} must not persist Kingdom progress directly; BuklodGameStage is the canonical recorder.`);
  }
  if (/onFinish\s*=/.test(routeText)) {
    failures.push(`${route} must not own a route-level onFinish callback; completion is injected by BuklodGameStage.`);
  }
}

if (distDir) {
  if (!fs.existsSync(distDir)) {
    failures.push(`Compiled web directory missing: ${path.relative(ROOT, distDir)}`);
  } else {
    const compiled = walk(distDir)
      .filter((file) => /\.(?:js|html)$/i.test(file))
      .map((file) => {
        try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
      })
      .join('\n');
    for (const token of [
      'BUKLOD KINGDOM',
      'A BRIGHTER TOMORROW',
      'COMING SOON',
      'TAGALOG GAME GUIDE',
      'PAANO LARUIN',
      'MISSION COMPLETE',
      'VIEW KINGDOM',
      'Special Character Journey',
      'INGAT-YAMAN NG KAHARIAN',
      'PAGLALAKBAY SA RITMO',
    ]) {
      if (!compiled.includes(token)) failures.push(`Compiled bundle missing Kingdom token: ${token}`);
    }
    const gameShell = path.join(distDir, 'games', 'index.html');
    if (!fs.existsSync(gameShell)) failures.push('Compiled web artifact is missing dist/games/index.html.');
    for (const gameId of GAME_IDS) {
      const routeShell = path.join(distDir, 'games', gameId, 'index.html');
      if (!fs.existsSync(routeShell)) failures.push(`Compiled web artifact missing route shell: /games/${gameId}`);
    }
  }
}

for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nKINGDOM GAME RELEASE LOCK FAILED with ${failures.length} blocker(s).`);
  console.error('DEPLOYMENT MUST STOP. Forward-restore the protected Kingdom/Game layer before publishing.');
  process.exit(1);
}

console.log('\nKINGDOM GAME RELEASE LOCK PASSED.');
