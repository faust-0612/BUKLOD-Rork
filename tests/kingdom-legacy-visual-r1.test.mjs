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
