import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261111010000_kl_auto_reading_quiz_v1.sql');
const generator = read('supabase/functions/kl-generate-reading-quiz/index.ts');
const quiz = read('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');
const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const dynamic = read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');

test('approving an actual manuscript queues precisely five source-grounded questions', () => {
  assert.match(migration, /AFTER INSERT OR UPDATE OF status,approved_at,manuscript ON public\.kl_episodes/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.kl_quiz_sync_approval_v1/);
  assert.match(migration, /jsonb_array_length\(p_items\)<>5/);
  assert.match(migration, /position\(v_e in v\.manuscript\)=0/);
  assert.match(generator, /Generate EIGHT candidate factual reading-comprehension/);
  assert.match(generator, /manuscript\.includes\(evidence\)/);
  assert.match(reader, /prepareQuizForApprovedChapter\(serverChapter\.id\)/);
  assert.match(reader, /const quizFeedback = action === 'approve'/);
  assert.match(reader, /Check \/ Retry 5 Reading Questions/);
});

test('members receive only three random questions; correct answer and evidence remain private', () => {
  assert.match(migration, /ORDER BY random\(\) LIMIT 3/);
  assert.match(migration, /'question',question_text,'options',options/);
  assert.doesNotMatch(migration, /'correct_index',correct_index/);
  assert.match(migration, /REVOKE ALL ON public\.kl_quiz_sets,public\.kl_quiz_questions,public\.kl_quiz_attempts/);
  assert.match(migration, /ALTER TABLE public\.kl_quiz_questions ENABLE ROW LEVEL SECURITY/);
  assert.match(quiz, /'kl_quiz_begin_v1'/);
  assert.match(quiz, /'kl_quiz_submit_v1'/);
  assert.match(reader, /<KlReadingQuiz/);
  assert.match(dynamic, /<KlReadingQuiz/);
});

test('server requires all three correct and awards no duplicate chapter rewards', () => {
  assert.match(migration, /IF v_correct=3 THEN/);
  assert.match(migration, /verified_at=now\(\)/);
  assert.match(migration, /public\.kl_reading_progress_v1\(v\.episode_id,'complete'\)/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM public\.kl_quiz_attempts a/);
  assert.match(migration, /kl_quiz_rollout/);
  assert.match(migration, /ON CONFLICT\(user_id,episode_id\) DO NOTHING/);
  assert.match(migration, /v\.submitted_at IS NOT NULL/);
  assert.match(quiz, /result\.completion\.new_completion === true/);
});

test('generation is authenticated/admin only and failures are non-destructive', () => {
  assert.match(generator, /await client\.auth\.getUser\(\)/);
  assert.match(generator, /kl_quiz_admin_context_v1/);
  assert.match(generator, /GEMINI_API_KEY/);
  assert.match(generator, /generativelanguage\.googleapis\.com/);
  assert.match(generator, /evidence\.toLocaleLowerCase\(\)\.includes/);
  assert.doesNotMatch(generator, /api\.openai\.com|OPENAI_API_KEY/);
  assert.match(migration, /Correct answer must appear verbatim in the approved evidence/);
  assert.match(generator, /maxOutputTokens: 2700/);
  assert.match(migration, /role::text='system_admin' AND is_active=true/);
  assert.match(migration, /md5\(v\.manuscript\)<>p_manuscript_hash/);
  assert.match(migration, /ON CONFLICT DO NOTHING/);
});


test('staged OTA permits safe 60-second fallback only while enforcement is disabled and questions are pending', () => {
  assert.match(migration, /'allow_legacy',NOT coalesce\(\(SELECT enforce_quiz/);
  assert.match(quiz, /result\?\.reason === 'questions_preparing' && result\?\.allow_legacy === true/);
  assert.match(quiz, /const completeLegacy = async/);
  assert.match(quiz, /p_episode_id: episodeId, p_action: 'complete'/);
  assert.match(migration, /kl_quiz_release_ready_guard_v1/);
  assert.match(reader, /'kl_quiz_admin_context_v1'/);
  assert.match(reader, /Retry muna sa KL Admin bago mag-release/);
});


test('live KL model 404 is handled with current Flash-Lite alternatives and useful admin errors', () => {
  assert.match(generator, /gemini-3\.5-flash-lite/);
  assert.match(generator, /gemini-3\.1-flash-lite/);
  assert.match(generator, /response\.status === 404/);
  assert.match(generator, /generator_model_unavailable/);
  assert.match(generator, /response\.status === 429/);
  assert.match(generator, /generator_quota_limited/);
  assert.match(reader, /generator_model_unavailable/);
  assert.match(reader, /typeof response\?\.json === 'function'/);
  // Never bypass protected admin/approved-manuscript checks on fallback.
  assert.match(generator, /await client\.auth\.getUser\(\)/);
  assert.match(generator, /kl_quiz_admin_context_v1/);
  assert.match(generator, /validatedItems\(parsed, context\.manuscript, excerpts\)/);
});

test('generator picks 5 source-validated questions from 8 candidates with bounded calls', () => {
  assert.match(generator, /function sourceExcerpts\(manuscript: string\)/);
  assert.match(generator, /const evidence = excerpts\.find/);
  assert.match(generator, /required: \["question", "options", "correct_index", "evidence_id"\]/);
  assert.match(generator, /minItems: 8, maxItems: 8/);
  assert.match(generator, /const valid = validatedItems\(parsed, context\.manuscript, excerpts\)/);
  assert.match(generator, /if \(collected\.length < 5\) continue/);
  assert.match(generator, /p_items: collected\.slice\(0, 5\)/);
  assert.match(generator, /if \(!unsupportedModel\) return reply\(422/);
  assert.match(generator, /const timeout = setTimeout\(\(\) => controller\.abort\(\), 24000\)/);
  assert.doesNotMatch(generator, /text: instructions \+.*APPROVED MANUSCRIPT/);
});

test('KL Admin can review 5 stored questions but reader never fetches admin answer keys', () => {
  const review = read('supabase/migrations/20261112043503_kl_admin_question_review_v1_20261112.sql');
  assert.match(review, /FUNCTION public\.kl_quiz_admin_review_v1\(p_episode_id uuid\)/);
  assert.match(review, /role::text = 'system_admin' AND is_active = true/);
  assert.match(review, /REVOKE ALL ON FUNCTION public\.kl_quiz_admin_review_v1\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(review, /v_bank_hash IS DISTINCT FROM v_hash/);
  assert.match(review, /'correct_index', x\.correct_index/);
  assert.match(reader, /'kl_quiz_admin_review_v1'/);
  assert.match(reader, /Tingnan ang 5 Tanong at Sagot/);
  assert.match(reader, /quizReviews\[episode\.id\]\.questions\?\.map/);
  assert.doesNotMatch(quiz, /kl_quiz_admin_review_v1/);
});
