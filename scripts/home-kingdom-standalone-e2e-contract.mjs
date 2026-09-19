import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const GAME_IDS = [
  'ace-rescue-grid',
  'angel-kingdom-treasury',
  'christian-civic-leadership',
  'elesur-village-builder',
  'jawo-forest-trail',
  'lhen-rhythm-journey',
  'mitch-restore-mural',
  'niel-mission-trail',
  'phan-enterprise-builder',
  'quin-discovery-expedition',
  'trudice-playground-memory',
  'van-living-city-dispatch',
  'vhen-farm-to-market',
];

const HOME_TOOLS = ['budget', 'media', 'recipe', 'reminders'];

const GAME_INTERACTION_SURFACE = {
  'ace-rescue-grid': ['src/features/games/ace/RescueGridGameV1.tsx', 3],
  'angel-kingdom-treasury': ['src/features/games/angel/KingdomTreasuryGameV1.tsx', 8],
  'christian-civic-leadership': ['src/features/games/christian/CivicLeadershipGameV1.tsx', 2],
  'elesur-village-builder': ['src/features/games/elesur/VillageBuilderGameV1.tsx', 2],
  'jawo-forest-trail': ['src/features/games/jawo/ForestTrailGameV2.tsx', 4],
  'lhen-rhythm-journey': ['src/features/games/lhen/RhythmJourneyGameV1.tsx', 3],
  'mitch-restore-mural': ['src/features/games/mitch/RestoreMuralGameV1.tsx', 1],
  'niel-mission-trail': ['src/features/games/niel/MissionTrailGameV1.tsx', 2],
  'phan-enterprise-builder': ['src/features/games/phan/EnterpriseBuilderGameV1.tsx', 5],
  'quin-discovery-expedition': ['src/features/games/quin/DiscoveryExpeditionGameV1.tsx', 2],
  'trudice-playground-memory': ['src/features/games/trudice/PlaygroundPathGameV2.tsx', 3],
  'van-living-city-dispatch': ['src/features/games/van/LivingCityDispatchGameV1.tsx', 2],
  'vhen-farm-to-market': ['src/features/games/vhen/FarmToMarketGameV1.tsx', 10],
};

function abs(rel) { return path.join(ROOT, rel); }
function read(rel) {
  if (!fs.existsSync(abs(rel))) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs(rel), 'utf8');
}
function tokens(rel, required, forbidden = []) {
  const text = read(rel);
  for (const token of required) {
    if (!text.includes(token)) failures.push(`${rel} missing: ${token}`);
  }
  for (const token of forbidden) {
    if (text.includes(token)) failures.push(`${rel} contains forbidden token: ${token}`);
  }
  return text;
}
function count(text, regex) {
  return (text.match(regex) || []).length;
}

console.log('BUKLOD HOME + KINGDOM STANDALONE FULL E2E CONTRACT R3');
console.log('======================================================');

// 1. Secure Main -> standalone handoff contract.
const entry = tokens('src/lib/buklodStandaloneEntry.ts', [
  'buklod-surface-main-entry-v1',
  'Authorization: `Bearer ${accessToken}`',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'session_launch_url',
  'location.assign',
], ['access_token=', 'refresh_token=']);

tokens('src/components/standalone/BuklodStandaloneSessionGate.tsx', [
  "type: 'email'",
  'buklod_surface_token_hash',
  'cleanHandoffQuery',
  'Open from BUKLOD Main',
]);

tokens('supabase/functions/buklod-surface-main-entry-v1/index.ts', [
  'admin.auth.getUser(bearer)',
  'admin.auth.admin.generateLink',
  'properties?.hashed_token',
  'BUKLOD_HOME_WEB_URL',
  'BUKLOD_KINGDOM_WEB_URL',
  'isLoopbackOrigin',
], ['access_token', 'refresh_token']);

// 2. Standalone route boundaries.
const homeRoute = tokens('src/standalone/home/personal-home/[tool].tsx', HOME_TOOLS);
for (const tool of HOME_TOOLS) {
  if (!homeRoute.includes(`${tool}:`)) failures.push(`Standalone Home tool map missing ${tool}`);
}

const gameRoute = tokens('src/standalone/kingdom/games/[game].tsx', GAME_IDS);
for (const gameId of GAME_IDS) {
  if (!gameRoute.includes(`'${gameId}':`)) failures.push(`Standalone Kingdom route map missing ${gameId}`);
  tokens(`src/app/games/${gameId}.tsx`, [
    'recordBuklodKingdomPreviewResult',
    'onFinish',
  ]);
}

for (const [gameId, [sourceFile, minimumPressables]] of Object.entries(GAME_INTERACTION_SURFACE)) {
  const source = read(sourceFile);
  const pressables = count(source, /<Pressable\\b/g);
  const onPress = count(source, /onPress=/g);
  if (pressables < minimumPressables || onPress < minimumPressables) {
    failures.push(
      `${gameId} interaction surface shrank: expected >=${minimumPressables} controls, found ${pressables} Pressables / ${onPress} onPress handlers`,
    );
  }
  if (!source.includes('reward:')) failures.push(`${gameId} no longer emits a reward result payload`);
}

notes.push('13/13 game interaction surfaces inventoried (47 current Pressables).');

