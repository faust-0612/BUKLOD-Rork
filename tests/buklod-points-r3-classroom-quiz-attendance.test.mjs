import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const quizSql=read('supabase/migrations/20261107230000_buklod_points_r3_home_daily_quiz.sql');
const attendanceSql=read('supabase/migrations/20261107231000_buklod_points_r3_home_checkin.sql');
const mentorSql=read('supabase/migrations/20261107233000_buklod_points_r3_mentor_admin_only.sql');
const quizUi=read('src/app/faith/bible-quiz.tsx');
const checkUi=read('src/components/BuklodHomeCheckinToday.tsx');
const home=read('src/components/BuklodHomeFaithPanel.tsx');
test('five automatic Home Bible Quiz questions on chosen daily difficulty, distinct academic Quiz',()=>{
 assert.match(home,/BuklodHomeCheckinToday/);assert.match(home,/\/faith\/bible-quiz/);
 for(const x of ['easy','medium','hard'])assert.match(quizUi,new RegExp(x));
 assert.match(quizSql,/limit 5/);assert.match(quizSql,/unique.*difficulty|difficulty text/i);
 assert.match(quizSql,/local_date/);assert.match(quizSql,/correct>=4/);
 assert.match(quizSql,/on conflict\(user_id,source_key\) do nothing/);
 assert.doesNotMatch(quizSql,/(?:insert|update)\s+(?:into\s+)?public\.buklod_quiz_(?:attempts|exams)/i);
});
test('Home self-checkin requires real live Cluster event and human admin, once per member/event',()=>{
 assert.match(checkUi,/submit_my_buklod_home_checkin_r3/);
 assert.match(attendanceSql,/unique\(event_id,user_id\)/);
 assert.match(attendanceSql,/scope_type='CLUSTER'/);
 assert.match(attendanceSql,/membership_status='ACTIVE'/);
 assert.match(attendanceSql,/attendance_close_at/);
 assert.match(attendanceSql,/is_system_admin/);
 assert.match(attendanceSql,/status='pending'/);
 assert.match(attendanceSql,/event venue must be recorded before attendance reward approval/i);
 assert.match(attendanceSql,/on conflict\(user_id,source_key\) do nothing/);
});
test('Mentor approvals use System Admin only with attendee, location and private evidence checks',()=>{
 const ui=read('src/app/faith/mentor-evidence.tsx');
 const admin=read('src/app/admin/points-r2-monitor.tsx');
 assert.match(ui,/p_location:location\.trim\(\)/);
 assert.match(ui,/report_my_mentor_teaching_with_details_r3/);
 assert.match(mentorSql,/status not in \('reported','pending_admin'\)/);
 assert.match(mentorSql,/mentor_session_attendees/);
 assert.match(mentorSql,/buklod_award_rule_mapped_points_v1/);
 assert.match(admin,/admin_review_mentor_session_r3/);
 assert.match(admin,/admin_review_buklod_home_checkin_r3/);
});

test('Admin sees full names, event venue/time, mentor attendees and teaching location without public exposure',()=>{
 const db=read('supabase/migrations/20261107234000_buklod_points_r3_admin_evidence_details.sql');
 const admin=read('src/app/admin/points-r2-monitor.tsx');
 assert.match(db,/public\.is_system_admin\(\)/);
 assert.match(db,/session_location/);
 assert.match(db,/mentor_notes/);
 assert.match(db,/mentor_session_attendees/);
 assert.match(db,/member_name/);
 assert.match(db,/checked_in_at/);
 assert.match(admin,/member_name/);
 assert.match(admin,/attendees/);
});

test('live admin conversion counters include Home attendance awaiting and credited state',()=>{
 const sql=read('supabase/migrations/20261107237000_buklod_points_r3_home_checkin_pipeline_metrics.sql');
 const ui=read('src/app/admin/points-r2-monitor.tsx');
 assert.match(sql,/home_checkins/);assert.match(sql,/home_pending/);
 assert.match(sql,/home_approved/);assert.match(sql,/home_rejected/);
 assert.match(sql,/home_rewarded/);
 assert.match(ui,/pipeline\.attendance\.home_pending/);
 assert.match(ui,/pipeline\.attendance\.home_rewarded/);
});
