import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261124100000_bible_v4_enumeration_equivalents.sql',import.meta.url),'utf8');
test('Samaritan bandage equivalent is accepted in first distinct group',()=>{assert.match(sql,/nilagyan ng benda ang sugat/);assert.match(sql,/where id='v4_m_n01'/);});
test('secure grader keeps two distinct answers, cap and account lock',()=>{assert.match(sql,/actor uuid:=auth.uid\(\)/);assert.match(sql,/user_id=actor for update/);assert.match(sql,/Two distinct enumeration answers are required/);assert.match(sql,/item_units:=least\(item_units,2\)/);assert.match(sql,/private.buklod_bible_v4_finalize/);});
test('normalization handles punctuation as spaces and collapses whitespace',()=>{assert.match(sql,/\[\[:space:\]\]\+/);assert.match(sql,/regexp_replace\(va.answer/);});
