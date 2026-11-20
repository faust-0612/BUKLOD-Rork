import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../supabase/changesets/character_bp_verified_items_faith_neutral_v1.dev.sql',import.meta.url),'utf8');
const rank=readFileSync(new URL('../supabase/migrations/20261116044202_buklod_character_per_character_progress_v3.sql',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/points/evolution.tsx',import.meta.url),'utf8');

test('Circle Rank keeps canonical lifetime BP independent of Character task items',()=>{
  assert.match(sql,/get_buklod_rank_for_points_v2\(greatest\(v_lifetime,0\)\)/);
  assert.match(sql,/character_bp_eligible_level/);
  assert.match(rank,/private\.buklod_character_progress_v3/);
  assert.match(sql,/v_level := private\.buklod_character_evolution_level_v1/);
});
test('Character items neither charge BP nor change QMP, payouts or cash credits',()=>{
  assert.doesNotMatch(sql,/UPDATE public\.buklod_user_points_balances|INSERT INTO public\.buklod_points_ledger/i);
  assert.doesNotMatch(sql,/UPDATE public\.bayanihan_ledger|INSERT INTO public\.bayanihan_ledger/i);
  assert.match(route,/Circle Rank remains independent/);
});
