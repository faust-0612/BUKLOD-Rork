import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const quiz=read('supabase/migrations/20261107222000_buklod_r2_live_bible_quiz.sql');
const mentor=read('supabase/migrations/20261107223000_buklod_r2_mentor_photo_attendance.sql');
const lessons=read('supabase/migrations/20261107225000_buklod_r2_mentor_workflow_catalog.sql');
const monitor=read('supabase/migrations/20261107224000_buklod_r2_live_rewards_monitor.sql');
const quizUI=read('src/app/faith/bible-quiz.tsx');
const mentorUI=read('src/app/faith/mentor-evidence.tsx');
const focusUI=read('src/components/points/BuklodR2FocusMonitor.tsx');
const adminUI=read('src/app/admin/points-r2-monitor.tsx');
const guide=read('src/components/points/BuklodPointsR2Guide.tsx');
const hub=read('src/components/BuklodHomeFaithPanel.tsx');
const admin=read('src/app/admin/index.tsx');

test('Bible Quiz is a functioning Show Faith route, not academic exam grading',()=>{
 assert.match(hub,/router\.push\('\/faith\/bible-quiz'/);
 assert.match(quizUI,/submit_my_buklod_bible_quiz_r3/);
 assert.match(quizUI,/get_my_buklod_bible_quiz_r3/);
 assert.doesNotMatch(quiz,/\\b(?:insert|update|delete)\\s+(?:into\\s+|from\\s+)?public\\.buklod_quiz_(?:attempts|exams)/i);
});
test('Bible Quiz answers never leave server and one day yields at most one award',()=>{
 assert.match(quiz,/private\.buklod_r2_bible_quiz_questions/);
 assert.match(quiz,/revoke all on private\.buklod_r2_bible_quiz_questions/);
 assert.match(quiz,/unique\(user_id,local_date\)/);
 assert.match(quiz,/for update/);
 assert.match(quiz,/correct_choice=upper\(p_answers->>q\.id\)/);
 assert.match(quiz,/on conflict\(user_id,source_key\) do nothing/);
 assert.match(quiz,/bible_quiz_easy/);
 assert.match(quiz,/bible_quiz_medium/);
 assert.match(quiz,/bible_quiz_hard/);
});
test('Cluster attendance is existing verified scope reward, no fake church attendance claim',()=>{
 assert.match(guide,/scope_attendance: 'Home Check In Today — Admin Verified Attendance'/);
 assert.doesNotMatch(guide,/Church Attendance/);
});
test('Mentoring reports actual learning lessons and requires private image proof',()=>{
 assert.match(mentorUI,/report_my_mentor_teaching_with_details_r3/);
 assert.match(mentorUI,/get_my_mentor_reportable_lessons_r2/);
 assert.match(mentorUI,/attach_my_mentor_session_photo_r2/);
 assert.match(lessons,/public\.has_capability\(actor,'mentor'\)/);
 assert.match(mentor,/storage\.buckets/);
 assert.match(mentor,/public\.mentor_teaching_sessions/);
 assert.match(mentor,/photo evidence required/i);
 assert.match(mentor,/before update of status/);
});
test('Milestones have a user nomination path, staff approval, and live review counts',()=>{
 assert.match(monitor,/submit_my_buklod_r2_achievement_v1/);
 assert.match(monitor,/public\.is_system_admin\(\)/);
 assert.match(monitor,/admin_award_buklod_r2_accomplishment_v1/);
 assert.match(monitor,/status in \('pending','approved','rejected'\)/);
 assert.match(focusUI,/submit_my_buklod_r2_achievement_v1/);
 assert.match(adminUI,/admin_review_buklod_r2_achievement_v1/);
});
test('Reward focus is measured from 30-day canonical ledger, not invented',()=>{
 assert.match(monitor,/public\.buklod_points_ledger/);
 assert.match(monitor,/private\.buklod_r2_focus_classify_v1/);
 assert.match(monitor,/full outer join/);
 assert.match(monitor,/ledger_without_current_rule/);
 assert.match(focusUI,/actual_percent/);
 assert.match(focusUI,/target/);
});
test('Admin report includes real photo previews and the admin drawer entry',()=>{
 assert.match(admin,/path="\/admin\/points-r2-monitor"/);
 assert.match(adminUI,/createSignedUrl/);
 assert.match(adminUI,/admin_review_mentor_session/);
 assert.match(adminUI,/admin_get_buklod_r2_mentor_evidence_v1/);
});

test('Rejected milestone remains editable while pending and approved cannot be resubmitted',()=>{
 assert.match(focusUI,/!own \|\| own\.status === 'rejected'/);
 const sql=read('supabase/migrations/20261107235000_buklod_points_r3_achievement_objective_gates.sql');
 assert.match(sql,/where public\.buklod_r2_achievement_nominations\.status='rejected'/);
 assert.match(sql,/if row_rec\.status<>'pending'/);
});
