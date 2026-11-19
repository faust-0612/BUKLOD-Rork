import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const s2 = read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');
const s1 = read('supabase/migrations/20261111085702_kl_verified_reading_10_series_50.sql');
const screen = read('src/components/kabihasnang-ligaw/KlLiveDiscussion.tsx');
const social = read('src/lib/kabihasnang-ligaw/readerSocial.ts');
const copy = read('src/lib/kabihasnang-ligaw/copy.ts');
const types = read('src/lib/kabihasnang-ligaw/types.ts');

test('Season 1 verified KL reward history and series bonus remain unchanged', () => {
  assert.match(s1, /v_user,10,'kl_episode_completion'/);
  assert.match(s1, /v_user,50,'kl_season_completion'/);
  assert.match(s2, /VALUES\(1,false,'2026-12-06 00:00:00\+08'/);
  assert.match(s2, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(s2, /IF private\.kl_s2_rewards_enabled_v1\(\) THEN v_chapter_points:=15/);
  assert.match(s2, /v_chapter_points integer:=10/);
  assert.match(s2, /IF NEW\.enabled AND now\(\)<NEW\.effective_at THEN/);
  assert.doesNotMatch(s2, /UPDATE public\.buklod_points_ledger\b/i);
});

test('Completion rewards agree in the ledger and RPC response, preserve quiz and bonus checks', () => {
  assert.match(s2, /v_user,v_chapter_points,'kl_episode_completion'/);
  assert.match(s2, /'chapter_points',case when v_chapter_awarded then v_chapter_points else 0 end/);
  assert.match(s2, /'points_awarded',\(case when v_chapter_awarded then v_chapter_points else 0 end\)/);
  assert.match(s2, /v_user,50,'kl_season_completion'/);
  assert.match(s2, /v_season_count=30 and v_finished=30/);
  assert.match(s2, /v_session\.ping_count<2/);
  assert.match(s2, /kl_quiz_attempts/);
  assert.match(s2, /for update/);
  assert.match(s2, /kl:episode:/);
});

test('Comment reward is backend-only, one credit per user per chapter, not for short/repeated/replies', () => {
  assert.match(s2, /AFTER INSERT ON public\.kl_episode_comments/);
  assert.match(s2, /AFTER INSERT ON private\.kl_episode_comments/);
  assert.match(s2, /char_length\(v_body\) NOT BETWEEN 20 AND 500/);
  assert.match(s2, /v_uid IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(s2, /nullif\(v_row->>'parent_id',''\) IS NOT NULL/);
  assert.match(s2, /e\.status='approved'/);
  assert.match(s2, /e\.release_at<=now\(\)/);
  assert.match(s2, /v_uid,5,'kl_comment_reflection'/);
  assert.match(s2, /'kl:comment:s2:'\|\|v_uid::text\|\|':'\|\|v_episode::text/);
  assert.match(s2, /REVOKE ALL ON FUNCTION private\.kl_s2_comment_reward_v1/);
  assert.match(s2, /IF NOT private\.kl_s2_rewards_enabled_v1\(\) THEN RETURN NEW/);
});

test('Staged KL composer consistently requires 20 characters before submitting', () => {
  assert.match(types, /KL_S2_COMMENT_MIN_CHARS = 20/);
  assert.match(types, /chapter: 15, firstQualifiedComment: 5/);
  assert.match(screen, /draft\.trim\(\)\.length < KL_S2_COMMENT_MIN_CHARS/);
  assert.match(social, /trimmed\.length < KL_S2_COMMENT_MIN_CHARS/);
  assert.match(copy, /20–500 karakter/);
  assert.doesNotMatch(copy, /12–500 karakter/);
  assert.match(screen, /draft\.trim\(\)\.length}\/\{KL_S2_COMMENT_MIN_CHARS}/);
});
