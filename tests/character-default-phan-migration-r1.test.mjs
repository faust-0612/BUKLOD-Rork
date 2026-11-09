import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261109105129_character_implicit_phan_progress_r1_20261109.sql', import.meta.url), 'utf8');

test('default Phan points from verified lifetime only when there is no explicit selection', () => {
  assert.match(sql, /if found then[\s\S]*?v_baseline := greatest[\s\S]*?else[\s\S]*?v_baseline := 0;[\s\S]*?v_level := private\.buklod_character_level_for_delta_v2/);
  assert.match(sql, /IF v_active IS NULL THEN[\s\S]*?IF v_character = 'phan' THEN/);
  assert.match(sql, /IF v_active IS DISTINCT FROM v_character THEN[\s\S]*?RETURN QUERY SELECT false, 1, 0::bigint, v_lifetime/);
  assert.match(sql, /v_lifetime := public\.buklod_lifetime_points_for\(p_user_id\)/);
  assert.match(sql, /SET search_path TO ''/);
});
