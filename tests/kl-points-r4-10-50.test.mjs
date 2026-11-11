import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql = read('supabase/migrations/20261111152000_kl_verified_reading_10_series_50.sql');
const ui = read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');
const guide = read('src/components/points/BuklodPointsR2Guide.tsx');
const types = read('src/lib/kabihasnang-ligaw/types.ts');
test('KL successor keeps quiz/time verification and existing idempotent keys', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\\.kl_reading_progress_v1/);
  assert.match(sql, /kl_quiz_attempts/);
  assert.match(sql, /v_session\\.ping_count<2/);
  assert.match(sql, /for update/);
  assert.match(sql, /on conflict do nothing/);
  assert.match(sql, /v_user,10,'kl_episode_completion'/);
  assert.match(sql, /v_user,50,'kl_season_completion'/);
  assert.match(sql, /v_season_count=30 and v_finished=30/);
  assert.doesNotMatch(sql, /update public\\.buklod_points_ledger|update public\\.kl_reading_sessions set completed_at=now\\(\\)\\s*where[^;]*completed_at is not null/i);
});
test('KL successor displays the server-confirmed new +10/+50 amounts, including legacy fallback', () => {
  assert.match(sql, /when v_chapter_awarded then 10 else 0/);
  assert.match(sql, /when v_series_awarded then 50 else 0/);
  assert.match(ui, /completion\\.chapter_points \\?\\? 10/);
  assert.match(ui, /Series bonus/);
  assert.match(guide, /\\+10 BP.*\\+50 BP/);
  assert.match(types, /\\[KL_EPISODE_RULE\\]: 10/);
  assert.match(types, /\\[KL_SEASON_RULE\\]: 50/);
});
