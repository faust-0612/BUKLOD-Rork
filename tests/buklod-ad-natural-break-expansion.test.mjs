import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('Android interstitial opportunities cover actual terminal stages, not every tap', () => {
  const bridge = read('src/lib/buklodAdOpportunities.ts');
  for (const slot of ['bible_chapter_success', 'abc_lesson_success', 'learning_assignment_success', 'kl_chapter_success', 'formation_lesson_success']) {
    assert.match(bridge, new RegExp('\b' + slot + ':\s*\{'));
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
  for (const [method, event] of [['completeLegacyLesson', 'formation_lesson_success'], ['submitAssignment','learning_assignment_success']]) {
    const start=page.indexOf('const '+method+' = async');
    const next=page.indexOf('  const ',start+7);
    const chunk=page.slice(start,next);
    const show=chunk.indexOf("await showBuklodAdOpportunity('"+event+"')");
    assert.ok(show>0 && show>chunk.indexOf("if (error)"),method+' must be post-success');
  }
  const quiz=page.slice(page.indexOf('const submitQuiz = async'),page.indexOf('if (loadState',page.indexOf('const submitQuiz = async')));
  assert.doesNotMatch(quiz,/showBuklodAdOpportunity/);
});

test('High-engagement cadence keeps two-event guard, eight-minute interval and a finite cap', () => {
  const policy=read('src/lib/buklodAdMonetizationPolicy.shared.ts');
  assert.match(policy,/EXPO_PUBLIC_ADS_INTERSTITIAL_MIN_EVENTS,\s*2,\s*2,/);
  assert.match(policy,/EXPO_PUBLIC_ADS_INTERSTITIAL_MIN_INTERVAL_MS,\s*8 \* 60 \* 1000,/);
  assert.match(policy,/EXPO_PUBLIC_ADS_SESSION_INTERSTITIAL_CAP,\s*5,\s*0,\s*5,/);
  const control=read('src/lib/buklodGlobalAdController.ts');
  assert.match(control,/!hasInteractionLock\(\)/);
  assert.match(control,/fullScreenReservation/);
  assert.match(control,/isBuklodAdRouteSensitive/);
  assert.match(control,/nextCount < Math\.max\(1, INTERSTITIAL_MIN_EVENT_COUNT\)/);
  assert.match(control,/Date\.now\(\) - lastShown < Math\.max\(60_000, INTERSTITIAL_COOLDOWN_MS\)/);
});