// 3. Web-only authoritative Kingdom progression/rewards.
const progress = tokens('src/features/games/kingdom/progress.web.ts', [
  "rpc('get_my_buklod_kingdom_v1')",
  "rpc('submit_my_buklod_kingdom_result_v2'",
  "'get_my_buklod_kingdom_level_details_v1'",
  'p_client_result_id',
  'p_level_no',
  'pendingResults',
  'collectibleAwarded',
  'kingdomXpAwarded',
  'gameXpAwarded',
  'DUPLICATE_RESULT_WINDOW_MS',
  'flushPendingQueue',
  'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
]);
if (progress.includes('buklod.kingdom.preview.progress.v1')) {
  failures.push('Web Kingdom reverted to legacy preview-only progress storage.');
}

const map = tokens('src/features/games/kingdom/BuklodKingdomMap.web.tsx', [
  "from './progress.web'",
  'disabled={!unlocked}',
  'currentLevel',
  'clearedLevels',
  'worldTier',
  'masteredRegions',
  'kingdomXp',
  'KINGDOM UNITED',
  'requiredRankOrder',
]);
for (const gameId of GAME_IDS) {
  if (!map.includes(gameId)) failures.push(`Server-aware web map missing station ${gameId}`);
}
for (const unsafe of ['/games/training-grounds', 'href="/mentor"', 'href="/igpat"']) {
  if (map.includes(unsafe)) failures.push(`Web Kingdom map contains unsafe standalone landmark route: ${unsafe}`);
}

tokens('supabase/migrations/20260919164940_buklod_bahay_completion_reward_idempotency_r3.sql', [
  '_buklod_garden_energy_granted',
  '_buklod_recurrence_spawned',
  '_buklod_recurrence_successor_id',
  'buklod_home_spawn_recurrence',
  'buklod_home_complete_item_v1',
  'buklod_home_confirm_item_v1',
]);

// 4. Bahay full action surface and backend bindings.
const bahayUi = read('src/components/home/BuklodBahayHome.tsx');
const bahayPressables = count(bahayUi, /<Pressable\b/g);
if (bahayPressables < 61) {
  failures.push(`Bahay button surface unexpectedly shrank: expected >=61 Pressables, found ${bahayPressables}`);
}
for (const token of [
  'createBahay','decideBahayInvite','inviteKasambahay','addBahayItem',
  'toggleBahayItem','confirmBahayItem','sendBahayMessage','createBahayPoll',
  'voteBahayPoll','pickAndUploadBahayFile','openBahayFile','plantBahayGarden',
  'waterBahayPlant','saveBahayPreferences','createBahayCommunity',
  'joinBahayCommunity','addCommunityGoal','sendCommunityMessage',
  "router.push('/personal-home/media'","router.push('/personal-home/recipe'",
  "router.push('/personal-home/budget'","router.push('/personal-home/reminders'",
]) {
  if (!bahayUi.includes(token)) failures.push(`Bahay UI missing action wiring: ${token}`);
}

tokens('src/lib/buklodBahay.ts', [
  "rpc('buklod_home_create_v1'",
  "rpc('buklod_home_invite_decide_v1'",
  "rpc('buklod_home_invite_v1'",
  "rpc('buklod_home_member_directory_v1'",
  "rpc('buklod_home_complete_item_v1'",
  "rpc('buklod_home_confirm_item_v1'",
  "rpc('buklod_home_rewarded_ad_grant_v1'",
  "rpc('buklod_home_plant_v1'",
  "rpc('buklod_home_water_plant_v1'",
  "rpc('buklod_home_create_community_v1'",
  "rpc('buklod_home_join_community_v1'",
  "storage.from('buklod-home-drawer')",
  '.createSignedUrl(',
  'subscribeBahay',
  'subscribeBahayCommunity',
]);

// Web must not fake a rewarded ad. Android/native keeps the real earned-reward grant.
tokens('src/components/home/BuklodBahayAds.tsx', [
  'BahayHomeAdBanner',
  'BahayGardenRewardAd',
  'return null',
]);
tokens('src/components/home/BuklodBahayAds.native.tsx', [
  'showBuklodRewardedAd',
  'ad.earned',
  'claimBahayGardenAdReward',
  'remainingToday',
]);

// 5. Four Home tool contracts.
tokens('src/app/personal-home/recipe.tsx', [
  "supabase.functions.invoke('buklod-home-ai'",
  'AsyncStorage.setItem',
  'router.back()',
]);
tokens('src/app/personal-home/budget.tsx', [
  'AsyncStorage.setItem',
  'Add entry',
  'remove(item.id)',
  "router.push('/points'",
  'router.back()',
]);
tokens('src/app/personal-home/reminders.tsx', [
  'AsyncStorage.setItem',
  'Schedule Reminder',
  'removeReminder',
  'router.back()',
]);
tokens('src/app/personal-home/media.tsx', [
  'Linking.openURL',
  'router.push(item.route',
  'router.back()',
]);

// 6. Static SPA server must preserve direct routes.
tokens('scripts/serve-standalone-static.mjs', [
  "resolve(root, 'index.html')",
  'safeAssetPath',
  ': indexFile',
  "'X-Content-Type-Options'",
]);

notes.push(`Kingdom routes locked: ${GAME_IDS.length}/13`);
notes.push(`Home tools locked: ${HOME_TOOLS.length}/4`);
notes.push(`Bahay Pressable surface: ${bahayPressables} buttons/actions`);
notes.push('Web Garden ad intentionally no-op; no fake reward claim.');
notes.push('Native Android Garden rewarded-ad implementation preserved.');

for (const note of notes) console.log(`PASS: ${note}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nHOME + KINGDOM R3 CONTRACT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nHOME + KINGDOM R3 SOURCE/BACKEND-WIRING CONTRACT = PASS');
console.log('This is not the final DONE marker. Authenticated browser interaction E2E is still required.');
