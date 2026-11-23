import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('real original Arena atlas sprites provide animated Kingdom and House characters, not triangles',()=>{
 const world=source('godot/empire-arena/scripts/world_explore_controller.gd');
 const scene=source('godot/empire-arena/scenes/WorldPreview.tscn');
 assert.match(world,/res:\/\/art\/fullbody\//);
 assert.match(world,/HERO_IDS := \[/);
 assert.match(world,/s\.hframes = 4/);
 assert.match(world,/s\.vframes = 2/);
 assert.match(world,/resident_actors\.append\(_sprite\(HERO_IDS\[i\]/);
 assert.match(scene,/world_explore_controller\.gd/);
 assert.match(scene,/InteractiveVisuals/);
 assert.match(world,/avatar_position\.move_toward\(avatar_target/);
});
test('touch gameplay and local House construction do not mint server rewards or grant property',()=>{
 const sourceCode=source('godot/empire-arena/scripts/world_explore_controller.gd');
 assert.match(sourceCode,/InputEventScreenTouch/);
 assert.match(sourceCode,/FIELD\.has_point/);
 assert.match(sourceCode,/get_parent\(\)\.advance_preview_stage\(\)/);
 assert.match(sourceCode,/server_settlement": false/);
 assert.doesNotMatch(sourceCode,/supabase|fetch\(|HTTPClient|HTTPRequest|service_role|payout|grant_bp|purchase_property/i);
});
test('ZIP pack transport aligns with compiled native APK GodotActivity contract',()=>{
 const contract=source('native-genesis/android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GenesisNativeContract.kt');
 const prep=source('native-genesis/prepare-pack-local.sh');
 const gate=source('scripts/genesis-native-local-only-gate.mjs');
 assert.match(contract,/PACK_ASSET = "godot\/empire-arena\.zip"/);
 assert.match(contract,/MAIN_PACK_ARG = "res:\/\/godot\/empire-arena\.zip"/);
 assert.match(prep,/build-empire-godot-pack\.mjs/);
 assert.match(prep,/sha256sum/);
 assert.match(gate,/assets\/godot\/empire-arena\.zip/);
 assert.doesNotMatch(prep,/--export-pack/);
});
