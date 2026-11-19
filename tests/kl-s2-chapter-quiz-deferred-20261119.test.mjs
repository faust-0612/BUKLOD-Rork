import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiz = read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');
const sql = read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');

test('Reader explicitly distinguishes pending points from credited previous chapter points', () => {
  assert.match(quiz, /pending_points\?: number/);
  assert.match(quiz, /released_previous_chapter_points\?: number/);
  assert.match(quiz, /if \(pending > 0\) parts.push/);
  assert.match(quiz, /if \(released > 0\) parts.push/);
  assert.match(quiz, /makukuha kapag natapos ang susunod na kabanata/);
  assert.match(quiz, /mula sa nakaraang kabanata/);
  assert.match(quiz, /chapterRewardFeedback\(completion\)/);
  assert.match(quiz, /chapterRewardFeedback\(result\.completion\)/);
});

test('Only newly verified completion can release the previous chapter, not quiz begin or ad', () => {
  const completion = sql.slice(sql.indexOf("elsif p_action='complete' then"),
    sql.indexOf("select count(*) into v_season_count"));
  assert.ok(completion.includes('IF v_s2_enabled AND v_episode.episode_number BETWEEN 1 AND 30 THEN'));
  assert.ok(completion.includes('SELECT pending.* INTO v_pending_row'));
  assert.ok(completion.includes('IF FOUND THEN'));
  assert.ok(completion.includes("PERFORM public.buklod_award_verification_points_v1("));
  assert.match(quiz, /if \(result\.completion\.new_completion === true\)/);
  assert.match(quiz, /showBuklodAdOpportunity\('kl_chapter_success'\)/);
  assert.doesNotMatch(quiz, /showBuklodRewardedAd/);
  assert.doesNotMatch(sql, /UPDATE public\.buklod_points_ledger/);
});

test('Quiz failures and repeat completions cannot add a new pending chapter entry', () => {
  assert.match(sql, /if v_session.completed_at is null then/);
  assert.match(sql, /v_session\.ping_count<2/);
  assert.match(sql, /kl_quiz_attempts/);
  assert.match(sql, /ON CONFLICT \(user_id,episode_id\) DO NOTHING/);
  assert.match(sql, /WHERE pending\.user_id=v_user AND pending\.credited_at IS NULL/);
  assert.match(sql, /ledger\.direction='credit' AND ledger\.points=v_pending_row\.reward_bp/);
});
