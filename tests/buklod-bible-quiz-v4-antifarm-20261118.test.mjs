import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const m=read('supabase/migrations/20261118002900_buklod_bible_v4_essay_antifarming_gate.sql');
const db=read('supabase/tests/buklod_bible_v4_essay_antifarm_20261118.sql');
test('automatic Bible Quiz essays reject keyword stuffing and repeated sentences',()=>{
 assert.match(m,/count\(distinct word\) into distinct_words/);
 assert.match(m,/count\(distinct btrim\(sentence\)\) into substantive_sentences/);
 assert.match(m,/distinct_words>=16/);
 assert.match(m,/substantive_sentences>=needs_sentences/);
 assert.match(m,/reasoning_signal/);
 assert.match(m,/revoke all on function private\.buklod_bible_v4_grade_essay/);
 for(const phrase of ['Keyword-only farming','Repeated-sentence farming','Legitimate finalized essays regressed'])
  assert.ok(db.includes(phrase),phrase);
 assert.doesNotMatch(m,/update private\.buklod_bible_v4_attempts|insert into public\.buklod_points_ledger/);
});
