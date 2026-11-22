import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const intake = JSON.parse(source('godot/empire-arena/library/arena_intake_20261122.json'));
const specialIds = ['jawo','mitch','niel','trudice','vhen','angel','ellusur'];
const roles = ['infantry','mage','gunner','siege','healer'];

test('Library intake is complete, bounded, normalized and strictly match-only',()=>{
 assert.equal(intake.schema,1);
 assert.equal(intake.practiceOnly,true);
 assert.deepEqual(Object.keys(intake.heroes).sort(),specialIds.slice().sort());
 assert.deepEqual(Object.keys(intake.minions).sort(),roles.slice().sort());
 assert.deepEqual(Object.keys(intake.villagers).sort(),['lux','tenebra']);
 assert.equal(Object.values(intake.villagers).flatMap(f=>f.villagers).length,12);
 assert.equal(new Set(Object.values(intake.villagers).flatMap(f=>f.villagers.map(v=>v.id))).size,12);
 assert.equal(intake.waves.length,3);
 for(const wave of intake.waves)assert.ok(wave.units.length>0&&wave.units.every(role=>roles.includes(role)));
 for(const [id,kit] of Object.entries(intake.heroes)){
  assert.ok(kit.basic.damage>0&&kit.basic.damage<=100,id+' normalized basic damage');
  assert.ok(kit.basic.range>=2&&kit.basic.range<=15,id+' normalized range');
  assert.ok(kit.basic.cooldown>=250&&kit.basic.cooldown<=3000);
  assert.ok(kit.unlockRank>=1&&kit.unlockRank<=20);
  for(const slot of ['primary','secondary','ultimate']){
   assert.match(kit[slot].id,/^[a-z0-9_]+$/);
   assert.ok(kit[slot].cd>=1000&&kit[slot].cd<=180000);
  }
 }
 for(const v of Object.values(intake.minions)){
  assert.ok(v.hp>0&&v.hp<=400);
  assert.ok(v.speed>0&&v.speed<=5);
  assert.ok(v.damage>=0&&v.damage<=40);
 }
 assert.doesNotMatch(JSON.stringify(intake),/service_role|supabase_url|diamond_payout|award_bp|http:\/\//i);
});

test('native pack includes Library gameplay data without duplicate reward authority',()=>{
 const pack=source('scripts/build-empire-godot-pack.mjs');
 for(const expected of ['arena_intake_20261122.json','catalog.library = libraryIntake',
 'catalog.starter = { ...STARTER_HERO_KITS, ...libraryIntake.heroes }',
 'scripts/arena_library_skills.gd','scripts/arena_library_actors.gd'])
 assert.ok(pack.includes(expected),'Native pack missing '+expected);
 const sim=source('godot/empire-arena/scripts/arena_simulation.gd');
 for(const expected of ['LIBRARY_SKILLS.cast(self, p, identity, direction)',
 'LIBRARY_ACTORS.seed_villagers(self, team)',
 'LIBRARY_ACTORS.advance_waves(self)',
 'LIBRARY_ACTORS.advance_minion(self, unit)',
 'LIBRARY_ACTORS.advance_villager(self, unit)'])
 assert.ok(sim.includes(expected),'Library implementation inactive: '+expected);
 const root=source('godot/empire-arena/scripts/arena_root.gd');
 assert.ok(root.includes('library_minion')&&root.includes('library_name'));
 assert.match(source('godot/empire-arena/tests/library_smoke.gd'),/BUKLOD_GODOT_LIBRARY_SMOKE_PASS/);
});

test('all seven new hero identities dispatch explicit primary, secondary and ultimate effects',()=>{
 const code=source('godot/empire-arena/scripts/arena_library_skills.gd');
 const ids=Object.values(intake.heroes).flatMap(h=>['primary','secondary','ultimate'].map(s=>h[s].id));
 assert.equal(new Set(ids).size,21,'All seven hero kits must have distinct named abilities');
 for(const id of ids)assert.ok(code.includes('"'+id+'"'),'No runtime logic for '+id);
 assert.doesNotMatch(code,/Supabase|Realtime|WebSocket|diamond|award_bp|payout|ranked/i);
 const actors=source('godot/empire-arena/scripts/arena_library_actors.gd');
 assert.ok(actors.includes('MAX_ACTIVE_MINIONS'));
 assert.ok(actors.includes('MAX_ALL_UNITS'));
 assert.ok(actors.includes('VILLAGER_RESPAWN'));
 for(const role of roles)assert.ok(source('godot/empire-arena/library/arena_intake_20261122.json').includes('"'+role+'"'));
 assert.doesNotMatch(actors,/https?:\/\/|service_role|award_bp|diamond_settle|ranked_settlement/i);
});
