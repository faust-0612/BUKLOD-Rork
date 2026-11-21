import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const mentor = read('src/app/faith/mentor-evidence.tsx');
const catalog = read('supabase/migrations/20261122065000_mentor_full_published_catalog_v1.sql');
const response = read('src/components/LearningQuestionResponse.tsx');
const track = read('src/app/learn/[id].tsx');
const detail = read('src/app/learn/lesson.tsx');

test('mentor selector exposes all matching authorized teaching lessons without a 20-option cap', () => {
  assert.match(mentor, /const visibleLessons = lessons\.filter\(lesson =>/);
  assert.doesNotMatch(mentor, /const visibleLessons =[^;]*\.slice\(0,\s*20\)/s);
  assert.match(mentor, /Showing \{visibleLessons\.length\} of \{lessons\.length\}/);
  assert.match(mentor, /mentorEligible === true && !loading/);
  assert.match(mentor, /mentorEligible !== true/);
  assert.match(mentor, /report_my_mentor_teaching_with_details_r3/);
  assert.match(mentor, /MAX_LEARNERS/);
  assert.match(mentor, /private photo/i);
});

test('server catalog contains all published, content-ready BUKLOD tracks but never grants mentor role', () => {
  assert.match(catalog, /public\.has_capability\(actor,'mentor'\)/);
  assert.match(catalog, /t\.status = 'published'/);
  assert.match(catalog, /coalesce\(l\.content_ready, true\) = true/);
  assert.doesNotMatch(catalog, /t\.formation_program in \('ccp','discipleship'\)/i);
  assert.match(catalog, /t\.title \|\| ' · Lesson '/);
  assert.match(catalog, /l\.lesson_number::text/);
  assert.match(catalog, /revoke all on function public\.get_my_mentor_reportable_lessons_r2\(\) from public, anon/);
  assert.match(catalog, /grant execute on function public\.get_my_mentor_reportable_lessons_r2\(\) to authenticated/);
  assert.doesNotMatch(catalog, /insert into public\.(user_capabilities|points)/i);
});

test('lesson checking evaluates every answer and reflection and provides unlimited correction, not automatic unearned completion', () => {
  assert.match(response, /let allAnswersAcceptable = true/);
  assert.match(response, /if \(!isValidationAcceptable\(result\)\) allAnswersAcceptable = false/);
  assert.match(response, /return allAnswersAcceptable && isValidationAcceptable\(reflectionResult\)/);
  assert.match(response, /no permanent failed grade or limit on revisions/i);
  assert.match(response, /setReviewNeeded\(!approved\)/);
  assert.match(response, /result\.ok !== true/);
  assert.match(response, /typeof result\.response_id !== 'string'/);
  assert.match(response, /if \(approved\) \{/);
  assert.match(response, /showBuklodAdOpportunity\('formation_lesson_success'\)/);
  assert.match(response, /completion rewards require verified approval/);
  assert.match(track, /Revise & Retry/);
  assert.match(detail, /REVISE & TRY AGAIN/);
});
