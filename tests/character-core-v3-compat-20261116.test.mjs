import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261116121000_character_core_v3_collectible_compat.sql');
const task=read('supabase/migrations/20261116120000_character_task_story_art_v1.sql');
const hub=read('src/app/points/character-collections.tsx');

test('Core legacy RPC uses saved V3 XP plus the active window rather than resetting to L1',()=>{
 assert.match(sql,/private\.buklod_character_progress_v3 p/);
 assert.match(sql,/v_active_window:=greatest\(v_lifetime-v_baseline,0\)/);
 assert.match(sql,/v_total:=v_saved\+v_active_window/);
 assert.match(sql,/buklod_character_level_for_delta_v2\(v_total\)/);
 assert.match(sql,/not found then[\s\S]*v_active:='phan'/);
 assert.match(sql,/revoke all on function private\.buklod_character_collectible_progress_v1\(uuid,text\)/);
 assert.doesNotMatch(sql,/update\s+public\.buklod_character_collectible_state/i);
});
test('all 13 have task evidence; older core rewards remain separately available',()=>{
 assert.match(task,/character_id text not null check\(character_id in\s*\('phan','quin','van','christian','lhen'/i);
 assert.match(task,/v_character not in\s*\('phan','quin','van','christian','lhen'/i);
 assert.match(task,/if v_character in \('ace','ellusur'/i);
 assert.match(hub,/getMyCharacterCollectibles\(selected as typeof CORE_CHARACTER_ORDER\[number\]\)/);
 assert.match(hub,/get_my_buklod_character_story_tasks_v1/);
 assert.match(hub,/const keys=new Set\(coreOwned\)/);
});
test('reversed or rejected BP credit ceases to qualify for future cosmetic awards',()=>{
 assert.match(task,/set verified=false/);
 assert.match(task,/set verified=excluded\.verified/);
 assert.match(task,/and verified=true/);
 assert.match(task,/on conflict do nothing/);
});
