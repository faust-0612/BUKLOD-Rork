import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Kingdom Legacy is reached from the existing BUKLOD 13-station map', () => {
  const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  const route = read('src/app/games/legacy.tsx');
  assert.match(map, /router\.push\('\/games\/legacy'/);
  assert.match(map, /accessibilityLabel="Open Kingdom Hall of Legacy"/);
  assert.match(route, /export default function KingdomLegacyScreen/);
  assert.match(route, /Back to Kingdom map/);
  const stationIDs = [
    'phan-enterprise-builder', 'vhen-farm-to-market', 'jawo-forest-trail',
    'trudice-playground-memory', 'mitch-restore-mural', 'christian-civic-leadership',
    'ace-rescue-grid', 'van-living-city-dispatch', 'lhen-rhythm-journey',
    'angel-kingdom-treasury', 'niel-mission-trail', 'elesur-village-builder',
    'quin-discovery-expedition',
  ];
  for (const id of stationIDs) assert.ok(map.includes("id: '" + id + "'"), id);
  assert.ok(!read('src/app/games/index.tsx').includes('KingdomLegacyScreen'));
});

test('Kingdom Legacy uses authoritative V2 state and claim/equip RPC helpers', () => {
  const route = read('src/app/games/legacy.tsx');
  assert.match(route, /getMyBuklodCharacterSelectionV2\(id, refresh\)/);
  assert.match(route, /getMyCharacterCollectibles\(next\.active_character_id/);
  assert.match(route, /redeemMyCharacterCollectible\(core, level, index\)/);
  assert.match(route, /useMyCharacterCollectible\(core, level, index\)/);
  assert.match(route, /clearMyCharacterCollectible\(core, item\.rewardKind\)/);
  assert.match(route, /getBuklodSpecialLevelAsset/);
  assert.match(route, /shownCollectiblePins\(collection, core\)/);
  assert.match(route, /original\.uid === accountRef\.current/);
  for (const forbidden of ['update_buklod_points', 'setShards(', 'grantKingdomXp(', 'creditPoints(', 'awardBP(']) {
    assert.ok(!route.includes(forbidden), 'Unauthenticated economy grant: ' + forbidden);
  }
});

test('legacy rewards are honest about premium concepts not yet backed by server grants', () => {
  const route = read('src/app/games/legacy.tsx');
  assert.match(route, /New relics and Shards are not yet spendable or claimable/);
  assert.match(route, /Kingdom map clears are local gameplay records/);
  assert.match(route, /Permanent rank/);
  assert.match(route, /getCachedBuklodCharacterSelectionV2\(uid\)/);
  assert.match(route, /setCollection\(null\)/);
});


test('Original medallions use existing reward kinds and visual-only level finishes', () => {
  const art = read('src/features/games/kingdom/KingdomRelicEmblem.tsx');
  const route = read('src/app/games/legacy.tsx');
  for (const kind of ['expression','speech','profile_frame','visual_effect','title_badge']) {
    assert.ok(art.includes(kind), 'missing server collectible kind '+kind);
  }
  for (const tier of ['bronze','silver','gold','legendary']) {
    assert.ok(art.includes(tier), 'missing visual finish '+tier);
  }
  assert.match(art, /level < 5/);
  assert.match(art, /level < 10/);
  assert.match(art, /level < 15/);
  assert.match(art, /React\.useId\(\)/);
  assert.match(route, /KingdomRelicEmblem/);
  assert.match(route, /acquired\.length/);
  assert.match(route, /level={item\.level}/);
  assert.match(route, /Modal visible={Boolean\(reveal\)}/);
  assert.match(route, /const verified = updated\.items\.find/);
  assert.match(route, /if \(verified\)/);
  assert.match(route, /playBuklodGameFeedback\('unlock'\)/);
});

test('Gallery links all canonical game centers and cannot invent credits', () => {
  const route = read('src/app/games/legacy.tsx');
  const ids = [
    'phan-enterprise-builder','quin-discovery-expedition','van-living-city-dispatch',
    'christian-civic-leadership','lhen-rhythm-journey','jawo-forest-trail',
    'vhen-farm-to-market','trudice-playground-memory','mitch-restore-mural',
    'ace-rescue-grid','niel-mission-trail','angel-kingdom-treasury',
    'elesur-village-builder',
  ];
  for (const id of ids) assert.ok(route.includes("'/games/"+id+"'"), id);
  assert.match(route, /router\.push\(HERO_GAME\[activeId\]/);
  assert.match(route, /Only server-verified mastery can credit real BP/);
  assert.match(route, /New relics and Shards are not yet spendable or claimable/);
  for (const forbidden of ['update_buklod_points', 'setShards(', 'grantKingdomXp(']) {
    assert.ok(!route.includes(forbidden), forbidden);
  }
});


test('Account session is checked at each step of multi-RPC equip operation', () => {
  const route = read('src/app/games/legacy.tsx');
  assert.match(route, /const accountUnchanged = async/);
  assert.match(route, /supabase\.auth\.getSession\(\)/);
  assert.match(route, /data\.session\?\.user\.id !== original\.uid/);
  assert.match(route, /await redeemMyCharacterCollectible\(core, level, index\);\s*await accountUnchanged\(\);\s*await useMyCharacterCollectible/);
  assert.match(route, /await accountUnchanged\(\);\s*const updated = await getMyCharacterCollectibles/);
  assert.match(route, /original\.uid === accountRef\.current/);
});
