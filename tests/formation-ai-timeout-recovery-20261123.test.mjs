import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('formation AI upstream is bounded, uses two models, and never silently approves an outage', () => {
  const edge = read('supabase/functions/buklod-ai-validate-response/index.ts');
  assert.match(edge, /signal:AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(edge, /timeoutMs:40000/);
  assert.match(edge, /timeoutMs:17000/);
  assert.doesNotMatch(edge, /'gemini-3\.7-flash','gemini-3\.6-flash'/);
  assert.match(edge, /if\(!parsed\) throw new Error/);
  assert.match(edge, /AI_VALIDATION_TEMPORARILY_UNAVAILABLE/);
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.match(edge, /fail_open:false/);
  assert.doesNotMatch(edge, /failed \(\$\{response\.status\}\): \$\{raw\}/);
});

test('lesson error handling preserves answers and real model validation on every completion', () => {
  const adapter = read('src/lib/buklodAiResponseValidation.ts');
  const lesson = read('src/components/LearningQuestionResponse.tsx');
  assert.match(adapter, /AI lesson checking is temporarily unavailable/);
  assert.match(adapter, /input\.questionContext\.module === 'lesson'/);
  assert.match(lesson, /const acceptedChecks = useRef/);
  assert.match(lesson, /lesson\.content_hash/);
  assert.match(lesson, /!cached\.failOpen && cached\.attemptId && cached\.answerHash/);
  assert.match(lesson, /!cachedReflection\.failOpen && cachedReflection\.attemptId/);
  assert.match(lesson, /setAnswerValidations\(\[\.\.\.nextAnswerValidations\]\)/);
  assert.match(lesson, /const validated = await validateAllFields\(normalized, reflectionText\)/);
  assert.match(lesson, /completionRpcStarted = true/);
  assert.match(lesson, /if \(!completionRpcStarted\)/);
  assert.match(lesson, /submit_learning_lesson_response_v1/);
  assert.match(lesson, /The lesson is not completed yet/);
  assert.match(lesson, /complete_my_formation_lesson_v2/);
  assert.match(lesson, /submissionLock\.current = false/);
});
