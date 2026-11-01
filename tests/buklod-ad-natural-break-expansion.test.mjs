import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('Android interstitial opportunities cover actual terminal stages, not every tap', () => {
  const bridge = read('src/lib/buklodAdOpportunities.ts');
  for (const slot of ['bible_chapter_success', 'abc_lesson_success', 'learning_assignment_success', 'kl_chapter_success', 'formation_lesson_success']) {
    assert.ok(bridge.includes(slot + ': {'), slot + ' must be registered');
  }
  assert.match(bridge, /if \(Platform\.OS !== 'android'\) return false/);
  assert.match(bridge, /return await maybeShowBuklodInterstitial/);
});

test('Bible completion requires successful RPC before a non-rewarding break', () => {
  const page = read('src/app/bible/read.tsx');
  const method = page.slice(page.indexOf('const markRead ='), page.indexOf('// RENDER', page.indexOf('const markRead =')));
  assert.ok(method.indexOf('if (error) throw error') < method.indexOf("await showBuklodAdOpportunity('bible_chapter_success')"));
  assert.match(method, /if\s*\(\s*completed \|\|\s*marking/);
  assert.match(page, /if \(sessionId && !completed\) warmBuklodAdOpportunity/);
});

test('KL reader ignores duplicates and only shows after new server completion', () => {
  const page = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
  assert.match(page, /chapterCompletionInFlight\.current\) return/);
  assert.match(page, /finally \{\s*chapterCompletionInFlight\.current = false/);
  assert.match(page, /if \(result\?\.new_completion === true\) await showBuklodAdOpportunity\('kl_chapter_success'\)/);
});

test('ABAKA leaves offline completion ad-free and rejects repeated completion ads', () => {
  const page = read('src/app/faith/abc/[lessonId].tsx');
  assert.match(page, /if \(!online\) \{\s*await queueLessonCompletion\(\)/);
  assert.match(page, /if \(data\?\.already_completed === false\) \{\s*await showBuklodAdOpportunity\('abc_lesson_success'\)/);
  assert.ok(page.indexOf('await persistCompletion(\n          true') < page.indexOf("await showBuklodAdOpportunity('abc_lesson_success')"));
});

test('Legacy formation completion and assignment submit ads follow success, not quiz', () => {
  const page = read('src/app/learn/lesson.tsx');
  for (const [method, nextMethod, event] of [
    ['completeLegacyLesson', 'submitAssignment', 'formation_lesson_success'],
    ['submitAssignment', 'submitQuiz', 'learning_assignment_success'],
  ]) {
    const start = page.indexOf('const ' + method + ' = async');
    const end = page.indexOf('const ' + nextMethod + ' = async', start);
    assert.ok(start >= 0 && end > start, method + ' section must exist');
    const chunk = page.slice(start, end);
    const errorGuard = chunk.lastIndexOf('if (error)');
    const adShow = chunk.indexOf("await showBuklodAdOpportunity('" + event + "')");
    assert.ok(errorGuard >= 0 && adShow > errorGuard, method + ' must be post-success');
  }
  const quiz=page.slice(page.indexOf('const submitQuiz = async'),page.indexOf('if (loadState',page.indexOf('const submitQuiz = async')));
  assert.doesNotMatch(quiz,/showBuklodAdOpportunity/);
});

test('Natural-break cadence keeps two-event AdMob safeguard but removes fixed timer/session quotas', () => {
  const policy=read('src/lib/buklodAdMonetizationPolicy.shared.ts');
  assert.match(policy,/INTERSTITIAL_MIN_EVENT_COUNT = 2/);
  assert.match(policy,/INTERSTITIAL_COOLDOWN_MS = 0/);
  assert.match(policy,/INTERSTITIAL_SESSION_CAP = 0/);
  const control=read('src/lib/buklodGlobalAdController.ts');
  assert.match(control,/!hasInteractionLock\(\)/);
  assert.match(control,/fullScreenReservation/);
  assert.match(control,/isBuklodAdRouteSensitive/);
  assert.match(control,/nextCount < Math\.max\(2, INTERSTITIAL_MIN_EVENT_COUNT\)/);
  assert.doesNotMatch(control,/Date\.now\(\) - lastShown/);
  assert.doesNotMatch(control,/fullScreenShownThisSession\s*</);
  assert.match(control,/fullScreenCadenceCheckInFlight/);
  assert.match(control,/fullScreenCadencePersistenceFailed/);
});
