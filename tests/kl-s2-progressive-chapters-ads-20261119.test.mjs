import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { klS2ChapterPoints, KL_S2_REWARD_DEFAULTS } from '../src/lib/kabihasnang-ligaw/types.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');
const discussion = read('src/components/kabihasnang-ligaw/KlLiveDiscussion.tsx');
const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const dynamic = read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
const quiz = read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');
const opportunities = read('src/lib/buklodAdOpportunities.ts');
const ads = read('src/lib/buklodGlobalAdController.ts');

test('new chapter rewards are base five plus one per numbered chapter, never for invalid numbers', () => {
  assert.equal(KL_S2_REWARD_DEFAULTS.chapterBase, 5);
  assert.equal(KL_S2_REWARD_DEFAULTS.perChapterStep, 1);
  assert.equal(klS2ChapterPoints(1), 6);
  assert.equal(klS2ChapterPoints(5), 10);
  assert.equal(klS2ChapterPoints(30), 35);
  for (const n of [0, -1, 31, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(klS2ChapterPoints(n), 0, 'Invalid chapter ' + n);
  }
});

test('progression and reward grants enforce per-account previous completion in SQL', () => {
  assert.match(sql, /v_chapter_points:=5\+v_episode\.episode_number/);
  assert.match(sql, /previous\.episode_number=required\.n/);
  assert.match(sql, /pg_catalog\.generate_series\(1,chapter\.episode_number-1\)/);
  assert.match(sql, /sessions\.user_id=p_user/);
  assert.match(sql, /sessions\.completed_at IS NOT NULL/);
  assert.match(sql, /IF NOT private\.kl_s2_previous_chapter_complete_v1\(v_user,p_episode_id\)/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF episode_id ON public\.kl_reading_sessions/);
  assert.match(sql, /SET base_points=5,max_points_per_event=35/);
  assert.match(sql, /v_user,v_pending_row\.reward_bp,'kl_episode_completion'/);
  assert.match(sql, /INSERT INTO private\.kl_s2_chapter_pending/);
  assert.match(sql, /v_previous_credit:=v_pending_row\.reward_bp/);
  assert.match(sql, /'kl:episode:'\|\|v_user::text\|\|':'\|\|p_episode_id::text/);
  assert.match(sql, /v_user,50,'kl_season_completion'/);
  assert.doesNotMatch(sql, /v_chapter_points:=15|max_points_per_event=15/);
});

test('unchanged legacy season rewards are locked behind future opt-in activation', () => {
  assert.match(sql, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql, /'2026-12-06 00:00:00\+08'/);
  assert.match(sql, /v_chapter_points integer:=10/);
  assert.match(sql, /IF private\.kl_s2_rewards_enabled_v1\(\) THEN/);
  assert.match(sql, /chapter\.episode_number=0/);
  assert.match(sql, /chapter\.episode_number=0 OR/);
  assert.match(sql, /chapter\.season_number=1/);
  assert.match(sql, /previous_series\.season_number=chapter\.season_number-1/);
  assert.match(sql, /IF v_episode\.episode_number>=1 THEN v_chapter_points:=5\+v_episode\.episode_number/);
});

test('one 20+ character top-level reflection earns at most five BP per chapter', () => {
  assert.match(sql, /char_length\(v_body\) NOT BETWEEN 20 AND 500/);
  assert.match(sql, /v_uid IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(sql, /nullif\(v_row->>'parent_id',''\) IS NOT NULL/);
  assert.match(sql, /v_uid,5,'kl_comment_reflection'/);
  assert.match(sql, /'kl:comment:s2:'\|\|v_uid::text\|\|':'\|\|v_episode::text/);
  assert.match(sql, /IF NOT private\.kl_s2_previous_chapter_complete_v1\(v_uid,v_episode\)/);
});

test('reader screens consult authenticated S2 access while existing chapter path remains backwards-compatible', () => {
  assert.match(reader, /'kl_s2_chapter_access_v1'/);
  assert.match(dynamic, /'kl_s2_chapter_access_v1'/);
  assert.match(reader, /setNotice\(klCopy\.previousChapterRequired\)/);
  assert.match(dynamic, /setChapter\(null\)/);
  assert.match(reader, /KL_RPC\.readEpisode/);
});

test('banner is a lazy inline ad below comments, and interstitial stays after verified new completion', () => {
  assert.ok(discussion.indexOf('comments.map((comment)') < discussion.indexOf('placementId="kl_chapter_discussion_inline"'));
  assert.match(discussion, /format="inline"/);
  assert.match(discussion, /maxHeight=\{250\}/);
  assert.match(discussion, /requireViewport/);
  assert.match(opportunities, /kl_chapter_success:/);
  assert.match(quiz, /if \(result\.completion\.new_completion === true\)/);
  assert.match(quiz, /showBuklodAdOpportunity\('kl_chapter_success'\)/);
  assert.match(ads, /INTERSTITIAL_MIN_EVENT_COUNT/);
  assert.match(ads, /fullScreenCadenceCheckInFlight/);
});

test('deferred chapter rewards are never inserted as points on current chapter completion', () => {
  const completed = sql.slice(sql.indexOf('if v_session.completed_at is null then'),
    sql.indexOf('select count(*) into v_season_count'));
  assert.match(completed, /v_pending_points:=v_chapter_points/);
  assert.match(completed, /IF v_s2_enabled AND v_episode\.episode_number BETWEEN 1 AND 30 THEN/);
  assert.match(completed, /ELSIF NOT v_s2_enabled THEN/);
  assert.match(completed, /v_user,v_pending_row\.reward_bp,'kl_episode_completion'/);
  assert.match(completed, /previous\.season_number=v_episode\.season_number-1/);
  assert.match(completed, /previous\.episode_number=30/);
  assert.match(completed, /pending\.credited_at IS NULL/);
  assert.match(sql, /'pending_points',v_pending_points/);
  assert.match(sql, /'released_previous_chapter_points',v_previous_credit/);
  assert.match(sql, /'points_awarded',v_previous_credit\+/);
  assert.match(quiz, /makukuha kapag natapos ang susunod na kabanata/);
  assert.match(quiz, /mula sa nakaraang kabanata/);
});

test('A partial historical series cannot unlock a later chapter', () => {
  assert.match(sql, /pg_catalog\.generate_series\(1,30\)/);
  assert.match(sql, /previous_series\.episode_number=previous_required\.n/);
  assert.match(sql, /prior_sessions\.user_id=p_user/);
  assert.match(sql, /prior_sessions\.completed_at IS NOT NULL/);
});
