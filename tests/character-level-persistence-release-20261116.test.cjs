const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = p => fs.readFileSync(p, 'utf8');
const migration = read('supabase/migrations/20261116044202_buklod_character_per_character_progress_v3.sql');
const client = read('src/lib/buklodCharacterSelectionV2.ts');
const core = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const specials = read('src/components/points/BuklodSpecialCharacterSeries.tsx');
const gate = read('scripts/release-gate.mjs');

test('switch banks the previous character by (user, character) without transferring XP', () => {
  assert.match(migration, /primary key \(user_id, character_id\)/i);
  assert.match(migration, /earned_points = private\.buklod_character_progress_v3\.earned_points\s*\+ excluded\.earned_points/);
  assert.match(migration, /v_active_delta := greatest\(v_lifetime-greatest\(v_baseline,0\),0\)/);
  assert.match(migration, /if v_previous = v_character then[\s\S]*?return public\.get_my_buklod_character_selection_v2\(\)/i);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock\(/);
});

test('resume the selected character from saved XP plus its currently active window', () => {
  assert.match(migration, /v_earned := v_earned \+ greatest\(v_lifetime-v_baseline,0\)/);
  assert.match(migration, /v_level := private\.buklod_character_level_for_delta_v2\(v_earned\)/);
  assert.match(migration, /jsonb_object_agg\(p\.character_id/);
  assert.match(migration, /PER_CHARACTER_PERSISTED_V3/);
  assert.match(client, /character_levels: levels/);
});

test('Circle Rank is unchanged and protected characters retain rank gates', () => {
  assert.match(migration, /get_buklod_rank_for_points_v2\(greatest\(v_lifetime,0\)\)/);
  assert.match(migration, /private\.buklod_character_special_required_rank_v2\(v_character\)/);
  assert.match(migration, /special Character is not yet available at your Circle Rank/i);
});

test('authenticated session, private RLS, and revoked direct reads prevent cross-account XP access', () => {
  assert.match(migration, /v_uid uuid := \(select auth\.uid\(\)\)/i);
  assert.match(migration, /alter table private\.buklod_character_progress_v3 enable row level security/i);
  assert.match(migration, /revoke all on table private\.buklod_character_progress_v3 from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.set_my_buklod_character_active_v2\(text\) to authenticated/i);
  assert.match(client, /await ensureCharacterSession\(userId\)/);
});

test('active Character level uses restored server state while shipped visuals remain byte-identical', () => {
  const { execFileSync } = require('node:child_process');
  assert.match(core, /state\.character_level/);
  assert.match(specials, /state\.character_level/);
  assert.match(core, /setMyBuklodCharacterActiveV2/);
  assert.match(specials, /setMyBuklodCharacterActiveV2/);
  assert.equal(execFileSync('git',['hash-object','src/components/points/BuklodProgressiveCharacterSelector.tsx'],{encoding:'utf8'}).trim(),
    '1debd5659a96c97f83f32eeebb37c309a527d4ae');
  assert.equal(execFileSync('git',['hash-object','src/components/points/BuklodSpecialCharacterSeries.tsx'],{encoding:'utf8'}).trim(),
    '4cf837d453c4c33c867e2b0ae714e6f81f1ffeb6');
});

test('a stale network refresh cannot repaint the previous active character', () => {
  assert.match(client, /const mutationEpoch = new Map/);
  assert.match(client, /if \(\(mutationEpoch\.get\(userId\) \?\? 0\) !== requestEpoch\)/);
  assert.match(client, /mutationEpoch\.set\(userId, \(mutationEpoch\.get\(userId\) \?\? 0\) \+ 1\)/);
});

test('mandatory release gate requires the per-character model and matching SQL migration', () => {
  assert.match(gate, /PER_CHARACTER_PERSISTED_V3/);
  assert.match(gate, /supabase\/migrations\/20261116044202_buklod_character_per_character_progress_v3\.sql/);
  assert.doesNotMatch(gate, /Character V2 atomic Level-1 reset contract is missing/);
});

test('historical OTA Character visual parity guard must protect unchanged art without enforcing a reset', () => {
  const parity = read('scripts/test-character-live-parity-ota173.cjs');
  assert.match(parity, /1debd5659a96c97f83f32eeebb37c309a527d4ae/);
  assert.match(parity, /4cf837d453c4c33c867e2b0ae714e6f81f1ffeb6/);
  assert.match(parity, /PER_CHARACTER_PERSISTED_V3/);
  assert.doesNotMatch(parity, /ATOMIC_RESET_LEVEL_1_V2/);
});
