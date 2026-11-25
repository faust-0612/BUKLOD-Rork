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
 for(const token of ['_apply_realm_visuals','_guide_texture','_talk_to_guide','guide_near','guide_texture_cache.size() >= 2','mission_targets[i] = TARGETS[i].rotated','absf(point.z) > 17.5','_apply_daylight','realm_visuals.get_child_count() >= 20'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/HTTPRequest|FileAccess\.WRITE|user:\/\/|grant_bp|supabase/i);
});
