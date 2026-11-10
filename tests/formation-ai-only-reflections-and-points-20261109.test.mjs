import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const auto = read('supabase/functions/buklod-formation-auto-process/index.ts');
const edge = read('supabase/functions/buklod-ai-validate-response/index.ts');
const adapter = read('src/lib/buklodAiResponseValidation.ts');
const m1 = read('supabase/migrations/20261109234000_formation_ai_only_quality_bonus_r1.sql');
const m2 = read('supabase/migrations/20261109235500_retire_human_reflection_approvals_r2.sql');
const m3 = read('supabase/migrations/20261110000500_lock_manual_reflection_rpcs_r3.sql');

test('personal reflection fairness preserves substantive source-grounded AI rejection', () => {
  assert.match(auto, /not formal essays or grammar tests/);
  assert.match(auto, /individually evaluate EACH assigned chapter answer/);
  assert.match(auto, /name the affected question numbers in guidance/);
  assert.match(auto, /evaluate reflection and application as two required distinct parts/);
  assert.match(auto, /scores\.overall<\.82\|\|scores\.relevance<\.78\|\|scores\.depth<\.72/);
  assert.match(auto, /const \{parsed,model\}=await callGemini/);
  assert.match(auto, /Automatic checking is temporarily unavailable\. BUKLOD will retry automatically/);
  assert.doesNotMatch(auto, /status\s*=\s*'acceptable'\s*;\s*\/\/\s*bypass/);
});

