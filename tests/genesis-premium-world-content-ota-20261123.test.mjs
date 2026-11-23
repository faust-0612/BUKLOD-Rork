import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
test('Arena prioritizes owner-supplied sprite and map art over primitive stand-in graphics',()=>{
 const arena=read('godot/empire-arena/scripts/arena_root.gd');
 assert.match(arena,/var large := 18\.0 if is_hero else 7\.0/);
 assert.match(arena,/if not is_hero:\s*draw_circle\(pos \+ shift/);
 assert.match(arena,/fullbody\/.*_pose|fullbody\/.*pose|hero_id \+ "_" \+ pose/);
 assert.match(arena,/draw_texture_rect_region\(frame_texture/);
 assert.match(arena,/Vector2\(large \* 3\.9, large \* 3\.9\)/);
 assert.match(arena,/scenery, Rect2\(Vector2\.ZERO, Vector2\(w, h\)\)/);
 assert.match(arena,/0\.98\)\)/);
 assert.doesNotMatch(arena,/ranked_reward|grant_bp|supabase\.from|service_role/i);
});
test('Kingdom has 13 authored animated character atlases, not triangle substitutes',()=>{
 const parent=read('godot/empire-arena/scripts/world_preview.gd');
 const explore=read('godot/empire-arena/scripts/world_explore_controller.gd');
 assert.match(explore,/const HERO_IDS := \[/);
 assert.match(explore,/HERO_IDS\.size\(\)/);
 assert.match(explore,/art\/fullbody\/.*_idle\.png/);
 assert.match(explore,/load_png_from_buffer/);
 assert.match(explore,/sprite\.hframes = 4/);
 assert.match(explore,/sprite\.vframes = 2/);
 assert.match(explore,/resident_actors\.append\(_sprite\(HERO_IDS\[i\]/);
 assert.doesNotMatch(parent,/draw_colored_polygon\(PackedVector2Array\(\[pos \+ Vector2\(-20, 14\)/);
});
test('Tap-to-move preserves GUI and physical arrival before House stage changes',()=>{
 const world=read('godot/empire-arena/scripts/world_explore_controller.gd');
 assert.match(world,/func _unhandled_input\(event: InputEvent\)/);
 assert.doesNotMatch(world,/func _input\(event: InputEvent\)/);
 assert.match(world,/pending_house = true/);
 assert.match(world,/avatar_position\.distance_to\(avatar_target\) <= ARRIVAL_RADIUS/);
 assert.match(world,/func _arrive\(\)/);
 assert.match(world,/get_parent\(\)\.advance_preview_stage\(\)/);
 assert.match(world,/next_interaction_time = elapsed \+ INTERACTION_COOLDOWN/);
 assert.match(world,/server_settlement": false/);
 const parent=read('godot/empire-arena/scripts/world_preview.gd');
 assert.match(parent,/func world_interaction\(cue: String, message: String\)/);
 assert.match(parent,/AudioStreamWAV\.load_from_buffer/);
 assert.doesNotMatch(parent,/func _unhandled_input\(event: InputEvent\)/);
});
test('Game pack is the same deterministic approved art and audio source used by OTA',()=>{
 const pack=read('scripts/build-empire-godot-pack.mjs');
 const ota=read('scripts/genesis-prepare-godot-ota-pack.mjs');
 assert.match(pack,/fullbody: 52, scene: 3, sprite: 13/);
 assert.match(pack,/audioEntries\.length, 70/);
 assert.match(pack,/JSON\.stringify\(audioManifest\)/);
 assert.doesNotMatch(pack,/prototype:true/);
 assert.match(pack,/world-art\/kingdom\.webp/);
 assert.match(pack,/world-art\/house\.webp/);
 assert.match(ota,/scripts\/build-empire-godot-pack\.mjs/);
 assert.match(ota,/GENESIS_GODOT_OTA_PACK_PREPARED/);
});

test('Owner Library Kingdom collections are shipped as 42 real cosmetic WebP items',()=>{
 const pack=read('scripts/build-empire-godot-pack.mjs');
 const preview=read('godot/empire-arena/scripts/world_preview.gd');
 assert.match(pack,/KINGDOM_ITEM_CLASSES = \['badge','bond','book','chest','crystal','light','relic'\]/);
 assert.match(pack,/kingdomItemCount,42/);
 assert.match(pack,/kingdom-items\/.*filename/);
 assert.match(preview,/FileAccess\.get_file_as_bytes\("res:\/\/kingdom-items\//);
 assert.match(preview,/load_webp_from_buffer/);
 assert.match(preview,/var badge: Texture2D = _kingdom_item\(i\)/);
 assert.doesNotMatch(preview,/grant_bp|create_inventory|update_wallet|purchase_property/);
});

test('Original BUKLOD audio is bundled but ambient playback defaults OFF',()=>{
 const pack=read('scripts/build-empire-godot-pack.mjs');
 const preview=read('godot/empire-arena/scripts/world_preview.gd');
 const explore=read('godot/empire-arena/scripts/world_explore_controller.gd');
 for(const name of ['buklod-kingdom-ambient-original.wav','buklod-kingdom-cinematic-ambient.wav'])
   assert.ok(pack.includes(name));
 assert.ok(preview.includes('var ambient_enabled: bool = false'));
 assert.ok(preview.includes('func _toggle_ambience() -> void:'));
 assert.ok(preview.includes('track.loop_mode = AudioStreamWAV.LOOP_FORWARD'));
 assert.ok(preview.includes('ambient_player.volume_db = -24.0'));
 assert.ok(preview.includes('ambient_button.text = "MUSIC ON" if ambient_enabled else "MUSIC OFF"'));
 assert.ok(explore.includes('get_parent().world_interaction("", interaction_label)'));
});

test('70 Arena cues are recorded CC0/original-based, not procedural sine placeholders',()=>{
 const audio=read('scripts/arena-library-audio-pack.mjs');
 const native=read('godot/empire-arena/scripts/arena_audio.gd');
 const pack=read('scripts/build-empire-godot-pack.mjs');
 assert.match(audio,/kind:'layered-real-recordings'/);
 assert.match(audio,/prototype:false/);
 assert.match(audio,/assets\/sounds\/kingdom-premium\/LICENSES\.md/);
 assert.match(audio,/RECORDED_SOURCES/);
 assert.match(audio,/riffPcm\(bytes,src\.id\)/);
 assert.doesNotMatch(audio,/Math\.sin\(|Math\.cos\(|PLACEHOLDER_V1|procedural preview audio/);
 assert.match(native,/AudioStreamWAV\.load_from_buffer\(raw\)/);
 assert.doesNotMatch(native,/AudioStreamWAV\.load_from_file\(/);
 assert.match(pack,/arenaSfxEntries\(root\)/);
 assert.match(pack,/JSON\.stringify\(audioManifest\)/);
});
