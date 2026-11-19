import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261119032356_buklod_bible_v4_acts15_semantic_fairness_20261119.sql');
const regression=read('supabase/tests/buklod_bible_v4_acts15_semantic_20261119.sql');

test('Acts 15 screenshot phrasing is covered in the real database regression',()=>{
 for(const answer of [
  'Huwag kakain ng inihandog sa mga diyus-diyosan',
  'Huwag makiki-apid',
  'Huwag kumain ng handog sa diyos diyusan.',
  'Pakiki-apid',
  'Umiwas sa hayop na binigti',
  'Hindi ipinagbawal ang pakikiapid',
  'Diyos-diyosan'
 ]) assert.ok(regression.includes(answer), 'Missing regression: '+answer);
 assert.match(regression,/\$tests\$/);
 assert.match(regression,/stale<>0/);
});

test('only Acts 15 changes semantic interpretation, not unrelated Bible answers or essay scoring',()=>{
 assert.match(migration,/if q\.id='v4_h_n03' then[\s\S]*?acts15_units\(v_answer,q\.answer_spec\);[\s\S]*?else[\s\S]*?for v_group in/);
 assert.match(migration,/v_essay_feedback:=private\.buklod_bible_v4_grade_essay/);
 assert.match(migration,/where id=p_attempt_id and user_id=actor for update/);
 assert.match(migration,/if a\.state<>'started'/);
 assert.match(migration,/private\.buklod_bible_v4_finalize\(a.id,units\)/);
 assert.match(migration,/private\.buklod_bible_v4_enum_parts\(va.answer\)/);
 assert.match(migration,/revoke all on function private\.buklod_bible_v4_acts15_units\(jsonb,jsonb\)/);
 assert.match(migration,/revoke all on function public\.submit_my_buklod_bible_quiz_v4\(uuid,jsonb\) from public,anon/);
});

test('historical correction is only positive, source-idempotent and bounded by original points policy',()=>{
 assert.match(migration,/where state='completed' and submitted_answers \? 'v4_h_n03'/);
 assert.match(migration,/if v_new<=v_old then continue/);
 assert.match(migration,/source_key/);
 assert.match(migration,/on conflict \(user_id,source_key\) do nothing/);
 assert.match(migration,/coalesce\(v_rule.max_points_per_event,12\),12/);
 assert.match(migration,/insert into public\.notifications/);
 assert.doesNotMatch(migration,/delete from (public|private)\./i);
});
