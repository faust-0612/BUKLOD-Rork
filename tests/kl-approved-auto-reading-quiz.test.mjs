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
  assert.match(generator, /EXACTLY FIVE simple/);
  assert.match(generator, /manuscript\.includes\(evidence\)/);
  assert.match(reader, /prepareQuizForApprovedChapter\(serverChapter\.id\)/);
  assert.match(reader, /if \(action === 'approve'\)/);
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
  assert.match(generator, /OPENAI_API_KEY/);
  assert.match(generator, /max_output_tokens: 2300/);
  assert.match(migration, /role::text='system_admin' AND is_active=true/);
  assert.match(migration, /md5\(v\.manuscript\)<>p_manuscript_hash/);
  assert.match(migration, /ON CONFLICT DO NOTHING/);
});
