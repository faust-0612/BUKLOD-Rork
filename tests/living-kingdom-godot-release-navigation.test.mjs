import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildLivingKingdomCatalog} from '../scripts/kingdom-living-realms-catalog.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('39 native adventure specifications derive from canonical existing Kingdom catalogue',()=>{
 const original=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
 const c=buildLivingKingdomCatalog(original);
 assert.equal(c.realms.length,13);assert.equal(c.serverSettlement,false);
 assert.deepEqual(c.realms.flatMap(r=>r.missions.map(m=>m.id)),original.characters.flatMap(r=>r.games.map(m=>m.id)));
 for(const r of c.realms)assert.deepEqual(r.missions.map(m=>m.kind),['collect','sequence','delivery']);
 assert.equal(new Set(c.realms.flatMap(r=>r.missions.map(m=>m.object))).size,39);
});
test('Native Kingdom uses isolated scene, physical arrival and no reward writes',()=>{
 const s=read('godot/empire-arena/scripts/living_kingdom.gd');
 for(const token of ['super.move_to(point)','player.position.distance_to(destination)','quest.visit(index','quest.finish(player.position.distance_to(START))','DAY / NIGHT'])assert.ok(s.includes(token));
 assert.doesNotMatch(s,/HTTPRequest|FileAccess\.WRITE|user:\/\/|grant_bp|supabase/i);
 assert.ok(read('godot/empire-arena/scripts/world_preview.gd').includes('LivingKingdom.tscn" if world_id == "kingdom"'));
 assert.ok(read('scripts/genesis-prepare-godot-ota-pack.mjs').includes('data/kingdom_realms.json'));
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.ok(portal.includes("EXPO_PUBLIC_BUKLOD_LIVING_KINGDOM_DEV === 'true'"));
 assert.ok(portal.includes("openBundledBuklodWorld('kingdom')"));
 assert.doesNotMatch(portal,/\/games\/empire-arena|\/buklod-map/);
 assert.ok(portal.includes('kingdom_map_footer'));
});

