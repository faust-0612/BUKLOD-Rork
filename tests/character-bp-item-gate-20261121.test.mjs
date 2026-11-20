import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const sql = read('supabase/changesets/character_bp_verified_items_faith_neutral_v1.dev.sql');
const client = read('src/lib/buklodCharacterEvolutionV1.ts');
const guide = read('src/components/points/BuklodCharacterLevelGuide.tsx');
const gate = read('src/components/points/BuklodCharacterEvolutionGate.tsx');
const old = read('supabase/migrations/20261116044202_buklod_character_per_character_progress_v3.sql');

test('Circle Rank remains BP-based and per-character checkpoints stay independent', () => {
  assert.match(sql,/get_buklod_rank_for_points_v2\(greatest\(v_lifetime,0\)\)/);
  assert.match(old,/earned_points = private\.buklod_character_progress_v3\.earned_points/);
  assert.match(sql,/character_bp_eligible_level/);
  assert.match(sql,/buklod_character_evolution_level_v1\(v_uid,v_character,v_earned\)/);
  assert.match(sql,/character_evolution_model','BP_ELIGIBILITY_VERIFIED_ITEMS_V1/);
});

test('items are verified receipts rather than legacy auto-awarded cosmetic collectibles', () => {
  assert.match(sql,/CREATE TABLE IF NOT EXISTS private\.buklod_character_evolution_items_v1/);
  assert.match(sql,/PRIMARY KEY\(user_id,character_id,from_level,item_index\)/);
  assert.match(sql,/v_have<v_target THEN RAISE EXCEPTION/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/ON CONFLICT\(user_id,character_id,from_level,item_index\) DO NOTHING/);
  assert.doesNotMatch(sql,/buklod_sync_core_character_collectibles_v1\(v_uid,v_char\)/);
  assert.doesNotMatch(client,/lifetimePoints\s*>=\s*threshold/);
});

test('both faith OFF and optional faith ON have non-faith verifiable routes', () => {
  assert.match(sql,/character_public_post/);
  assert.match(sql,/character_public_comment/);
  assert.match(sql,/character_public_reaction/);
  assert.match(sql,/character_public_share/);
  assert.match(sql,/character_public_active_week/);
  assert.match(sql,/character_kingdom_mastery/);
  assert.doesNotMatch(sql,/show_faith_enabled|faith_mode\s*=/i);
});

test('more verified items are required for increasingly high levels', () => {
  assert.match(sql,/BETWEEN 1 AND 4 THEN 2/);
  assert.match(sql,/BETWEEN 5 AND 9 THEN 3/);
  assert.match(sql,/BETWEEN 10 AND 14 THEN 4/);
  assert.match(sql,/BETWEEN 15 AND 19 THEN 5/);
  assert.match(sql,/FOR v_step IN p_floor\.\.p_from_level/);
});

test('grandfathered levels are saved once and no direct client writes are granted', () => {
  assert.match(sql,/WITH legacy_candidates AS/);
  assert.match(sql,/ON CONFLICT\(user_id,character_id\) DO NOTHING/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON TABLE private\.buklod_character_evolution_items_v1 FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.get_my_buklod_character_selection_v2\(\) to authenticated/i);
});

test('client reads canonical level and item receipts; core guide never claims automatic points evolution', () => {
  assert.match(client,/get_my_buklod_character_evolution_v1/);
  assert.match(client,/claim_my_buklod_character_evolution_item_v1/);
  assert.match(gate,/onProgressRefresh/);
  assert.match(guide,/BuklodCharacterEvolutionGate/);
  assert.doesNotMatch(guide,/automatic na iko-compute ng server ang susunod na level/);
});
