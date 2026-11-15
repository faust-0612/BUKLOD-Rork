import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261115192034_buklod_bible_v4_review_transparency.sql');
const ui=read('src/components/bible/BuklodBibleQuizV4.tsx');
test('optional review endpoint is owner-only, read-only and never returns drafts',()=>{
 assert.match(migration,/actor uuid:=auth\.uid\(\)/);
 assert.match(migration,/where x\.id=p_attempt_id and x\.user_id=actor/);
 assert.match(migration,/if a\.state='started' then return jsonb_build_object\('review',null\)/);
 assert.match(migration,/a\.submitted_answers -> \(j\.review->>'id'\)/);
 assert.match(migration,/with ordinality as j\(review,ordinal\)/);
 assert.match(migration,/grant execute on function public\.get_my_buklod_bible_quiz_v4_review_details\(uuid\) to authenticated/);
 assert.match(migration,/revoke all on function public\.get_my_buklod_bible_quiz_v4_review_details\(uuid\) from public,anon/);
 assert.doesNotMatch(migration,/create or replace function public\.get_my_buklod_bible_quiz_v4\(/);
 assert.doesNotMatch(migration,/update private\.buklod_bible_v4_attempts|insert into public\.buklod_points_ledger/i);
});
test('review labels are unambiguous and optional RPC is nonblocking',()=>{
 assert.match(ui,/Iyong isinagot/);
 assert.match(ui,/Paliwanag sa talata/);
 assert.match(ui,/Mga tinatanggap na sagot/);
 assert.match(ui,/r\.submitted_answer/);
 assert.match(ui,/submitted_answer:answers\[r\.id\]/);
 assert.match(ui,/get_my_buklod_bible_quiz_v4_review_details/);
 assert.match(ui,/setQuiz\(current=>current&&current\.attempt_id===data\.attempt_id/);
 assert.match(ui,/\.catch\(\(\)=>\{\}\)/);
});
