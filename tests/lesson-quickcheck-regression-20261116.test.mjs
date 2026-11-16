import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const answerUI = read('src/components/LearningQuestionResponse.tsx');
const tracker = read('src/components/BuklodFormationEntryScopeTracker.tsx');

test('Quick Check saves an owner-bound server draft before AI validation without awarding points', () => {
  const begin = answerUI.indexOf('const submit = async () =>');
  const submit = answerUI.slice(begin);
  const draft = submit.indexOf("rpc('submit_learning_lesson_response_v1'");
  const validate = submit.indexOf('const validated = await validateAllFields(normalized, reflectionText)');
  const complete = submit.indexOf("rpc('complete_my_formation_lesson_v2'");
  assert.ok(begin >= 0 && draft >= 0 && draft < validate && validate < complete);
  assert.match(submit, /if \(draftError\) throw draftError/);
  assert.match(submit, /if \(submissionLock\.current\) return/);
  assert.match(submit, /submissionLock\.current = true/);
  assert.match(submit, /submissionLock\.current = false/);
  assert.match(answerUI, /\.eq\('lesson_id', lesson\.id\)\s*\.eq\('enrollment_id', enrollmentId\)/);
  assert.doesNotMatch(submit.slice(0, validate), /buklod_points_ledger|reward_amount|manual_approve/);
});

test('Quick Check failures identify exact question and preserve editable answers for retries', () => {
  assert.match(answerUI, /validationIssue\.current = `Tanong \$\{index \+ 1\}/);
  assert.match(answerUI, /validationIssue\.current = `Pagninilay:/);
  assert.match(answerUI, /Na-save ang iyong draft/);
  assert.match(answerUI, /Hindi na kailangang ulitin ang iba mong sagot/);
  assert.match(answerUI, /setAnswerValidations\(nextAnswerValidations\)/);
  assert.match(answerUI, /setReflectionValidation\(reflectionResult\)/);
});

test('general Learn entry captures only a unique active cluster after server verification', () => {
  assert.match(tracker, /pathname === '\/learn'/);
  assert.match(tracker, /feature === 'LESSON' && !exactScope/);
  assert.match(tracker, /rpc\('buklod_my_clusters'\)/);
  assert.match(tracker, /membership_status === 'ACTIVE' && row\?\.scope_status === 'ACTIVE'/);
  assert.match(tracker, /active\.length === 1 \? active\[0\]\.scope_id : null/);
  assert.match(tracker, /rpc\('buklod_set_formation_entry_scope_v1'/);
  assert.match(tracker, /entrySequenceRef\.current !== entrySequence/);
  assert.doesNotMatch(tracker, /service_role|admin\.auth|set_config\(/);
});
