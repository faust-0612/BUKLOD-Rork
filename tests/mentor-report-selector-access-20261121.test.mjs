import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screen = read('src/app/faith/mentor-evidence.tsx');
const admin = read('src/app/admin/learning/mentors.tsx');
const migration = read('supabase/migrations/20261121132000_mentor_report_catalog_titles_and_role_clarity.sql');

test('teaching report keeps role gate and distinguishes missing access from no lesson match', () => {
  assert.match(screen, /rpc\('has_capability'/);
  assert.match(screen, /mentorEligible === false/);
  assert.match(screen, /mentorEligible === true && lessons\.length === 0/);
  assert.match(screen, /visibleLessons\.length === 0/);
  assert.ok(screen.includes(String.raw`replace(/[\s_-]+/g, '')`));
  assert.match(screen, /report_my_mentor_teaching_with_details_r3/);
});

test('admin does not silently present a relationship as an authorized mentor', () => {
  assert.match(admin, /rpc\('has_capability'/);
  assert.match(admin, /if\(mentorAccess!==true\)return/);
  assert.match(admin, /from\('mentor_assignments'\)\.upsert/);
});

test('catalog shows track and lesson number but never bypasses server mentor capability', () => {
  assert.match(migration, /public\.has_capability\(actor,'mentor'\)/);
  assert.match(migration, /t\.title \|\| ' · Lesson '/);
  assert.match(migration, /l\.lesson_number::text/);
  assert.match(migration, /grant execute on function public\.get_my_mentor_reportable_lessons_r2\(\) to authenticated/);
  assert.doesNotMatch(migration, /insert into public\.user_capabilities/i);
});
