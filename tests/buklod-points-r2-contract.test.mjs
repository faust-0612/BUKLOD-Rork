import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const rules = read('supabase/migrations/20261107220000_buklod_points_r2_weighted_catalog.sql');
const verified = read('supabase/migrations/20261107221000_buklod_points_r2_verified_accomplishments.sql');
const guide = read('src/components/points/BuklodPointsR2Guide.tsx');
const points = read('src/components/points/BuklodPointsRewardsScreen.tsx');

test('R2 reward catalog cannot grant new unvalidated activities automatically', () => {
 assert.match(rules,/false, 'R2 proposal: activate only after verified/);
 assert.match(rules,/on conflict \(activity_type\) do nothing/);
 assert.doesNotMatch(rules,/update public\.buklod_points_ledger/i);
});
test('ABC uses backend rule with preserved source-key and historical award amount', () => {
 assert.match(rules,/r\.base_points/);
 assert.match(rules,/abc_growth:v1:/);
 assert.match(rules,/on conflict \(user_id, source_key\) do nothing/);
 assert.match(rules,/select l\.points from public\.buklod_points_ledger/);
 assert.match(rules,/where activity_type='abc_growth_lesson'/);
});
test('only System Admin may award manually reviewed R2 accomplishments', () => {
 assert.match(verified,/not public\.is_system_admin\(\)/);
 assert.match(verified,/length\(proof\) < 20/);
 assert.match(verified,/pg_advisory_xact_lock/);
 assert.match(verified,/unique\(user_id,activity_type,milestone_key\)/);
 assert.match(verified,/public\.admin_award_buklod_points\(/);
 assert.match(verified,/if kind like 'achievement_%' then proof_key := 'lifetime'/);
 assert.match(verified,/amount > rule_rec\.max_points_per_event/);
 assert.match(verified,/revoke all on public\.buklod_r2_accomplishment_reviews/);
 assert.match(verified,/alter table public\.buklod_r2_accomplishment_reviews enable row level security/);
});
test('difficulty multipliers are whitelisted and bounded', () => {
 for (const token of ["'easy' then 1","'medium' then 1.5","'hard' then 2.5","else 4"]) {
   assert.ok(verified.includes(token), token);
 }
 assert.match(verified,/kind <> 'r2_verified_challenge' and level <> 'easy'/);
 assert.match(verified,/\('r2_verified_challenge','Verified R2 challenge',10,40,80,300,false/);
});
test('Points UI shows server-reported activation state and does not mint credits', () => {
 assert.match(guide,/get_buklod_points_r2_catalog_v1/);
 assert.match(guide,/Coming soon — not claimable yet/);
 assert.match(points,/BuklodPointsR2Guide/);
 assert.doesNotMatch(guide,/\.insert\(|\.update\(|admin_award_buklod_points/);
 assert.match(verified,/grant execute on function public\.get_buklod_points_r2_catalog_v1/);
});
