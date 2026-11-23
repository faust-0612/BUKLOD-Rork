import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const sql=read('supabase/migrations/20261123224000_kl_s2_verified_quiz_comment_unlock.sql');
const previous=read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');
const quiz=read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');
const comment=read('src/components/kabihasnang-ligaw/KlLiveDiscussion.tsx');
const legacy=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const dynamic=read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
const admin=read('src/components/kabihasnang-ligaw/KlSeriesReleaseDesk.tsx');
const home=read('src/components/kabihasnang-ligaw/KlDashboardHome.tsx');

test('next chapter requires 3/3 verified quiz AND a visible 20+ character top-level comment posted afterward',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION private\.kl_s2_verified_comment_v1/);
  assert.match(sql,/session\.completed_at IS NOT NULL/);
  assert.match(sql,/attempt\.verified_at IS NOT NULL/);
  assert.match(sql,/attempt\.manuscript_hash=bank\.manuscript_hash/);
  assert.match(sql,/bank\.status='ready'/);
  assert.match(sql,/comment\.author_id=p_user/);
  assert.match(sql,/comment\.parent_id IS NULL AND comment\.deleted_at IS NULL/);
  assert.match(sql,/comment\.created_at>=attempt\.verified_at/);
  assert.match(sql,/char_length\(btrim\(comment\.body\)\) BETWEEN 20 AND 500/);
  assert.match(sql,/private\.kl_s2_verified_comment_v1\(p_user,previous\.id\)/);
  assert.match(sql,/private\.kl_s2_verified_comment_v1\(p_user,previous_series\.id\)/);
});

test('old clients cannot bypass comment gate via read/quiz/media/session APIs',()=>{
  assert.match(previous,/private\.kl_s2_previous_chapter_complete_v1\(NEW\.user_id,NEW\.episode_id\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION private\.kl_s2_previous_chapter_complete_v1/);
  const guard=read('supabase/migrations/20261119221500_kl_s2_reader_rpc_server_lock.sql');
  assert.match(guard,/private\.kl_s2_previous_chapter_complete_v1\(auth\.uid\(\),p_episode_id\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.kl_post_comment_v1/);
  assert.match(sql,/NOT private\.kl_s2_previous_chapter_complete_v1\(v_user,p_episode_id\)/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.kl_quiz_begin_v1/);
  assert.match(sql,/NOT private\.kl_s2_previous_chapter_complete_v1\(v_user,p_episode_id\)/);
});

test('comments before verified quiz, deleted comments and replies do not unlock next chapter or grant +5',()=>{
  assert.match(sql,/NEW\.author_id/);
  assert.match(sql,/NEW\.parent_id IS NOT NULL OR NEW\.deleted_at IS NOT NULL/);
  assert.match(sql,/NEW\.created_at>=a\.verified_at/);
  assert.match(sql,/kl:comment:s2:/);
  assert.match(sql,/public\.buklod_award_verification_points_v1/);
  assert.match(sql,/REVOKE ALL ON FUNCTION private\.kl_s2_verified_comment_v1/);
  assert.match(sql,/REVOKE ALL ON FUNCTION private\.kl_s2_previous_chapter_complete_v1/);
});

test('progress waits for submitted reflection, including all 30 previous-series chapters',()=>{
  assert.match(sql,/v_commented integer\[\]/);
  assert.match(sql,/WHERE NOT \(n=ANY\(v_commented\)\)/);
  assert.match(sql,/v_next:=0/);
  assert.match(sql,/'series_unlocked',v_series_unlocked/);
  assert.match(sql,/'awaiting_comment_number',v_awaiting_comment/);
  assert.match(dynamic,/series_unlocked:false|series_unlocked===false/);
  assert.match(dynamic,/onCommentPosted=/);
  assert.match(legacy,/onCommentPosted=\{\(\) => setJourneyRefreshToken/);
  assert.match(home,/Tapusin muna ang naunang serye/);
});

test('pre-activation Season 1 progress remains based on legacy completed sessions',()=>{
  assert.match(sql,/IF NOT private\\.kl_s2_rewards_enabled_v1\\(\\) THEN/);
  assert.match(sql,/This branch never applies the new comment requirement prematurely/);
  assert.match(sql,/'enabled',false/);
  assert.match(sql,/s\\.completed_at IS NOT NULL/);
});

test('S2 existing completed legacy sessions may reverify quiz instead of getting permanently stuck',()=>{
  const begin=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.kl_quiz_begin_v1'));
  assert.match(begin,/NOT v_s2 OR EXISTS/);
  assert.match(begin,/a\.verified_at IS NOT NULL/);
  assert.match(begin,/RETURN jsonb_build_object\('ok',true,'already_completed',true\)/);
  assert.match(begin,/IF v_count>=8/);
  assert.match(begin,/allow_legacy',NOT v_s2/);
});

test('server auto-grades 3 of 3 and the UI requires comment; admin question review is never a release gate',()=>{
  const grader=read('supabase/migrations/20261119221000_kl_s2_sequential_no_timer_series_reflection.sql');
  assert.match(grader,/IF v_correct=3 THEN/);
  assert.match(grader,/UPDATE public\.kl_quiz_attempts SET submitted_at=now\(\),verified_at=now\(\)/);
  assert.match(admin,/ensureQuizReady\(\)/);
  assert.match(admin,/kl-generate-reading-quiz/);
  assert.doesNotMatch(admin,/kl_quiz_admin_review_v1|Review 5 Questions|onPress=\{reviewQuestions\}/);
  assert.match(quiz,/commentRequired = false/);
  assert.match(quiz,/Auto-verified: 3\/3 tama!/);
  assert.match(comment,/onCommentPosted\?\.\(\)/);
  assert.match(comment,/Pagkatapos ma-verify ang 3\/3 quiz/);
  assert.doesNotMatch(sql,/UPDATE private\.kl_s2_reward_rollout SET enabled=true/);
});
