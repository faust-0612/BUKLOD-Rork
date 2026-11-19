import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const previous = read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');
const sql = read('supabase/migrations/20261119221000_kl_s2_sequential_no_timer_series_reflection.sql');
const lock = read('supabase/migrations/20261119221500_kl_s2_reader_rpc_server_lock.sql');
const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const dynamic = read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
const component = read('src/components/kabihasnang-ligaw/KlSeriesReflection.tsx');
const quiz = read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');

test('S2 remains dormant and Season 1 plus-ten/plus-fifty rewards retain original contracts', () => {
  assert.match(previous, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(previous, /'2026-12-06 00:00:00\+08'/);
  assert.match(sql, /v_chapter_points integer:=10/);
  assert.match(sql, /if v_season_count=30 and v_finished=30 AND NOT v_s2_enabled then/);
  assert.match(sql, /ELSIF NOT v_s2_enabled THEN/);
  assert.doesNotMatch(sql, /UPDATE private\.kl_s2_reward_rollout SET enabled=true/);
});
test('quiz verification (not reading duration or two pings) is required for every new S2 chapter', () => {
  assert.match(sql, /OR v_s2_enabled -- always require quiz in S2; timer is irrelevant/);
  assert.match(sql, /a\.verified_at IS NOT NULL AND a\.manuscript_hash=q\.manuscript_hash/);
  assert.match(sql, /'allow_legacy',NOT private\.kl_s2_rewards_enabled_v1\(\) AND NOT coalesce/);
  assert.match(quiz, /result\.passed && result\.completion\?\.completed === true/);
  assert.match(quiz, /result\.completion\.new_completion === true/);
});
test('server refuses unlocked-by-preexisting-session read and private media path', () => {
  assert.match(previous, /BEFORE INSERT OR UPDATE OF episode_id ON public\.kl_reading_sessions/);
  assert.match(lock, /CREATE OR REPLACE FUNCTION public\.kl_read_episode_v1/);
  assert.match(lock, /CREATE OR REPLACE FUNCTION public\.kl_episode_media_v1/);
  assert.match(lock, /private\.kl_s2_previous_chapter_complete_v1\(auth\.uid\(\),p_episode_id\)/);
  assert.match(lock, /return jsonb_build_object\('readable',false,'content','\[\]'::jsonb,'reason','previous_chapter_required'\)/);
  assert.match(lock, /RETURN '\[\]'::jsonb/);
  assert.match(previous, /pg_catalog\.generate_series\(1,chapter\.episode_number-1\)/);
});
test('one secured per-account progress RPC drives visible locks and immediate post-quiz refresh', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.kl_s2_reader_progress_v1/);
  assert.match(sql, /v_user uuid:=auth\.uid\(\)/);
  assert.match(sql, /'next_chapter_number',coalesce\(v_next,31\)/);
  assert.match(reader, /episodeSequenceLocked/);
  assert.match(reader, /setJourneyRefreshToken\(\(token\) => token \+ 1\)/);
  assert.match(reader, /'kl_s2_reader_progress_v1'/);
  assert.match(dynamic, /disabled=\{chapterLocked\(c\)\}/);
  assert.match(dynamic, /onVerified=\{\(\)=>\{setReflectionRefreshToken/);
});
test('private reflection must be original-looking, 50+ characters and all thirty verified chapters first', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private\.kl_s2_series_reflections/);
  assert.match(sql, /PRIMARY KEY\(user_id,season_number\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE private\.kl_s2_series_reflections FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /char_length\(v_text\) NOT BETWEEN 50 AND 2000/);
  assert.match(sql, /v_words<8 OR v_distinct<6/);
  assert.match(sql, /v_count<>30/);
  assert.match(sql, /ON CONFLICT \(user_id,season_number\) DO NOTHING/);
  assert.match(sql, /FOR UPDATE/);
});
test('series +50 is never awarded by chapter completion after activation, only by reflection RPC', () => {
  const completionFunction=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.kl_reading_progress_v1'));
  const reflectionFunction=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.kl_s2_submit_series_reflection_v1'),
    sql.indexOf('REVOKE ALL ON FUNCTION public.kl_s2_submit_series_reflection_v1'));
  assert.match(completionFunction, /AND NOT v_s2_enabled then/);
  assert.match(reflectionFunction, /v_user,50,'kl_season_completion'/);
  assert.match(reflectionFunction, /'kl:season:'\|\|v_user::text\|\|':'\|\|p_season_number::text/);
  assert.match(reflectionFunction, /AND l\.direction='credit' AND l\.points=50/);
  assert.match(component, /seasonNumber, refreshToken = 0/);
  assert.match(component, /characterCount < 50/);
  assert.match(component, /Ano ang natutuhan mo sa buong serye/);
  assert.match(component, /p_reflection: normalized/);
  assert.match(component, /Ang Lupang Hindi Namamatay/);
});
test('pending 5+chapter points still release only on NEXT verified chapter, including series transition', () => {
  assert.match(previous, /v_chapter_points:=5\+v_episode\.episode_number/);
  assert.match(sql, /v_previous_credit:=v_pending_row\.reward_bp/);
  assert.match(sql, /previous\.episode_number=30/);
  assert.match(sql, /pending\.credited_at IS NULL/);
  assert.match(sql, /'pending_points',v_pending_points/);
  assert.match(sql, /'released_previous_chapter_points',v_previous_credit/);
});

test('S2 reader cannot leak chapter quiz questions or use an expired-at-two-hours timer', () => {
  assert.match(sql, /private\.kl_s2_previous_chapter_complete_v1\(v_user,p_episode_id\)/);
  assert.match(sql, /private\.kl_s2_previous_chapter_complete_v1\(auth\.uid\(\),v\.episode_id\)/);
  assert.match(sql, /'reason','previous_chapter_required'/);
  assert.match(sql, /IF \(NOT private\.kl_s2_rewards_enabled_v1\(\) AND\s+v\.started_at<now\(\)-interval '2 hours'\) OR/);
  assert.match(sql, /IF v_correct=3 THEN/);
});
