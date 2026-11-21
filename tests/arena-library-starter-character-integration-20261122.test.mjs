import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,STARTER_HERO_KITS,starterAttack,starterSkillCooldown,createPractice,command,tick,STEP_MS} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {createOfflineSoloBattle,tickOfflineSolo} from '../experiments/empire-arena-v2/arena-v2-solo.mjs';

const six=['phan','quin','van','christian','lhen','ace'];
function duel(hero,opponent='ace'){
  const s=createOfflineSoloBattle({hero,opponent,mapId:'verdant_fracture',seed:20261122});
  const a=s.players.A0,b=s.players.B0;b.x=a.x+2;b.y=a.y;
  return {s,a,b};
}
function cast(s,p,slot,extra={}){p.mana=p.maxMana;return command(s,p.id,{type:'skill',slot,dx:1,dy:0,...extra})}
test('Library kit is a bounded six-character extension; all thirteen BUKLOD heroes remain available',()=>{
  assert.deepEqual(Object.keys(STARTER_HERO_KITS).sort(),[...six].sort());
  assert.equal(Object.keys(HEROES).length,13);
  for(const hero of six){
    const kit=STARTER_HERO_KITS[hero];
    assert.equal(typeof kit.passive,'string');
    for(const slot of ['primary','secondary','ultimate']){
      assert.equal(typeof kit[slot].id,'string');
      assert.equal(starterSkillCooldown(hero,slot),slot==='primary'?8000:slot==='secondary'?12000:90000);
    }
    assert.ok(starterAttack(hero).damage>0);
  }
  assert.equal(starterAttack('trudice'),null);
  assert.equal(starterSkillCooldown('trudice','ultimate'),null);
});
test('all six starter primaries and ultimates accept through authoritative practice command',()=>{
  for(const hero of six){
    const {s,a,b}=duel(hero);
    assert.equal(cast(s,a,'primary',{targetId:b.id}),true,hero+' primary');
    assert.equal(cast(s,a,'ultimate',{targetId:b.id}),true,hero+' ultimate');
    const log=s.events.filter(e=>e.type==='skill');
    assert.equal(log.length,2,hero+' skill receipt count');
    assert.equal(log[0].skillId,STARTER_HERO_KITS[hero].primary.id);
    assert.equal(log[1].skillId,STARTER_HERO_KITS[hero].ultimate.id);
    assert.equal(s.kind,'OFFLINE_SOLO_CPU');
    assert.equal(s.ranked,false);
  }
});
test('secondary skill changes actual game state for five heroes',()=>{
  for(const hero of six.filter(h=>h!=='ace')){
    const {s,a,b}=duel(hero);
    assert.equal(cast(s,a,'secondary',{targetId:b.id}),true,hero+' secondary');
    assert.equal(s.events.filter(e=>e.type==='skill').at(-1).skillId,STARTER_HERO_KITS[hero].secondary.id);
  }
});
test('Ace Knight Step only works with an actual nearby ally and heals that ally',()=>{
  const {s,a}=duel('ace');
  const initial=a.mana;
  assert.equal(cast(s,a,'secondary'),false,'no ally in solo: cannot invent an ally');
  assert.equal(a.mana,initial,'failed skill costs no mana');
  const team=createPractice({mode:'cluster',hero:'ace',allies:['phan','quin']});
  const ace=team.players.A0,ally=team.players.A1;
  ace.matchLevel=6;ally.x=ace.x+4;ally.y=ace.y;ally.hp=40;
  assert.equal(cast(team,ace,'secondary',{targetId:ally.id}),true);
  assert.ok(ally.hp>40);
  assert.ok(ally.effects.kitSpeedUntil>team.elapsed);
});
test('foundation wall has real collision and automatically despawns',()=>{
  const {s,a}=duel('phan');
  assert.equal(cast(s,a,'secondary'),true);
  assert.equal(s.heroWalls.length,1);
  const wall=s.heroWalls[0];
  assert.ok(s.cover.some(c=>c[3]===wall.id));
  s.elapsed+=6000;tick(s);
  assert.equal(s.heroWalls.length,0);
  assert.ok(s.cover.every(c=>!c[3]));
});
test('Quin marks targets and applies damage vulnerability only during timer',()=>{
  const {s,a,b}=duel('quin');
  assert.equal(cast(s,a,'secondary',{targetId:b.id}),true);
  assert.ok(b.effects.kitMarkedUntil>s.elapsed);
  s.elapsed+=5001;tick(s);
  assert.ok(b.effects.kitMarkedUntil<=s.elapsed);
});
test('Van shields a teammate and Christian rally modifies team attack and defense',()=>{
  const team=createPractice({mode:'cluster',hero:'van',allies:['christian','ace']});
  const van=team.players.A0,chris=team.players.A1,ace=team.players.A2;
  van.matchLevel=6;chris.matchLevel=6;ace.x=van.x+3;ace.y=van.y;chris.x=van.x+2;chris.y=van.y;
  assert.equal(cast(team,van,'primary',{targetId:ace.id}),true);
  assert.ok(ace.shield>0);
  assert.equal(cast(team,chris,'secondary'),true);
  assert.ok(ace.effects.kitAttackUntil>team.elapsed);
  assert.ok(ace.effects.kitDrUntil>team.elapsed);
});
test('Lhen heals and slows through a directional wave',()=>{
  const team=createPractice({mode:'cluster',hero:'lhen',allies:['phan','quin'],foes:['ace','van','christian']});
  const lhen=team.players.A0,ally=team.players.A1,enemy=team.players.B0;
  ally.x=lhen.x+2;ally.y=lhen.y;ally.hp=40;
  enemy.x=lhen.x+4;enemy.y=lhen.y;
  assert.equal(cast(team,lhen,'primary',{dx:1,dy:0,targetId:enemy.id}),true);
  assert.ok(ally.hp>40);
  assert.ok(enemy.hp<enemy.maxHp);
  assert.ok(enemy.effects.kitSlowUntil>team.elapsed);
});
test('Ace ultimate revives one downed teammate during local training, not ranked settlement',()=>{
  const team=createPractice({mode:'cluster',hero:'ace',allies:['phan','quin']});
  const ace=team.players.A0,ally=team.players.A1;ace.matchLevel=6;
  ally.x=ace.x+3;ally.y=ace.y;ally.alive=false;ally.hp=0;
  assert.equal(cast(team,ace,'ultimate'),true);
  tick(team);
  assert.equal(ally.alive,true);
  assert.ok(ally.hp>0);
  assert.equal(team.ranked,false);
  assert.ok(team.events.some(e=>e.type==='kit_revival'));
});
test('skill cooldown and mana only mutate on accepted commands; secondary requires level three',()=>{
  const {s,a,b}=duel('christian');
  assert.equal(cast(s,a,'primary',{targetId:b.id}),true);
  const mana=a.mana,time=a.cooldowns.primary;
  assert.equal(command(s,a.id,{type:'skill',slot:'primary',dx:1,dy:0}),false);
  assert.equal(a.mana,mana);
  assert.equal(a.cooldowns.primary,time);
  a.matchLevel=2;
  assert.equal(cast(s,a,'secondary'),false);
  assert.equal(a.cooldowns.secondary,-1e8);
});
test('all 13 heroes retain offline CPU ticker and local no-network / no-ledger state',()=>{
  for(const hero of Object.keys(HEROES)){
    const s=createOfflineSoloBattle({hero,opponent:'ace',seed:20261122});
    for(let i=0;i<40;i++)tickOfflineSolo(s);
    assert.equal(s.tick,40);
    assert.equal(s.kind,'OFFLINE_SOLO_CPU');
    assert.equal(s.ranked,false);
    assert.ok(s.solo.cpuDecisions>0);
  }
});