test('lesson checks are server-authenticated, authoritative and individually evaluated', () => {
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.match(edge, /authoritativeSource=\{lesson_id:lesson\.id/);
  assert.match(edge, /supplied!==fil && supplied!==en/);
  assert.match(edge, /serverVerifiedLessonId:lesson\.id/);
  assert.match(edge, /serverVerifiedContentHash:lesson\.content_hash/);
  assert.match(edge, /Short, sincere, relevant and meaningful responses may be acceptable/);
  assert.match(edge, /scores\.overall<\.82\|\|scores\.relevance<\.78\|\|scores\.depth<\.72/);
  assert.match(adapter, /input\.questionContext\.module === 'lesson'/);
  assert.match(adapter, /functions\.invoke\('buklod-ai-validate-response'/);
});

test('AI quality bonus requires real scored attempt and account-bound source proof', () => {
  assert.match(m1, /v\.model LIKE 'gemini-%'/);
  assert.match(m1, /v\.status = 'acceptable'/);
  assert.match(m1, /v\.fail_open = false/);
  assert.match(m1, /v\.question_context->>'submissionId' = s\.id::text/);
  assert.match(m1, /v\.created_at >= s\.submitted_at/);
  assert.match(m1, />= 0\.90/);
  assert.match(m1, />= 0\.85/);
  assert.match(m1, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(m1, /delta := desired_points - current_net/);
  assert.match(m1, /reflection_quality_reviewed_by = NULL/);
  assert.match(m1, /awarded_by\)\s*VALUES[\s\S]*?NULL\s*\);/);
});

test('human approval and self-credit endpoints are retired without touching separate evidence reviews', () => {
  assert.match(m1, /Manual lesson approval|AI-only|approval is retired/i);
  assert.match(m2, /false::boolean as reviewer_can_act/);
  assert.match(m2, /REVOKE EXECUTE ON FUNCTION public\.record_member_lesson_completion/);
  assert.match(m2, /REVOKE EXECUTE ON FUNCTION public\.buklod_award_rule_mapped_points_v1/);
  assert.match(m3, /REVOKE EXECUTE ON FUNCTION public\.review_daily_bible_reflection_quality_v2/);
  assert.match(m3, /REVOKE EXECUTE ON FUNCTION public\.pastor_validate_learning_progress_v2/);
  assert.match(m3, /REVOKE EXECUTE ON FUNCTION public\.admin_review_daily_bible_submission/);
  assert.match(m2, /v_kind IN \('DAILY_READING','DEVOTION_WORD','LESSON'\)/);
  assert.match(m2, /v_kind NOT IN \('DAILY_READING', 'DEVOTION_WORD', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING'\)/);
});

test('lesson auto-completion avoids simulated reviewer identities and awards once via canonical RPC', () => {
  const section = m1.split('CREATE OR REPLACE FUNCTION public.buklod_try_auto_approve_lesson_v2')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.buklod_review_scope_formation_approval_v2')[0] ?? '';
  assert.match(section, /buklod_lesson_ai_auto_approval_ready_v1/);
  assert.match(section, /buklod_record_lesson_completion_exact_scope_v2/);
  assert.match(section, /approver_id=NULL/);
  assert.match(section, /rec\.learner_id <> actor/);
  assert.doesNotMatch(section, /request\.jwt\.claim\.sub|v_auditor/);
});

test('all reflection monitors show read-only status, no retired approval buttons', () => {
  const monitor = read('src/components/BibleReadingMonitor.tsx');
  const staff = read('src/app/leader/formation.tsx');
  const admin = read('src/app/admin/learning-approvals.tsx');
  const learn = read('src/app/learn/[id].tsx');
  assert.doesNotMatch(monitor, /admin_review_daily_bible_submission|APPROVE BIBLE READING|RETURN FOR REVISION/);
  assert.doesNotMatch(staff, /pastor_validate_learning_progress_v2|\bvalidateLesson\b/);
  assert.doesNotMatch(admin, /admin_review_member_lesson_attempt|APPROVE LEARNING PROGRESS/);
  assert.match(monitor, /No Pastor, Mentor, or Admin approval is needed/);
  assert.match(staff, /Lesson answers and personal reflections are validated by BUKLOD AI/);
  assert.match(learn, /AI Approved/);
});

test('R4 server gate requires real Gemini for every saved and awarded lesson answer', () => {
  const m4 = read('supabase/migrations/20261110114700_formation_real_ai_server_enforcement_r4.sql');
  const helper = m4.split('CREATE OR REPLACE FUNCTION public.buklod_lesson_ai_answer_checked_v3')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.buklod_lesson_ai_auto_approval_ready_v1')[0] ?? '';
  const ready = m4.split('CREATE OR REPLACE FUNCTION public.buklod_lesson_ai_auto_approval_ready_v1')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.assert_buklod_response_validated_v1')[0] ?? '';
  const assertions = m4.split('CREATE OR REPLACE FUNCTION public.assert_buklod_response_validated_v1')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.submit_my_formation_lesson_for_validation_v1')[0] ?? '';
  const submission = m4.split('CREATE OR REPLACE FUNCTION public.submit_my_formation_lesson_for_validation_v1')[1] ?? '';
  assert.match(helper, /coalesce\(v_attempt\.model,''\) NOT LIKE 'gemini-%'/);
  assert.match(helper, /coalesce\(v_attempt\.fail_open,true\) <> false/);
  assert.match(helper, /serverVerifiedLessonId/);
  assert.match(helper, /serverVerifiedContentHash/);
  assert.match(helper, /v_attempt\.created_at < greatest\(/);
  assert.match(helper, /a\.answer_hash=v_hash/);
  assert.match(helper, /v_question = v_lesson\.generated_questions_fil/);
  assert.match(ready, /jsonb_array_length\(v_answers\)<>4/);
  assert.match(ready, /buklod_lesson_ai_answer_checked_v3/);
  assert.match(assertions, /IF coalesce\(p_question_id,''\) LIKE 'lesson:%' THEN/);
  assert.doesNotMatch(assertions.split('IF coalesce((cfg')[0], /buklod_ai_validation_overrides/);
  assert.match(submission, /buklod_try_auto_approve_lesson_v2\(v_approval_id\)/);
  assert.doesNotMatch(submission, /buklod_try_auto_approve_lesson_v1\(/);
  assert.match(submission, /status='REJECTED',approver_id=NULL/);
});

test('lesson UI catches AI outages without double submission or false failed point reports', () => {
  const ui = read('src/components/LearningQuestionResponse.tsx');
  assert.match(ui, /const submissionLock = useRef\(false\)/);
  assert.match(ui, /if \(submissionLock\.current\) return/);
  assert.match(ui, /submissionLock\.current = true/);
  assert.match(ui, /submissionLock\.current = false/);
  assert.match(ui, /const validated = await validateAllFields\(normalized, reflectionText\)/);
  assert.match(ui, /try \{\s*await showBuklodAdOpportunity\('formation_lesson_success'\)/);
  assert.match(ui, /Unable to verify this response/);
});

test('R5 old clients can save lesson drafts, without bypassing Gemini points', () => {
  const m5 = read('supabase/migrations/20261110120500_formation_draft_save_compatibility_r5.sql');
  const submission = m5.split('CREATE OR REPLACE FUNCTION public.submit_learning_lesson_response_v1')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.save_my_formation_lesson_study')[0] ?? '';
  const study = m5.split('CREATE OR REPLACE FUNCTION public.save_my_formation_lesson_study')[1] ?? '';
  assert.match(submission, /enrollment_user <> actor/);
  assert.match(submission, /enrollment_track <> lesson_track/);
  assert.match(submission, /jsonb_array_length\(p_question_answers\) <> 4/);
  assert.doesNotMatch(submission, /assert_buklod_response_validated_v1/);
  assert.match(study, /enrollment_record\.id is null/);
  assert.doesNotMatch(study, /assert_buklod_response_validated_v1/);
  const strict = read('supabase/migrations/20261110114700_formation_real_ai_server_enforcement_r4.sql');
  assert.match(strict, /coalesce\(v_attempt\.model,''\) NOT LIKE 'gemini-%'/);
  assert.match(strict, /buklod_try_auto_approve_lesson_v2\(v_approval_id\)/);
});
