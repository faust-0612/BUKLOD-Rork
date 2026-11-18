import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const newCharacterHub = read('src/app/points/character-collections.tsx');
const rankScreen = read('src/app/points/progression.tsx');
const storyMigration = read('supabase/migrations/20261116120000_character_task_story_art_v1.sql');
const originalRewards = read('src/lib/buklodCharacterCollectibles.ts');
const pointsContract = read('src/lib/buklodCharacterSelectionV2.ts');
const photoArt = read('src/lib/buklodCharacterArt.ts');

test('Character items and task screens do not modify BP, QMP, AdMob or Kingdom shards', () => {
  for (const source of [newCharacterHub, storyMigration, photoArt]) {
    for (const forbidden of [
      /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.buklod_points_ledger\b/i,
      /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?private\.buklod_kingdom_shards_wallet_v1\b/i,
      /\b(?:setShards|awardBP|grantPoints|grantKingdomXP|applyAdMobRevenue)\s*\(/,
      /\b(?:qmp|AdMob)\s*=\s*.+/,
    ]) assert.doesNotMatch(source, forbidden);
  }
  assert.match(storyMigration, /revoke all on private\.buklod_character_story_awards_v1 from public,anon,authenticated/i);
  assert.match(newCharacterHub, /get_my_buklod_character_story_tasks_v1/);
});

test('Original Character collectible redeem, equip and independent saved levels remain untouched', () => {
  for (const fn of [
    'get_my_buklod_character_collectible_state_v1',
    'redeem_my_buklod_character_collectible_v1',
    'set_my_buklod_character_reward_active_v1',
  ]) assert.ok(originalRewards.includes(fn), 'missing existing reward RPC '+fn);
  assert.match(pointsContract, /character_levels: levels/);
  assert.match(pointsContract, /PER_CHARACTER_PERSISTED_V3/);
  assert.match(newCharacterHub, /savedCharacterLevel\(selection.character_levels/);
});

test('Character collections entry keeps existing Circle Rank AdMob placement', () => {
  assert.match(rankScreen, /points_rank_progression_native/);
  assert.match(rankScreen, /points_rank_roadmap_footer/);
  assert.match(rankScreen, /BuklodKingdomAdSlot/);
  assert.match(rankScreen, /\/points\/character-collections/);
});

test('Image asset checks never block dashboard loading or create heavy eager image traffic', () => {
  assert.match(photoArt, /REFRESH_AFTER_MS = 10 \* 60 \* 1000/);
  assert.match(photoArt, /RETRY_AFTER_FAILURE_MS = 60 \* 1000/);
  assert.match(photoArt, /let pending:Promise<CharacterArtPublication>\|null=null/);
  assert.match(newCharacterHub, /loadCharacterArtPublication/);
  assert.match(newCharacterHub, /storyStageItems\(worldId,level\)/);
  assert.match(newCharacterHub, /cachePolicy="memory-disk"/);
});
