import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD_CHALLENGES,ADVANCED_FIELD_CHALLENGES,buildFieldChallenge,checkAdvancedField} from '../scripts/kingdom-field-challenges.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('All 39 missions retain canonical IDs and fourteen interaction families',()=>{
 const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
 const ids=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
 assert.equal(ids.length,39);assert.equal(Object.keys(FIELD_CHALLENGES).length,39);
 assert.equal(new Set(ids.map(id=>buildFieldChallenge(id,FIELD_CHALLENGES[id]).type)).size,14);
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
 for(const token of ['func _choose_match','func _choose_merge','func _choose_crop','func _choose_beat','crop_remaining','absf(beat_clock) > timing_window','No line of three. Swap undone.'])assert.ok(state.includes(token),token);
 for(const token of ['_negative_fields(field)','field_total != 104','final_sum != sum'])assert.ok(smoke.includes(token),token);
 for(const token of ['func _play_rhythm_note','rhythm_player.stop()','field_refresh_elapsed >= 0.08'])assert.ok(world.includes(token),token);
 assert.doesNotMatch(state,/HTTPRequest|FileAccess|supabase|grant_bp/i);
});

test('All four Sudoku tiers have unique solutions and genuine different board sizes',async()=>{
 const {SUDOKU_BANK,countSudokuSolutions}=await import('../scripts/kingdom-field-challenges.mjs');assert.deepEqual(SUDOKU_BANK.map(x=>x.size),[4,4,6,6]);for(const tier of SUDOKU_BANK){assert.equal(tier.templates.length,12);for(const puzzle of tier.templates){assert.equal(countSudokuSolutions(puzzle.clues,tier.size,tier.boxRows,tier.boxCols),1);assert.ok(puzzle.clues.some(x=>x===0));assert.ok(puzzle.clues.every((x,i)=>x===0||x===puzzle.solution[i]));}}
});

test('Original word searches are solvable on each difficulty and preserve canonical identities',async()=>{
 const {WORD_SEARCH_BANK,verifyWordTemplate,buildFieldChallenge,FIELD_CHALLENGES}=await import('../scripts/kingdom-field-challenges.mjs');
 let checked=0;for(const [id,tiers] of Object.entries(WORD_SEARCH_BANK)){assert.equal(buildFieldChallenge(id,FIELD_CHALLENGES[id]).type,'wordsearch');assert.deepEqual(tiers.map(x=>x.size),[5,6,7,7]);for(const [tier,bank] of tiers.entries())for(const template of bank.templates){assert.equal(template.words.length,tier+1);assert.ok(verifyWordTemplate(template,bank.size));checked++;}}assert.equal(checked,144);
 const s=read('godot/empire-arena/scripts/kingdom_field_challenge.gd');for(const x of ['func choose_word_cell','func _choose_code','func _choose_domino','code_locked','word_found.has(found)','domino_ends.pop_back()'])assert.ok(s.includes(x),x);
});

test('Realm visuals use bounded original blade, leaf and rock meshes, with readable state-specific field controls',()=>{
 const env=read('godot/empire-arena/scripts/kingdom_original_environment.gd'),w=read('godot/empire-arena/scripts/living_kingdom.gd'),sm=read('godot/empire-arena/tests/living_kingdom_smoke.gd');
 for(const x of ['func _blade_mesh','func _detail_instances','ground_detail_count = 288','canopy_detail_count += 48','SHADOW_CASTING_SETTING_OFF'])assert.ok(env.includes(x),x);
 for(const x of ['field:disabled:','field:hover:','realm_ground_details'])assert.ok(w.includes(x),x);
 assert.ok(sm.includes('count!=80'));assert.ok(sm.includes('1 exact · 2 misplaced'));
});

test('Original interactive 3D stage uses geometry, camera-projected taps, animated scenarios and disabled hidden rendering',()=>{
 const stage=read('godot/empire-arena/scripts/kingdom_interactive_stage.gd'),world=read('godot/empire-arena/scripts/living_kingdom.gd'),smoke=read('godot/empire-arena/tests/living_kingdom_smoke.gd');for(const x of ['Vector2i(1600,800)','Viewport.MSAA_4X','SubViewport.UPDATE_DISABLED','MeshInstance3D.new()','Label3D.new()','project_ray_origin','tile_pressed.emit','MAX_TILES := 56','scene_actor.rotation.y','func _actor'])assert.ok(stage.includes(x),x);assert.ok(world.includes('interactive_stage.sync(field)'));assert.ok(world.includes('interactive_stage.tile_pressed.connect(_stage_input)'));assert.ok(world.includes('Accessible text controls'));assert.ok(smoke.includes('stage.pick_at(screen)'));assert.doesNotMatch(stage,/HTTPRequest|FileAccess|supabase|grant_bp/i);
});
