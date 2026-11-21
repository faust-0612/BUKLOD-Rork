import test from 'node:test';
import assert from 'node:assert/strict';
import {createPractice,tick} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {enableMinionWaves,tickMinionWaves,MINION_WAVE_INTERVAL_MS} from '../experiments/empire-arena-v2/arena-v2-minions.mjs';
import {createOfflineSoloBattle,tickOfflineSolo} from '../experiments/empire-arena-v2/arena-v2-solo.mjs';

const make=()=>({status:'active',elapsed:0,w:160,h:110,nextId:1,
 map:{lanes:[.2,.5,.8]},minions:[],units:[],players:{},cover:[],events:[],
 towers:['A','B'].flatMap(team=>[0,1,2].map(lane=>({
  id:team+lane,team,lane,x:team==='A'?30:130,y:110*[.2,.5,.8][lane],
  hp:100,maxHp:100,alive:true}))),
 seals:{A:{hp:900,breached:false},B:{hp:900,breached:false}},
 huntStarted:null,phase:'expansion'});
const event=(s,type,extra)=>s.events.push({type,...extra});

test('default Arena remains legacy-trained only; team practice explicitly enables waves',()=>{
 const baseline=createPractice({mode:'cluster',mapId:'verdant_fracture'});
 assert.equal(baseline.minionWaves,undefined);
 assert.deepEqual(baseline.minions,[]);
 const enabled=createPractice({mode:'cluster',mapId:'verdant_fracture',minionWaves:true});
 assert.ok(enabled.minionWaves.enabled);
 for(let i=0;i<80;i++)tick(enabled);
 assert.ok(enabled.minions.some(m=>m.team==='A'));
 assert.ok(enabled.minions.some(m=>m.team==='B'));
 assert.ok(enabled.events.some(e=>e.type==='minion_wave'));
});
test('1v1 solo CPU remains minion-free and local-only',()=>{
 const solo=createOfflineSoloBattle({hero:'phan',opponent:'ace',mapId:'verdant_fracture'});
 for(let i=0;i<100;i++)tickOfflineSolo(solo);
 assert.equal(solo.minionWaves,undefined);
 assert.equal(solo.minions?.length||0,0);
 assert.equal(solo.ranked,false);
});
test('both teams get same lane formation, siege once every three waves',()=>{
 const s=make();enableMinionWaves(s);
 s.elapsed=8000;tickMinionWaves(s,event);
 assert.equal(s.minions.length,18);
 for(const team of ['A','B'])for(let lane=0;lane<3;lane++)
  assert.deepEqual(s.minions.filter(m=>m.team===team&&m.lane===lane).map(m=>m.kind),
   ['vanguard','ranger','mender']);
 for(let i=1;i<3;i++){s.elapsed=8000+MINION_WAVE_INTERVAL_MS*i;tickMinionWaves(s,event);}
 assert.equal(s.minionWaves.wave,3);
 assert.equal(s.minions.filter(m=>m.kind==='siege_breaker').length,6);
});
test('mender heals only allied damaged minions with health and shield cap',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 const mend=s.minions.find(m=>m.team==='A'&&m.kind==='mender'&&m.lane===0);
 const ally=s.minions.find(m=>m.team==='A'&&m.kind==='vanguard'&&m.lane===0);
 const enemy=s.minions.find(m=>m.team==='B'&&m.kind==='vanguard'&&m.lane===0);
 ally.hp=20;enemy.hp=20;s.elapsed=3000;tickMinionWaves(s,event);
 assert.ok(ally.hp>20&&ally.hp<=ally.maxHp);assert.equal(enemy.hp,20);
 assert.ok(ally.shield<=18);assert.ok(s.events.some(e=>e.type==='minion_heal'));
});
test('lane tower gates enemy seal until physically destroyed',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 const siege={...s.minions[0],id:'siege',kind:'siege_breaker',team:'A',lane:1,x:146,y:55,attackAt:-1e9};
 s.minions=[siege];const original=s.seals.B.hp;s.elapsed=3000;
 tickMinionWaves(s,event);assert.equal(s.seals.B.hp,original);
 s.towers.find(t=>t.team==='B'&&t.lane===1).alive=false;s.elapsed=5000;
 tickMinionWaves(s,event);assert.ok(s.seals.B.hp<original);
});
test('simulation bounds spawn count and never mutates verified currency',()=>{
 const s=make();s.teams={A:{resources:{gold:99}},B:{resources:{gold:1}}};
 const before=JSON.stringify(s.teams);enableMinionWaves(s,{firstWaveMs:0});
 for(let i=0;i<60;i++){s.elapsed=i*3000;tickMinionWaves(s,event);}
 for(const team of ['A','B'])assert.ok(s.minions.filter(m=>m.team===team&&m.alive).length<=42);
 assert.equal(JSON.stringify(s.teams),before);
});
test('minions do not clip map bounds under obstacle pressure',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 s.cover=[[26,22,6]];
 for(let i=0;i<120;i++){s.elapsed+=500;tickMinionWaves(s,event);}
 for(const m of s.minions)assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.x>=2&&m.y>=2&&m.x<=158&&m.y<=108);
});
test('input validation fails closed',()=>{
 assert.throws(()=>enableMinionWaves(make(),{intervalMs:200}),/Invalid/);
 assert.throws(()=>enableMinionWaves(make(),{maxPerTeam:1000}),/Invalid/);
});

test('minion motion supplies facing, stride and prior real movement coordinates',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 const a=s.minions.find(m=>m.team==='A'&&m.kind==='vanguard');const x=a.x;
 s.elapsed+=500;tickMinionWaves(s,event);assert.equal(a.pose,'walk');
 assert.ok(Number.isFinite(a.prevX));assert.ok(a.lastMoveAt>=0);
 assert.ok(Math.abs(a.x-x)<=1.6);assert.equal(a.facing,1);
});
test('healing plays a support pose only after real allied HP recovery',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 const m=s.minions.find(x=>x.team==='A'&&x.kind==='mender');
 const ally=s.minions.find(x=>x.team==='A'&&x.kind==='vanguard'&&x.lane===m.lane);
 ally.hp=12;s.elapsed=3000;tickMinionWaves(s,event);
 assert.equal(m.pose,'heal');assert.equal(m.poseAt,3000);assert.ok(ally.hp>12);
});
test('clash creates event-backed attacks and damage-timed hit animations',()=>{
 const s=make();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s,event);
 const attacker=s.minions.find(x=>x.team==='A'&&x.kind==='vanguard');
 const victim=s.minions.find(x=>x.team==='B'&&x.kind==='vanguard');
 victim.x=attacker.x+2;victim.y=attacker.y;const prior=victim.hp;s.elapsed=1800;tickMinionWaves(s,event);
 assert.ok(victim.hp<prior);assert.ok(['attack','hit'].includes(attacker.pose));
 assert.ok(s.events.some(e=>e.type==='minion_hit'&&e.from===attacker.id));
});
