import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const v4=read('supabase/migrations/20261109141500_buklod_bible_quiz_v4_daily_secure.sql');
const route=read('src/app/faith/bible-quiz.tsx');
const classroom=read('src/app/profile/buklod-faculty-class.tsx');
test('Bible V4 is independent from academic Classroom Quiz',()=>{
 assert.match(v4,/private\.buklod_bible_v4_attempts/);
 assert.match(v4,/private\.buklod_r2_bible_quiz_attempts/);
 assert.doesNotMatch(v4,/insert into public\.buklod_quiz_|update public\.buklod_quiz_/i);
 assert.match(route,/BuklodDailyBibleQuizLegacy/);
 assert.match(route,/get_my_buklod_bible_quiz_r3/);
 assert.match(classroom,/FacultyClassroomHeader/);
});
test('one Manila-day source and server-only answer verification',()=>{
 assert.match(v4,/Asia\/Manila/);
 assert.match(v4,/unique\(user_id,local_date\)/);
 assert.match(v4,/bible_quiz:r3:/);
 assert.match(v4,/on conflict\(user_id,source_key\) do nothing/);
 assert.match(v4,/pending_review/);
});
