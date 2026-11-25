import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD_CHALLENGES,ADVANCED_FIELD_CHALLENGES,buildFieldChallenge,checkAdvancedField} from '../scripts/kingdom-field-challenges.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('All 39 missions retain canonical IDs and ten interaction families',()=>{
 const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
 const ids=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
 assert.equal(ids.length,39);assert.equal(Object.keys(FIELD_CHALLENGES).length,39);
 assert.equal(new Set(ids.map(id=>buildFieldChallenge(id,FIELD_CHALLENGES[id]).type)).size,10);
});
test('Advanced native encounter boards have valid solutions and reject invalid data',()=>{
 assert.equal(Object.keys(ADVANCED_FIELD_CHALLENGES).length,9);
 for(const data of Object.values(ADVANCED_FIELD_CHALLENGES))for(let i=0;i<3;i++)assert.ok(checkAdvancedField(data,i));
 assert.throws(()=>checkAdvancedField({type:'merge',items:[1,1,2,0,0,0,0,0,0],goal:8}));
 assert.throws(()=>checkAdvancedField({type:'match3',items:Array(9).fill('A'),goal:3}));
 assert.throws(()=>checkAdvancedField({type:'farm',items:['A','B'],goal:2,growSeconds:0}));
 assert.throws(()=>checkAdvancedField({type:'rhythm',items:['A','B'],answer:[2,1],beatSeconds:0.8}));
});
test('Native rules retain negative tests, audio isolation and session-only authority',()=>{
 const state=read('godot/empire-arena/scripts/kingdom_field_challenge.gd'),world=read('godot/empire-arena/scripts/living_kingdom.gd'),smoke=read('godot/empire-arena/tests/living_kingdom_smoke.gd');
 for(const token of ['func _choose_match','func _choose_merge','func _choose_crop','func _choose_beat','crop_remaining','absf(beat_clock) > 0.24','No line of three. Swap undone.'])assert.ok(state.includes(token),token);
 for(const token of ['_negative_fields(field)','field_total != 104','final_sum != sum'])assert.ok(smoke.includes(token),token);
 for(const token of ['func _play_rhythm_note','rhythm_player.stop()','field_refresh_elapsed >= 0.08'])assert.ok(world.includes(token),token);
 assert.doesNotMatch(state,/HTTPRequest|FileAccess|supabase|grant_bp/i);
});
