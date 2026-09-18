import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];

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

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing Rork integration file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireTokens(rel, tokens) {
  const source = read(rel);
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${rel} missing Rork integration token: ${token}`);
    }
  }
  return source;
}

console.log('BUKLOD RORK HOME + KINGDOM STATIC GATE');
console.log('======================================');

for (const rel of [
  'src/app/personal-home/index.tsx',
  'src/app/personal-home/index.web.tsx',
  'src/app/personal-home/index.native.tsx',
]) {
  requireTokens(rel, [
    'BuklodPersonalHomeE2E',
    'export default BuklodPersonalHomeE2E',
  ]);
}

requireTokens('src/components/home/BuklodPersonalHomeE2E.tsx', [
  'BuklodRorkHomeAtlas',
  'BuklodSpatialHomeV2',
  "useState<'house' | 'details'>('house')",
]);

const atlas = requireTokens('src/components/home/BuklodRorkHomeAtlas.tsx', [
  'BuklodActiveCharacterArt',
  "route: '/profile/buklod-classrooms'",
  "route: '/igpat'",
  "route: '/personal-home/recipe'",
  "route: '/points'",
  "route: '/personal-home/budget'",
  "route: '/bayanihan'",
  "route: '/city'",
  'Open full Home details & tools',
]);
for (const forbidden of ['supabase', '.rpc(', 'fetch(', 'axios', 'createClient(']) {
  if (atlas.includes(forbidden)) {
    failures.push(`Rork Home atlas must remain presentation/navigation only; found forbidden token: ${forbidden}`);
  }
}

const registry = read('src/features/games/registry.ts');
const media = requireTokens('src/features/games/runtime/rorkMedia.ts', [
  'RORK_GAME_MEDIA',
  'kingdom/audio',
  'kingdom/bg',
]);
for (const gameId of GAME_IDS) {
  if (!registry.includes(`'${gameId}'`)) failures.push(`Canonical game registry missing: ${gameId}`);
  if (!media.includes(`'${gameId}'`)) failures.push(`Rork media map missing canonical game: ${gameId}`);
  const route = path.join(root, 'src', 'app', 'games', `${gameId}.tsx`);
  if (!fs.existsSync(route)) failures.push(`Canonical game route missing: /games/${gameId}`);
}

requireTokens('src/features/games/runtime/BuklodGameBackdrop.tsx', [
  "from 'expo-image'",
  'getRorkGameMedia',
  'Animated.loop',
]);
requireTokens('src/features/games/runtime/rorkAudio.ts', [
  "from 'expo-audio'",
  'tryPlayRorkGameFeedback',
  'playRorkSignatureSfx',
  'useRorkGameAmbience',
  'voiceCount',
  'cooldownMs',
]);
for (const rel of [
  'src/features/games/runtime/BuklodGameStage.web.tsx',
  'src/features/games/runtime/BuklodGameStage.native.tsx',
]) {
  requireTokens(rel, [
    'BuklodGameBackdrop',
    'useRorkGameAmbience',
    'recordBuklodKingdomPreviewResult',
    'withResultHandler',
    'BuklodGameLanguageControl',
  ]);
}
requireTokens('src/features/games/runtime/BuklodGameFeedback.web.ts', [
  'tryPlayRorkGameFeedback',
  'AudioContext',
  "case 'collect'",
  "case 'impact'",
  "case 'success'",
  "case 'failure'",
]);
requireTokens('src/features/games/runtime/BuklodGameFeedback.native.ts', [
  'tryPlayRorkGameFeedback',
  'buklod-reaction.wav',
  'buklod-points-claim.wav',
  'expo-haptics',
]);
requireTokens('src/features/games/kingdom/BuklodKingdomMap.tsx', [
  'BuklodGameBackdrop',
  'playRorkSignatureSfx',
  'loadBuklodKingdomPreviewProgress',
  'subscribeBuklodKingdomPreviewProgress',
]);

try {
  let base = 'main';
  try {
    execFileSync('git', ['rev-parse', '--verify', 'main'], { cwd: root, stdio: 'ignore' });
  } catch {
    base = 'origin/main';
  }
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const forbiddenPrefixes = [
    'supabase/',
    'android/',
    'ios/',
    'functions/',
  ];
  const forbiddenExact = new Set([
    'app.config.js',
    'app.config.ts',
    'app.json',
    'eas.json',
    'package-lock.json',
  ]);

  for (const rel of changed) {
    if (forbiddenExact.has(rel) || forbiddenPrefixes.some((prefix) => rel.startsWith(prefix))) {
      failures.push(`Protected backend/native/release surface changed in Rork integration branch: ${rel}`);
    }
  }
} catch (error) {
  failures.push(`Could not verify Rork branch scope with git diff: ${error instanceof Error ? error.message : String(error)}`);
}

for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nRORK STATIC GATE FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nRORK STATIC GATE PASSED.');
console.log('Home presentation, 13-game mapping, shared runtime, fallback feedback and branch scope are intact.');
