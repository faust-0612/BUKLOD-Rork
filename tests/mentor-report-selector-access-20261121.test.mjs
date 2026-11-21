import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const mentorScreen = read('src/app/faith/mentor-evidence.tsx');
const admin = read('src/app/admin/learning/mentors.tsx');
const lessonResponse = read('src/components/LearningQuestionResponse.tsx');
const catalog = read('supabase/migrations/20261121132000_mentor_report_catalog_titles_and_role_clarity.sql');
const roles = read('supabase/migrations/20261121141000_admin_mentor_capability_review_audit_v1.sql');

test('mentor selector distinguishes authorization, empty catalog, no match and failed network', () => {
  assert.match(mentorScreen,/rpc\('has_capability'/);
  assert.match(mentorScreen,/mentorEligible === false/);
  assert.match(mentorScreen,/mentorEligible === true && lessons\.length === 0/);
  assert.match(mentorScreen,/visibleLessons\.length === 0/);
  assert.match(mentorScreen,/Retry loading mentoring access/);
  assert.match(mentorScreen,/const canCreate = mentorEligible === true/);
  assert.ok(mentorScreen.includes(String.raw`replace(/[\s_-]+/g, '')`));
  assert.match(mentorScreen,/report_my_mentor_teaching_with_details_r3/);
});

test('search normalization makes CCP5 and CCP 5 equivalent', () => {
  const normalize=(s)=>s.toLocaleLowerCase().replace(/[\s_-]+/g,'');
  assert.equal(normalize('CCP5'),normalize('CCP 5'));
  assert.ok(normalize('CCP 5: Pinansyal ng Iglesia · Lesson 2').includes(normalize('ccp5')));
});

test('admin cannot silently assign a non-mentor or enable a protected official', () => {
  assert.match(admin,/rpc\('has_capability'/);
  assert.match(admin,/if\(access!==true\)throw/);
  assert.match(admin,/admin_set_mentor_capability_v1/);
  assert.match(admin,/ACTIVATE VERIFIED MENTOR PERMISSION/);
  assert.match(admin,/chosenMentor\?\.role==='system_admin'/);
  assert.match(roles,/public\.is_system_admin\(\)/);
  assert.match(roles,/buklod_foundation_protected_principals/);
  assert.match(roles,/target_role='system_admin'/);
  assert.match(roles,/private\.buklod_mentor_capability_audit_v1/);
  assert.match(roles,/pg_advisory_xact_lock/);
  assert.match(roles,/p_request_key/);
  assert.match(roles,/revoke all on function public\.admin_set_mentor_capability_v1/);
  assert.doesNotMatch(roles,/update public\.profiles p set role/i);
});

test('server lesson catalog remains mentor-authorized and provides CCP track and sequence', () => {
  assert.match(catalog,/public\.has_capability\(actor,'mentor'\)/);
  assert.match(catalog,/t\.title \|\| ' · Lesson '/);
  assert.match(catalog,/l\.lesson_number::text/);
  assert.match(catalog,/grant execute on function public\.get_my_mentor_reportable_lessons_r2\(\) to authenticated/);
  assert.doesNotMatch(catalog,/insert into public\.user_capabilities/i);
});

test('learner completion uses user-scoped saved response and server receipt before success', () => {
  assert.match(lessonResponse,/eq\('user_id', current\.user\.id\)/);
  assert.match(lessonResponse,/result\.ok !== true/);
  assert.match(lessonResponse,/typeof result\.response_id !== 'string'/);
  assert.match(lessonResponse,/BUKLOD lesson receipt:/);
  assert.match(lessonResponse,/Typing answers does not submit them/);
  assert.match(lessonResponse,/complete_my_formation_lesson_v2/);
});
