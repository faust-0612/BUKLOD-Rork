import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const sql = readFileSync('supabase/migrations/20261108030000_buklod_kingdom_mastery_challenges_v2.sql', 'utf8');
const gameCenter = readFileSync('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx', 'utf8');
const check = readFileSync('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx', 'utf8');
const catalog = JSON.parse(readFileSync('src/features/games/kingdom/platform/game-catalog.json', 'utf8'));
const ids = catalog.characters.flatMap(ch => ch.games.map(game => game.id));
test('all 39 catalog games have distinct server-owned reward eligibility and 5 private bank questions', () => {
  assert.equal(ids.length, 39);
  const games = [...sql.matchAll(/^\('([a-z][a-z0-9-]+)','[^']+','[^']+','[^']+',true\),?$/gm)].map(m => m[1]);
  assert.deepEqual(new Set(games), new Set(ids));
  const questionRows = [...sql.matchAll(/^\('([a-z][a-z0-9-]+)',([1-5]),'/gm)];
  assert.equal(questionRows.length, 195);
  for (const id of ids) assert.equal(questionRows.filter(m => m[1] === id).length, 5);
});
test('reward gate is DB-owned, account-scoped, bounded and idempotent', () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /if v_count>=3 then raise exception/);
  assert.match(sql, /v_attempt\.user_id=v_uid/);
  assert.match(sql, /on conflict\(user_id,source_key\) do nothing/);
  assert.match(sql, /v_q\.answer_index-v_rotation\+4/);
  assert.match(sql, /v_rotation := floor\(random\(\)\*4\)/);
  assert.match(sql, /revoke all on private\.buklod_kingdom_mastery_bank_v1/);
  assert.doesNotMatch(sql, /'questions',[^;]+?'answer'/s);
});
test('both original and pilot wins surface optional verification, not spoofable direct credit', () => {
  assert.match(gameCenter, /<KingdomMasteryCheck/);
  assert.match(gameCenter, /recordKingdomPreviewResult\(owner, sessionId, result\)/);
  assert.match(gameCenter, /recordBuklodKingdomPreviewResult\(result, owner\)/);
  assert.match(gameCenter, /result\.status === 'won'/);
  assert.match(check, /start_my_buklod_kingdom_mastery_v1/);
  assert.match(check, /finish_my_buklod_kingdom_mastery_v1/);
  assert.match(check, /does NOT attest|not your local game score|not the local game score|not your local/i);
  assert.doesNotMatch(check, /admin_award_buklod_points|submit_my_buklod_kingdom_result/);
  assert.match(check, /router\.push\('\/points'/);
});
