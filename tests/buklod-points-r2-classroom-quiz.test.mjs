import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const db=read('supabase/migrations/20261107222000_buklod_r2_live_bible_quiz.sql');
const attendance=read('supabase/migrations/20261107226000_buklod_r2_cluster_attendance_integrity.sql');
const quizUI=read('src/app/faith/bible-quiz.tsx');
const hub=read('src/components/BuklodHomeFaithPanel.tsx');
test('Bible Quiz cannot issue academic exams grades and answers are server-scored',()=>{
 assert.match(quizUI,/submit_my_buklod_bible_quiz_r3/);
 assert.match(hub,/Daily Bible Quiz/);
 assert.match(db,/correct_choice=upper\(p_answers->>q\.id\)/);
 assert.doesNotMatch(db,/insert into public\.buklod_quiz_attempts/i);
 assert.doesNotMatch(db,/update public\.buklod_quiz_exams/i);
});
test('Cluster attendance credits require real row, active membership, and operator workflow',()=>{
 assert.match(attendance,/attendance_records r/);
 assert.match(attendance,/membership_status='ACTIVE'/);
 assert.match(attendance,/upper\(coalesce\(event_scope_type/);
 assert.match(attendance,/on conflict\(user_id,source_key\) do nothing/);
 assert.match(attendance,/revoke all on function public\.buklod_award_scope_attendance_points_v1/);
 assert.match(attendance,/revoke all on function public\.buklod_reverse_scope_attendance_points_v1/);
});
