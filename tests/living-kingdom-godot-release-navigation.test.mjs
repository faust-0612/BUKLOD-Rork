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
 for(const token of ['_apply_realm_visuals','_original_hero','_talk_to_guide','guide_near','guide.remove_child(child)','mission_targets[i] = TARGETS[i].rotated','absf(point.z) > 17.5','_apply_daylight','realm_visuals.get_child_count() >= 20'])assert.ok(s.includes(token),token);
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
 assert.equal(manifest.heroes.length,13);assert.equal(manifest.cues.length,7);
 assert.equal(new Set(manifest.heroes.map(h=>h.prop)).size,13);
 for(const item of entries){const b=item.bytes;if(item.name.endsWith('.glb')){assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.ok(json.meshes.length>=20);assert.deepEqual(json.animations.map(a=>a.name),['Idle','Walk','Run','Interact','Celebrate']);}else{assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(40),b.length-44);}}
 const world=read('godot/empire-arena/scripts/living_kingdom.gd');assert.ok(world.includes('kingdom-original/heroes/'));assert.ok(world.includes('kingdom-original/audio/'));assert.doesNotMatch(world,/Sprite3D|art\/fullbody\/|rig_knight/);assert.ok(world.includes('var sound_enabled := false'));
});
