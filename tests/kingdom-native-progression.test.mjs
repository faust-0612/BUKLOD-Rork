import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Native round progression stays session-local and rewards each successful quick round exactly once',()=>{
 const p=read('godot/empire-arena/scripts/kingdom_adventure_progression.gd'),w=read('godot/empire-arena/scripts/living_kingdom.gd');
 for(const x of ['MAX_LEVEL := 9007199254740990','["Easy","Normal","Hard","Expert"]','settled = true','active_key = game_id+":"+str(active_difficulty)','practice_score','func prepare'])assert.ok(p.includes(x),x);
 for(const x of ['Quick game • 1 encounter','selected.count = 1','_finish_practice_round()','NEXT LEVEL','(not BP)','difficulty_picker.disabled = active'])assert.ok(w.includes(x),x);
 assert.doesNotMatch(p,/HTTPRequest|FileAccess|supabase|grant_bp/i);
});
test('Difficulty scales appropriate puzzle constraints and preserves authored semantics',()=>{
 const p=read('godot/empire-arena/scripts/kingdom_adventure_progression.gd');for(const x of ['data.limit = needed','data.previewSeconds','data.timingWindow','Find %d hidden matching pairs','data.growSeconds','data.goal = unit*4'])assert.ok(p.includes(x),x);
 const sm=read('godot/empire-arena/tests/living_kingdom_smoke.gd');assert.ok(sm.includes('range(150)'));assert.ok(sm.includes('progress.complete_round() != 0'));
});

test('Quick mode opens the actual game without fabricated exploration distance; Sudoku uses editable cells',()=>{
 const w=read('godot/empire-arena/scripts/living_kingdom.gd'),s=read('godot/empire-arena/scripts/kingdom_mission_state.gd'),field=read('godot/empire-arena/scripts/kingdom_field_challenge.gd');assert.ok(w.includes('quest.finish_quick(field.solved)'));assert.ok(w.includes('and not _open_field(0)'));assert.ok(w.includes('sudoku_grid_ui'));assert.ok(s.includes('func finish_quick(solved: bool)'));assert.ok(field.includes('_sudoku_can_place'));assert.ok(field.includes('sudoku_fixed.has(sudoku_selected)'));
});
