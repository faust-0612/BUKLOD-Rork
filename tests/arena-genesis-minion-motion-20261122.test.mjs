import test from 'node:test';
import assert from 'node:assert/strict';
import {minionMotion} from '../src/features/games/empire/arenaMinionMotion.mjs';
const actor=()=>({id:'minion-1',kind:'ranger',team:'A',x:26,y:21,prevX:23,prevY:20,pose:'walk',poseAt:1000,lastMoveAt:1000,strideOffset:3,facing:1,hp:70,maxHp:70,alive:true});
test('500ms motion interpolates, not teleporting between authoritative positions',()=>{const m=actor();assert.equal(minionMotion(m,1000).x,23);assert.equal(minionMotion(m,1250).x,24.5);assert.equal(minionMotion(m,1500).x,26);assert.equal(minionMotion(m,1250).pose,'walk')});
test('motion remains presentation-only and never mutates state',()=>{const m=actor(),snapshot=JSON.stringify(m);for(let t=1000;t<1800;t+=16)minionMotion(m,t,2);assert.equal(JSON.stringify(m),snapshot)});
test('attack, damage and healing frames require simulation-supplied pose',()=>{const m=actor();m.pose='attack';assert.equal(minionMotion(m,1090).attack,true);m.pose='heal';assert.equal(minionMotion(m,1090).heal,true);m.pose='hit';assert.equal(minionMotion(m,1090).hit,true)});
test('defeat animation rotates and fades without reviving client-side',()=>{const m=actor();m.alive=false;m.deathAt=1000;assert.equal(minionMotion(m,1300).pose,'death');assert.ok(minionMotion(m,1400).lean>0);assert.equal(minionMotion(m,1950).fade,0)});
test('engine facing and stationary breathing stay finite',()=>{const m=actor();m.facing=-1;m.pose='idle';const v=minionMotion(m,1500);assert.equal(v.facing,-1);assert.equal(v.pose,'idle');assert.equal(v.x,m.x);assert.ok(Number.isFinite(v.y))});
