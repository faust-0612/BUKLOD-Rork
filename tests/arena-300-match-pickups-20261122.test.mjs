import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ARENA_PICKUP_CATALOG,ARENA_PICKUP_BY_ID,PICKUP_EFFECTS,PICKUP_LIMIT,
 arenaPickupEligible,rollArenaPickupDefinition,applyArenaPickupEffect
} from '../experiments/empire-arena-v2/arena-v2-pickups.mjs';
import {HEROES,createPractice,command,rollArenaFieldPickup,tick} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';

const heroes=Object.keys(HEROES);
const battle=(hero='phan')=>{
 const s=createPractice({mode:'duel',hero,seed:98765});
 s.cover=[];return {s,p:s.players.A0,enemy:s.players.B0};
};
const drop=(s,p,itemId,ownerHero=null,expires=s.elapsed+10000)=>({
 id:'unit-test-'+s.loot.length+'-'+itemId,kind:'field_pickup',
 itemId,ownerHero,x:p.x,y:p.y,expires,
 effect:ARENA_PICKUP_BY_ID[itemId]?.effect??'health',
 rarity:ARENA_PICKUP_BY_ID[itemId]?.rarity??'field'
});
test('exactly 300 immutable named match-only drops across all 13 canonical heroes',()=>{
 assert.equal(ARENA_PICKUP_CATALOG.length,300);
 assert.equal(Object.keys(PICKUP_EFFECTS).length,12);
 assert.equal(ARENA_PICKUP_CATALOG.filter(i=>i.category==='universal').length,144);
 assert.equal(ARENA_PICKUP_CATALOG.filter(i=>i.category==='exclusive').length,156);
 assert.deepEqual(new Set(ARENA_PICKUP_CATALOG.map(i=>i.id)).size,300);
 assert.equal(new Set(ARENA_PICKUP_CATALOG.map(i=>i.name)).size,300);
 assert.equal(ARENA_PICKUP_BY_ID.toString,undefined,'cannot lookup inherited keys');
 assert.equal(heroes.length,13);
 for(const hero of heroes){
  assert.equal(ARENA_PICKUP_CATALOG.filter(i=>i.hero===hero).length,12,hero);
 }
 for(const item of ARENA_PICKUP_CATALOG){
  assert.ok(Object.isFrozen(item));
  assert.equal(ARENA_PICKUP_BY_ID[item.id],item);
  assert.ok(PICKUP_EFFECTS[item.effect]);
  assert.ok(item.value>0);
  assert.ok(['field','charged','radiant'].includes(item.rarity));
  assert.equal(item.temporary,true);
  assert.equal(item.transferable,false);
  assert.ok(!Object.hasOwn(item,'bp')&&!Object.hasOwn(item,'diamonds'));
 }
});
test('seeded draws are deterministic and never exceed match-level rarity gate',()=>{
 const sample=(level,hero)=>{
  let seed=50231;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  return Array.from({length:150},()=>rollArenaPickupDefinition({hero,matchLevel:level,source:'boss',random}).id);
 };
 assert.deepEqual(sample(11,'angel'),sample(11,'angel'));
 for(const level of [1,4,9,15]){
  const ids=sample(level,'mitch');
  for(const id of ids)assert.ok(ARENA_PICKUP_BY_ID[id].minMatchLevel<=level);
  assert.ok(ids.some(id=>id.startsWith('u-')),'universal drops available');
  assert.ok(ids.some(id=>id.startsWith('h-mitch')),'hero drops available');
 }
});
test('pickup is collected through real proximity-checked engine command exactly once',()=>{
 const {s,p}=battle();p.hp=28;
 const ground=drop(s,p,'u-health-1-t1');s.loot.push(ground);
 assert.equal(arenaPickupEligible(p,ground),true);
 assert.equal(command(s,p.id,{type:'loot',id:ground.id}),true);
 assert.ok(p.hp>28);
 assert.equal(s.loot.some(x=>x.id===ground.id),false);
 assert.equal(command(s,p.id,{type:'loot',id:ground.id}),false);
 assert.equal(s.events.filter(x=>x.type==='field_pickup_claimed').length,1);
 assert.equal(s.events.filter(x=>x.type==='loot'&&x.lootId===ground.id).length,1);
 assert.equal(s.kind,'OFFLINE_PRACTICE');assert.equal(s.ranked,false);
});
test('exclusive pickup cannot be stolen by another hero or forged by changing ownerHero',()=>{
 const {s,p,enemy}=battle('phan');
 enemy.x=p.x;enemy.y=p.y;
 assert.notEqual(enemy.hero,p.hero);
 const exclusive=drop(s,p,'h-phan-1-t1','phan');s.loot.push(exclusive);
 assert.equal(arenaPickupEligible(enemy,exclusive),false);
 assert.equal(command(s,enemy.id,{type:'loot',id:exclusive.id}),false);
 assert.equal(s.loot.includes(exclusive),true);
 assert.equal(command(s,p.id,{type:'loot',id:exclusive.id}),true);
 const forged=drop(s,p,'u-health-1-t1','phan');s.loot.push(forged);
 assert.equal(command(s,p.id,{type:'loot',id:forged.id}),false);
 assert.equal(s.loot.includes(forged),true);
 const fake=drop(s,p,'toString',null);s.loot.push(fake);
 assert.equal(command(s,p.id,{type:'loot',id:fake.id}),false);
});
test('health/mana/shield refuse waste, and timed buffs affect real movement then expire',()=>{
 const {s,p}=battle('quin');
 p.hp=p.maxHp;p.mana=p.maxMana;
 const health=drop(s,p,'u-health-1-t1');s.loot.push(health);
 assert.equal(command(s,p.id,{type:'loot',id:health.id}),false);
 assert.ok(s.loot.includes(health));
 const mana=drop(s,p,'u-mana-1-t1');s.loot.push(mana);
 assert.equal(command(s,p.id,{type:'loot',id:mana.id}),false);
 p.hp=p.maxHp-20;p.mana=p.maxMana-20;
 assert.equal(command(s,p.id,{type:'loot',id:health.id}),true);
 assert.equal(command(s,p.id,{type:'loot',id:mana.id}),true);
 const buff=drop(s,p,'u-haste-1-t1');s.loot.push(buff);
 assert.equal(command(s,p.id,{type:'loot',id:buff.id}),true);
 const boostedStart=p.x;
 assert.equal(command(s,p.id,{type:'move',dx:1,dy:0}),true);
 const boostedTravel=p.x-boostedStart;
 const baseline=battle('quin');baseline.p.x=boostedStart;
 assert.equal(command(baseline.s,baseline.p.id,{type:'move',dx:1,dy:0}),true);
 assert.ok(boostedTravel>baseline.p.x-boostedStart);
 s.elapsed=p.effects.fieldHaste+1;
 tick(s);
 assert.ok(p.effects.fieldHaste<=s.elapsed);
});
test('match-only resources affect one team only, not persistent user economy',()=>{
 const {s,p}=battle('vhen');
 const beforeA=s.teams.A.resources.wood,beforeB=s.teams.B.resources.wood;
 const timber=drop(s,p,'h-vhen-1-t1','vhen');s.loot.push(timber);
 assert.equal(command(s,p.id,{type:'loot',id:timber.id}),true);
 assert.ok(s.teams.A.resources.wood>beforeA);
 assert.equal(s.teams.B.resources.wood,beforeB);
 assert.equal('diamonds' in p,false);
 assert.equal('bp' in s.teams.A,false);
});
test('full pickup population is capped and time-limited',()=>{
 const {s,p}=battle();
 for(let i=0;i<200;i++)rollArenaFieldPickup(s,p,{x:p.x,y:p.y},'boss');
 assert.ok(s.loot.filter(x=>x.kind==='field_pickup').length<=PICKUP_LIMIT);
 assert.ok(s.loot.filter(x=>x.kind==='field_pickup').length>0);
 const oldest=s.loot.find(x=>x.kind==='field_pickup');
 s.elapsed=oldest.expires+1;
 assert.equal(command(s,p.id,{type:'loot',id:oldest.id}),false);
 tick(s);
 assert.ok(!s.loot.includes(oldest));
});
test('no invalid player, inactive game or fabricated definition can apply effects',()=>{
 const {s,p}=battle();const real=ARENA_PICKUP_BY_ID['u-shield-1-t1'];
 assert.equal(applyArenaPickupEffect(s,{...p,alive:false},real),null);
 assert.equal(applyArenaPickupEffect({...s,status:'finished'},p,real),null);
 assert.equal(applyArenaPickupEffect(s,p,{...real,value:100000}),null);
 const falseHero=ARENA_PICKUP_BY_ID['h-angel-1-t1'];
 assert.equal(applyArenaPickupEffect(s,p,falseHero),null);
});

test('expired rare temporary buff cannot leak its power into a fresh weaker pickup',()=>{
 const {s,p}=battle('jawo');
 const rare=ARENA_PICKUP_BY_ID['u-haste-1-t3'],weak=ARENA_PICKUP_BY_ID['u-haste-1-t1'];
 assert.ok(applyArenaPickupEffect(s,p,rare));
 assert.ok(p.effects.fieldHasteStrength>weak.value);
 s.elapsed=p.effects.fieldHaste+1;
 assert.ok(applyArenaPickupEffect(s,p,weak));
 assert.equal(p.effects.fieldHasteStrength,weak.value);
});
test('respawn clears all four match-only temporary boost strengths',()=>{
 const {s,p}=battle('ace');
 for(const type of ['Haste','Fury','Guard','Regen']){
  p.effects['field'+type]=s.elapsed+50000;p.effects['field'+type+'Strength']=.2;
 }
 p.alive=false;p.hp=0;p.respawnAt=s.elapsed;
 for(let i=0;i<5;i++)tick(s);
 assert.equal(p.alive,true);
 for(const type of ['Haste','Fury','Guard','Regen']){
  assert.equal(p.effects['field'+type],0);
  assert.equal(p.effects['field'+type+'Strength'],0);
 }
});
