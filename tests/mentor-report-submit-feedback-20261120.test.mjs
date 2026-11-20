import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('src/app/faith/mentor-evidence.tsx', 'utf8');

test('a mentoring report never silently ignores submit when requirements are missing', () => {
  assert.match(form, /const missingReportRequirements = \[/);
  assert.match(form, /if \(missingReportRequirements\.length > 0\) \{/);
  assert.match(form, /Alert\.alert\('Complete required details', details\)/);
  assert.match(form, /Review requirements to submit/);
  assert.doesNotMatch(form, /disabled=\{!canCreate\}/);
  assert.match(form, /disabled=\{busy !== null\}/);
});

test('missing requirements explain each server-enforced field without bypassing consent or photo proof', () => {
  for (const condition of [
    '!selectedLesson',
    'selectedDisciples.length < 1',
    'selectedDisciples.length > MAX_LEARNERS',
    'location.trim().length < 4',
    'notes.trim().length < 20',
    '!photo',
    '!consent',
  ]) {
    assert.ok(form.includes(condition), `missing safeguard: ${condition}`);
  }
  const start = form.indexOf('const createSession = async () => {');
  const gate = form.indexOf("if (!beginAction('creating')) return;", start);
  const rpc = form.indexOf("'report_my_mentor_teaching_with_details_r3'", start);
  assert.ok(start >= 0 && gate > start && rpc > gate,
    'validation and action lock must precede the server write');
  assert.match(form, /await uploadPhoto\(confirmedSessionId, photo\)/);
  assert.match(form, /setRetrySessionId\(confirmedSessionId\)/);
});
