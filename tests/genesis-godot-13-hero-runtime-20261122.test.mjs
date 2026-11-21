import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEROES} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Godot native pack carries all 13 OWNER approved identities and exactly 6 original .gd scripts',()=>{
  const owner=JSON.parse(read('godot/empire-arena/data/owner-13-hero-design-v1.json'));
  assert.equal(owner.heroes.length,13);
  const ids=owner.heroes.map(x=>x.id);
  assert.equal(new Set(ids).size,13);
  assert.deepEqual(new Set(ids),new Set(Object.keys(HEROES)));
  assert.equal(owner.hero_contract.passive_count,1);
  assert.equal(owner.hero_contract.active_skill_count,2);
  assert.equal(owner.hero_contract.ultimate_count,1);
  assert.equal(owner.hero_contract.ultimates_enabled_from_first_playable_level,true);
  const builder=read('scripts/build-empire-godot-pack.mjs');
  assert.match(builder,/owner-13-hero-design-v1\.json/);
  assert.match(builder,/hero-originals\/heroes/);
  assert.match(builder,/OWNER_IDS\.slice\(0,6\)/);
  for(const name of ids.slice(0,6)){
    assert.match(read('godot/hero-originals/heroes/'+name+'.gd'),/const DATA :=/);
  }
});

test('seven Godot native special skills have separate bounded action identities',()=>{
  const owner=JSON.parse(read('godot/empire-arena/data/owner-13-hero-design-v1.json'));
  const specials=owner.heroes.slice(6);
  const catalog=read('godot/empire-arena/scripts/hero_identity.gd');
  const actions=read('godot/empire-arena/scripts/special_hero_actions.gd');
  const names=new Set();
  for(const hero of specials){
    assert.match(catalog,new RegExp('"'+hero.id+'": \\['));
    for(const prop of ['s1','s2','ultimate']){
      const id=hero[prop].split(':')[0].trim().toLowerCase().replace(/\s+/g,'_');
      assert.match(catalog,new RegExp('"'+id+'"'));
      assert.match(actions,new RegExp('"'+id+'"'));
      assert.equal(names.has(id),false,'Each hero skill must have distinct identity: '+id);
      names.add(id);
    }
  }
  assert.equal(names.size,21);
  assert.match(actions,/MAX_SHIELD_RATIO := 0\.30/);
  assert.match(actions,/MAX_DEPLOYED := 80/);
  assert.doesNotMatch(actions,/supabase|axios|fetch\(|http|awardBP|character_diamonds/i);
});

test('native Godot simulation executes owner-designed skills from source, protects LOS and first-level ultimate',()=>{
  const sim=read('godot/empire-arena/scripts/arena_simulation.gd');
  assert.match(sim,/HERO_IDENTITY_SCRIPT\.new\(\)/);
  assert.match(sim,/hero_catalog\.skill\(str\(p\["hero"\]\), slot\)/);
  assert.match(sim,/SPECIAL_HERO_ACTIONS\.cast\(self, p, identity, direction\)/);
  assert.match(sim,/func _line_blocked\(/);
  assert.match(sim,/or _line_blocked\(p\["pos"\], target\["pos"\]\)/);
  assert.doesNotMatch(sim,/slot == "ultimate" and int\(p\["level"\]\) < 6/);
  const smoke=read('godot/empire-arena/tests/hero_native_smoke.gd');
  assert.match(smoke,/BUKLOD_NATIVE_13_HERO_PASS/);
  assert.match(smoke,/no mark through solid cover/);
  assert.match(smoke,/Equal Measure must redistribute not mint shields/);
  const release=JSON.parse(read('.buklod/releases/genesis-unified-signed-rc-hold-20261122.json'));
  assert.equal(release.signedReleaseReady,false,'Source tests never bypass physical device or gameplay-parity gates');
});
