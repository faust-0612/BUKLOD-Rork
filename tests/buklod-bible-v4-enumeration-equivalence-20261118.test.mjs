import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261118002500_buklod_bible_v4_enumeration_equivalence_fairness.sql');
const sqlTest=read('supabase/tests/buklod_bible_v4_enumeration_equivalence_20261118.sql');
test('enumeration grading is server-authoritative and uses normalized reviewed synonyms',()=>{
 assert.match(migration,/create or replace function private\.buklod_bible_v4_enum_normalize/);
 assert.match(migration,/create or replace function private\.buklod_bible_v4_enum_parts/);
 assert.match(migration,/create or replace function public\.submit_my_buklod_bible_quiz_v4/);
 assert.match(migration,/private\.buklod_bible_v4_enum_normalize\(v_answer->>0\)/);
 assert.match(migration,/candidate\.normalized=private\.buklod_bible_v4_enum_normalize\(accepted\.answer\)/);
 assert.match(migration,/item_units:=least\(item_units,2\)/);
 assert.match(migration,/where id=p_attempt_id and user_id=actor for update/);
 assert.match(migration,/if a\.state<>'started'/);
 assert.match(migration,/private\.buklod_bible_v4_finalize\(a\.id,units\)/);
 assert.match(migration,/revoke all on function public\.submit_my_buklod_bible_quiz_v4\(uuid,jsonb\) from public,anon/);
 assert.match(migration,/grant execute on function public\.submit_my_buklod_bible_quiz_v4\(uuid,jsonb\) to authenticated/);
});
test('new helper functions remain private and approved synonyms are appended without replacing the bank',()=>{
 assert.match(migration,/revoke all on function private\.buklod_bible_v4_enum_normalize\(text\)/);
 assert.match(migration,/revoke all on function private\.buklod_bible_v4_enum_parts\(text\)/);
 assert.match(migration,/taniman ng olibo/);
 assert.match(migration,/tahanan/);
 assert.doesNotMatch(migration,/update private\.buklod_bible_v4_attempts/);
 assert.doesNotMatch(migration,/insert into public\.buklod_points_ledger/);
});
test('SQL regression covers screenshot, compound synonyms, negation and duplicate aliases',()=>{
 for(const sample of ['Mga lupa','Mga bahay','Bukirin at ubasan','Taniman ng olibo at tahanan','Hindi lupa','Hindi bahay','mga lupa'])
  assert.ok(sqlTest.includes(sample),sample);
 assert.match(sqlTest,/raise exception 'Enumeration mismatch/);
});
