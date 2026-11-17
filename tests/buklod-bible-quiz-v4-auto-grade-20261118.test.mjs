import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261118002700_buklod_bible_v4_automatic_essay_rubrics.sql');
const historical=read('supabase/migrations/20261118002800_buklod_bible_v4_finalize_pending_essays.sql');
const learner=read('src/components/bible/BuklodBibleQuizV4.tsx');
const admin=read('src/app/admin/bible-v4-events.tsx');

test('Bible Quiz V4 fully automatic rubric path has no manual approval state',()=>{
 assert.match(migration,/private\.buklod_bible_v4_grade_essay\(q\.id,p_answers->>q\.id\)/);
 assert.match(migration,/item_units:=\(v_essay_feedback->>'units'\)::integer/);
 assert.match(migration,/state='started'/);
 assert.match(migration,/out_result:=private\.buklod_bible_v4_finalize\(a\.id,units\)/);
 assert.match(migration,/revoke all on function public\.admin_review_buklod_bible_v4_essay/);
 assert.doesNotMatch(admin,/admin_review_buklod_bible_v4_essay|admin_list_buklod_bible_v4_pending/);
});
test('owner receives rubric, bounded BP and one nonblocking completion notification',()=>{
 assert.match(migration,/rubric_guidance/);
 assert.match(migration,/rubric_feedback/);
 assert.match(migration,/criteria_matched/);
 assert.match(migration,/exception when others then/);
 assert.match(migration,/bible_quiz_result/);
 assert.match(learner,/rubric_feedback\.message/);
 assert.match(learner,/rubric_guidance/);
 assert.match(historical,/where state='pending_review'/);
 assert.match(historical,/private\.buklod_bible_v4_finalize\(a\.id,v_total\)/);
 assert.match(historical,/where not exists/);
});