test('13 realm visual profiles use distinct authored environments and guide dialogue',()=>{
 const c=buildLivingKingdomCatalog(JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json')));
 const profiles=c.realms.map(r=>r.profile);
 for(const key of ['biome','ground','sky','accent','dialogue','layout'])assert.equal(new Set(profiles.map(x=>x[key])).size,13,key);
 const approved=new Set(['kingdom_tree','house_path','kingdom_chest','house_fence','kingdom_rocks','arena_crystal','arena_tower','arena_flag','house_building','arena_gate','kingdom_wall','house_tree']);
 assert.ok(profiles.every(p=>p.props.length===4&&p.props.every(x=>approved.has(x))&&p.dialogue.length>40));
 const s=read('godot/empire-arena/scripts/living_kingdom.gd');
 for(const token of ['_apply_realm_visuals','_original_hero','_talk_to_guide','guide_near','guide.remove_child(child)','mission_targets[i] = TARGETS[i].rotated','absf(point.z) > 11.5','_apply_daylight','original_environment.build(realm_profile)'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/HTTPRequest|FileAccess\.WRITE|user:\/\/|grant_bp|supabase/i);
});

test('Session chapter continuation is non-credit and never discards completed adventures',()=>{
 const s=read('godot/empire-arena/scripts/living_kingdom.gd');
 for(const token of ['func _next_adventure()','quest.phase != "complete"','quest.cancel()','quest.completed.size()','SESSION DISCOVERIES','realm_picker.select(next_realm)','daylight_update >= 0.2'])assert.ok(s.includes(token),token);
 const state=read('godot/empire-arena/scripts/kingdom_mission_state.gd');
 assert.doesNotMatch(state.slice(state.indexOf('func cancel()')), /completed\.clear/);
});

test('Original 13 hero GLBs and seven PCM cues are generated locally; not sprite recolors',async()=>{
 const {originalKingdomEntries}=await import('../scripts/kingdom-original-media.mjs');
 const {entries,manifest}=originalKingdomEntries();
 assert.equal(manifest.heroes.length,13);assert.equal(manifest.cues.length,7);assert.equal(manifest.soundscapes.length,13);
 assert.equal(new Set(manifest.heroes.map(h=>h.prop)).size,13);
 for(const item of entries){const b=item.bytes;if(item.name.endsWith('.glb')){assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.equal(json.meshes.length,1);assert.ok(json.meshes[0].primitives.length>=9);assert.equal(json.skins.length,1);assert.ok(json.skins[0].joints.length>=15);assert.deepEqual(json.animations.map(a=>a.name),['Idle','Walk','Run','Interact','Celebrate']);}else{assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(40),b.length-44);}}
 const world=read('godot/empire-arena/scripts/living_kingdom.gd');assert.ok(world.includes('kingdom-original/heroes/'));assert.ok(world.includes('kingdom-original/audio/'));assert.doesNotMatch(world,/Sprite3D|art\/fullbody\/|rig_knight/);assert.ok(world.includes('var sound_enabled := false'));
});

test('Living Kingdom generates original terrain and scene geometry and uses animation reactions',()=>{
 const s=read('godot/empire-arena/scripts/living_kingdom.gd');
 assert.doesNotMatch(s,/func _realm_prop|_model\(id\)|Sprite3D/);
 for(const token of ['kingdom_original_ground.gdshader','kingdom_original_environment.gd','_play_avatar_animation("Celebrate")','_play_avatar_animation("Interact")','ambient_player.stop()'])assert.ok(s.includes(token),token);
 const env=read('godot/empire-arena/scripts/kingdom_original_environment.gd');
 for(const token of ['CylinderMesh.new()','PrismMesh.new()','TorusMesh.new()','PlaneMesh.new()','func _tree','func _spire','func _tower'])assert.ok(env.includes(token),token);
 const shader=read('godot/empire-arena/shaders/kingdom_original_ground.gdshader');assert.ok(shader.includes('NORMAL_MAP_DEPTH'));assert.ok(shader.includes('noise2'));
});

test('Original textured glTF materials embed valid PNG color, normal and packed PBR maps',async()=>{
 const {originalKingdomEntries}=await import('../scripts/kingdom-original-media.mjs');const {entries}=originalKingdomEntries();
 for(const {name,bytes:b} of entries.filter(x=>x.name.endsWith('.glb'))){const n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n)),base=28+n;assert.equal(j.images.length,12);assert.equal(j.textures.length,12);for(const im of j.images){const v=j.bufferViews[im.bufferView],png=b.subarray(base+v.byteOffset,base+v.byteOffset+v.byteLength);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),96);assert.equal(png.readUInt32BE(20),96);}assert.ok(j.materials.filter(m=>m.normalTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture).length>=4,name);}
 const env=read('godot/empire-arena/scripts/kingdom_original_environment.gd');for(const q of ['SurfaceTool.new()','generate_normals()','MultiMesh.new()','kingdom_original_water.gdshader','func _rugged_peak','func _leaf_clusters'])assert.ok(env.includes(q));
});

test('Exact generated assets pass strict topology, rig, PBR, animation and audio quality gate',async()=>{
 const {originalKingdomEntries}=await import('../scripts/kingdom-original-media.mjs');const {verifyOriginalKingdomMedia}=await import('../scripts/kingdom-original-media-quality.mjs');const {entries,manifest}=originalKingdomEntries();const report=verifyOriginalKingdomMedia(entries,manifest);assert.equal(report.models,13);assert.equal(report.bones,286);assert.equal(report.textures,156);assert.equal(report.clips,65);assert.equal(report.sounds,20);assert.ok(report.triangles>190000);
});

test('Sculpted original character surfaces and local avatar selection preserve account authority',()=>{
 const source=read('scripts/kingdom-original-media.mjs');const world=read('godot/empire-arena/scripts/living_kingdom.gd');for(const token of ['function sculpt','faceProfile','const physique=','const hipWidth=','Sculpted Character Workshop v3'])assert.ok(source.includes(token),token);for(const token of ['_replace_explorer','_choose_practice_avatar','avatar_picker.disabled = active','Local practice appearance only'])assert.ok(world.includes(token),token);assert.doesNotMatch(world,/grant_bp|update_wallet|supabase/i);
});
