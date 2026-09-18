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

requireTokens('src/app/games/index.tsx', ['BuklodKingdomMap']);
const map = requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'BUKLOD KINGDOM',
  'A SMALL BEGINNING',
  'A BRIGHTER TOMORROW',
  'COMING SOON',
  'SCRIPTURE GARDEN',
  'BUKLOD CITADEL',
  'EXPLORE THE KINGDOM',
  'stageFor',
  'clearedCount',
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

const language = requireTokens('src/features/games/runtime/BuklodGameLanguage.tsx', [
  "export type BuklodGameLanguage = 'en' | 'tl'",
  'TAGALOG GAME GUIDE',
  'PAANO LARUIN',
]);
for (const gameId of GAME_IDS) {
  if (!language.includes(`'${gameId}'`)) failures.push(`EN/TL guide missing game: ${gameId}`);
}

requireTokens('src/features/games/runtime/BuklodGameVisualFX.tsx', [
  'BuklodGameVisualFX',
  'BuklodGameEntrance',
  'Animated.loop',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.web.tsx', [
  'BuklodGameVisualFX',
  'recordBuklodKingdomPreviewResult',
  'withResultHandler',
  'BuklodGameLanguageControl',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.native.tsx', [
  '@shopify/react-native-skia',
  'BuklodGameVisualFX',
  'recordBuklodKingdomPreviewResult',
  'withResultHandler',
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
requireTokens('src/features/games/runtime/BuklodGameBackdrop.tsx', [
  'getRorkGameMedia',
  "from 'expo-image'",
]);
const rorkMedia = requireTokens('src/features/games/runtime/rorkMedia.ts', [
  'RORK_GAME_MEDIA',
  'r2-pub.rork.com',
  'kingdom/audio',
]);
for (const gameId of GAME_IDS) {
  if (!rorkMedia.includes(`'${gameId}'`)) failures.push(`Rork media mapping missing game: ${gameId}`);
}
requireTokens('src/features/games/runtime/rorkAudio.ts', [
  'createAudioPlayer',
  'useRorkGameAmbience',
  'tryPlayRorkGameFeedback',
  'playRorkSignatureSfx',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.web.tsx', [
  'BuklodGameBackdrop',
  'useRorkGameAmbience',
]);
requireTokens('src/features/games/runtime/BuklodGameStage.native.tsx', [
  'BuklodGameBackdrop',
  'useRorkGameAmbience',
]);
requireTokens('src/features/games/runtime/BuklodGameFeedback.web.ts', [
  'tryPlayRorkGameFeedback',
  'AudioContext',
]);
requireTokens('src/features/games/runtime/BuklodGameFeedback.native.ts', [
  'tryPlayRorkGameFeedback',
  'expo-haptics',
]);
requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'BuklodGameBackdrop',
  'playRorkSignatureSfx',
]);

requireTokens('src/features/games/kingdom/progress.ts', [
  'recordBuklodKingdomPreviewResult',
  'bestScore',
  'bestStars',
  'clears',
]);

for (const gameId of GAME_IDS) {
  if (!exists(`src/app/games/${gameId}.tsx`)) failures.push(`Missing current game route: /games/${gameId}`);
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
      'Special Character Journey',
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
