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

test('verified item retries and character switches are serialized without duplicating receipts', () => {
  assert.match(sql,/buklod_character_switch_v3/);
  assert.match(sql,/AND EXISTS \(\s*SELECT 1 FROM private\.buklod_character_evolution_items_v1 i/);
  assert.match(sql,/RETURN public\.get_my_buklod_character_evolution_v1\(\)/);
  assert.match(sql,/ON CONFLICT\(source_kind,source_id\) DO NOTHING/);
});

test('all 13 Characters have a discoverable evolution task page without changing locked Studio art', () => {
  const route = read('src/app/points/evolution.tsx');
  const profile = read('src/components/points/BuklodProfileCharacterCard.tsx');
  assert.match(route,/BuklodCharacterEvolutionGate/);
  assert.match(route,/state\.active_character_id/);
  assert.match(profile,/\/points\/evolution/);
  assert.match(sql,/jawo','trudice','ace','mitch','niel','angel','vhen','ellusur/);
});

test('production-value lookups use a bounded indexed grouped query rather than per-level loops', () => {
  assert.match(sql,/CREATE INDEX IF NOT EXISTS buklod_character_evolution_activity_lookup_idx/);
  assert.match(sql,/FROM pg_catalog\.generate_series\(v_level,v_bp-1\)/);
  assert.match(sql,/HAVING count\(i\.item_index\)</);
  assert.doesNotMatch(sql,/FOR v_step IN v_level\.\.\(v_bp-1\) LOOP/);
});

test('already earned levels are preserved even if BP eligibility snapshots are inconsistent', () => {
  assert.match(sql, /v_level:=v_floor;/);
  assert.match(sql, /v_bp_eligible_level := greatest\(/);
  assert.doesNotMatch(sql, /v_level:=least\(v_floor,v_bp\);/);
});

test('higher tier tasks begin only at their first real required stage', () => {
  assert.match(sql, /WHEN 3 THEN 5/);
  assert.match(sql, /WHEN 4 THEN 10 WHEN 5 THEN 15/);
  assert.match(sql, /IF v_step >= CASE p_item_index/);
  assert.match(sql, /v_total:=v_total\+CASE p_item_index/);
});

test('mandatory Character items are inventory assets with durable provenance', () => {
  assert.match(sql, /asset_key text GENERATED ALWAYS AS/);
  assert.match(sql, /primary_event_count integer NOT NULL DEFAULT 0/);
  assert.match(sql, /kingdom_event_count integer NOT NULL DEFAULT 0/);
  assert.match(sql, /SELECT count\(\*\) FILTER \(WHERE e\.metric_key=v_metric\)/);
  assert.match(sql, /IF v_primary\+v_kingdom<v_target/);
  assert.match(sql, /'asset_key',v_char \|\| ':L'/);
});

test('core cosmetic sync cannot issue new level cosmetics from BP alone', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.buklod_character_collectible_progress_v1/);
  assert.match(sql, /private\.buklod_character_evolution_level_v1\(p_user_id,v_character,v_earned\)::integer/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.buklod_character_collectible_progress_v1\(uuid,text\)/);
});

test('schema specifies explicit faith-OFF parity and unverified activity adapters are excluded', () => {
  const spec = read('docs/character/CHARACTER_BP_ITEMS_FAITH_OPTIONAL_20261121.md');
  assert.match(spec, /13 Character IDs/);
  assert.match(spec, /1,300 across 13 Characters/);
  assert.match(spec, /68 mandatory transition receipts/);
  assert.match(spec, /Show Faith policy \(ON and OFF parity\)/);
  assert.match(spec, /Only \*\*Public Wall\*\* and \*\*verified Kingdom first mastery\*\*/);
  assert.match(spec, /Unresolved evidence-revocation handling is a \*\*release blocker\*\*/);
});
