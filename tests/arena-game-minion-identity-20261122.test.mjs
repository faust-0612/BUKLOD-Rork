import test from 'node:test';
import assert from 'node:assert/strict';
import {MINION_CLASSES,enableMinionWaves,tickMinionWaves} from '../experiments/empire-arena-v2/arena-v2-minions.mjs';
const setup=()=>({status:'active',elapsed:0,w:160,h:110,nextId:1,events:[],map:{lanes:[.2,.5,.8]},minions:[],units:[],players:{},cover:[],towers:[],seals:{A:{hp:900,breached:false},B:{hp:900,breached:false}},huntStarted:null});
test('four independent Arena minion identities have distinct authentic combat abilities',()=>{
 assert.deepEqual(Object.keys(MINION_CLASSES),['vanguard','ranger','mender','siege_breaker']);
 assert.ok(MINION_CLASSES.vanguard.armor>0);
 assert.ok(MINION_CLASSES.ranger.range>MINION_CLASSES.vanguard.range);
 assert.ok(MINION_CLASSES.mender.heal>0);
 assert.ok(MINION_CLASSES.siege_breaker.structureDamage>MINION_CLASSES.siege_breaker.damage);
});
test('mirrored teams own temporary minions, never character progression or persistent grants',()=>{
 const s=setup();enableMinionWaves(s,{firstWaveMs:0});tickMinionWaves(s);
 assert.equal(s.minions.length,18);
 for(const team of ['A','B']){
   assert.equal(s.minions.filter(m=>m.team===team).length,9);
   assert.ok(s.minions.filter(m=>m.team===team).every(m=>m.id.startsWith('minion-')&&m.hero==null&&m.pose==='walk'));
 }
 assert.equal('diamonds' in s,false);
 assert.equal('ranked' in s,false);
});
