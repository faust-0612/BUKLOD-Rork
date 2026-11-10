import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectAuthorizedOfflineLessonIds } from '../src/lib/buklodAuthorizedOfflineLessons.ts';

test('authorized offline lesson cache excludes locked, unreleased and unenrolled lessons', () => {
  const lessons = ['L1', 'L2', 'L3'];
  const base = {
    lessonIds: lessons, isFormation: true, enrolled: true,
    sequential: true, weeklyStage: false, weekly: null,
    access: [['L1', { allowed: true }], ['L2', { allowed: false }]],
  };
  assert.deepEqual(selectAuthorizedOfflineLessonIds(base), {
    allowed: ['L1'], denied: ['L2'],
  });
  assert.deepEqual(selectAuthorizedOfflineLessonIds({ ...base, access: [] }), {
    allowed: [], denied: [],
  });
  assert.deepEqual(selectAuthorizedOfflineLessonIds({
    ...base, sequential: false, weeklyStage: true,
    weekly: { delivery_assigned: true, lessons: [
      { learning_lesson_id: 'L1', access_allowed: true, calendar_released: true, approved: false },
      { learning_lesson_id: 'L2', access_allowed: true, calendar_released: false, approved: false },
      { learning_lesson_id: 'L3', access_allowed: false, calendar_released: false, approved: false },
    ] },
  }), { allowed: ['L1'], denied: ['L3'] });
  assert.deepEqual(selectAuthorizedOfflineLessonIds({
    ...base, isFormation: false, enrolled: false,
  }), { allowed: [], denied: [] });
});

test('faith offline content is account-bound and revoked permissions purge saved lessons', () => {
  const warm = readFileSync(new URL('../src/lib/buklodFaithOfflineWarmup.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/app/learn/lesson.tsx', import.meta.url), 'utf8');
  const track = readFileSync(new URL('../src/app/learn/[id].tsx', import.meta.url), 'utf8');
  assert.match(warm, /isSameSignedInAccount\(userId\)/);
  assert.match(warm, /removeOfflineCache\('lesson-reading-v1:' \+ id, userId\)/);
  assert.match(warm, /granted\.has\(row\.id\)/);
  assert.match(page, /removeOfflineCache\('lesson-reading-v1:' \+ lessonId, accountId\)/);
  assert.match(page, /Date\.now\(\) - saved\.storedAt > 14 \* 24/);
  assert.match(track, /accessVerified && weeklyVerified/);
  assert.match(track, /contentOwner !== user\.id/);
});
