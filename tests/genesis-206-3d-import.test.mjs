import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('godot/empire-arena/library/verified_cc0_3d_manifest.json'));
test('Kenney GLB imports pinned to one 40-hex commit and exact per-model source blob',()=>{
 assert.equal(manifest.source.license,'CC0-1.0');
 assert.equal(manifest.source.repository,'Hidencod/tge-assets');
 assert.match(manifest.source.commit,/^[a-f0-9]{40}$/);
 assert.equal(manifest.models.length,20);
 assert.equal(manifest.rigs.length,2);
 assert.equal(manifest.animatedSource.license,'CC0-1.0');
 for(const rig of manifest.rigs){
   assert.match(rig.gitBlob,/^[a-f0-9]{40}$/);
   assert.ok(rig.bytes>100000&&rig.bytes<5000000);
 }
 assert.equal(new Set(manifest.models.map(x=>x.id)).size,20);
 for(const a of manifest.models){
  assert.match(a.path,/^packs\/[a-z0-9-]+\/[a-z0-9-]+\.glb$/);
  assert.match(a.gitBlob,/^[a-f0-9]{40}$/);
  assert.ok(a.bytes>2000&&a.bytes<512000);
 }
});
test('Strict binary glTF2 mesh validation and Git blob hashing precede verified pack',()=>{
 const importSource=read('scripts/genesis-import-verified-3d.mjs');
 for(const key of ['Git blob mismatch','GLB length mismatch','glTF','JSON','GLB version 2','doc.meshes','sha256'])
  assert.ok(importSource.includes(key),key);
 assert.doesNotMatch(importSource,/eval\(|spawn\(|http:\/\/|service_role|supabase/i);
 const pack=read('scripts/build-empire-godot-pack.mjs');
 assert.match(pack,/BUKLOD_GENESIS_PREMIUM_3D === 'true'/);
 assert.match(pack,/3d\/kenney\/.*\.glb/);
 assert.match(pack,/data\/3d_manifest.json/);
 assert.match(pack,/crypto|sha256/);
 assert.match(pack,/assert.ok\(total>6\*1024\*1024 && total<16\*1024\*1024/);
});
test('3D preview is optional, preserves original 2D Arena control and Kingdom UI',()=>{
 const root=read('godot/empire-arena/scripts/arena_root.gd');
 const world=read('godot/empire-arena/scripts/world_preview.gd');
 const preview=read('godot/empire-arena/scripts/premium_world_3d.gd');
 assert.match(root,/preview3d_button/);
 assert.match(root,/if running or not FileAccess.file_exists/);
 assert.match(root,/preview3d_button.hide\(\)/);
 assert.match(world,/FileAccess.file_exists\("res:\/\/3d\/kenney\/arena_hero_a.glb"\)/);
 assert.match(world,/scenes\/PremiumWorld3D.tscn/);
 assert.match(preview,/GLTFDocument.new\(\)/);
 assert.match(preview,/append_from_buffer/);
 assert.match(preview,/generate_scene/);
 assert.match(preview,/MAX_MESH_SCENES := 65/);
 assert.match(preview,/func move_to\(point: Vector3\) -> bool/);
 assert.match(preview,/func _unhandled_input\(event: InputEvent\)/);
 assert.match(preview,/server_settlement": false/);
 assert.match(preview,/_play_avatar_animation\("Walk" if motion.length_squared/);
 assert.match(preview,/model_templates.has\("rig_knight"\)/);
 assert.doesNotMatch(preview,/HttpRequest|Supabase|award_.*xp|grant_bp|ranked_reward|purchase_property/i);
});
