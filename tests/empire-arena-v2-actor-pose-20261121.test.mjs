import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {arenaActorPose} from '../src/features/games/empire/arenaActorPose.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const route=readFileSync(resolve(root,'src/app/games/empire-arena.tsx'),'utf8');

test('Server-authored 1v1 ranked skill and attack events animate only their real actor',()=>{
  const a={id:'A0',lastMoveTick:40,lastAttacked:0}, b={id:'B0',lastMoveTick:40,lastAttacked:0};
  const state={tick:50,elapsed:10000,events:[
    {seq:3,time:9300,type:'skill',actor:'B0'},
    {seq:4,time:9710,type:'attack',actor:'A0'}]};
  assert.equal(arenaActorPose(state,a),'attack');
  assert.equal(arenaActorPose(state,b),'skill');
  const onlyEnemy={...state,events:[{seq:5,time:9900,type:'skill',actor:'B0'}]};
  assert.equal(arenaActorPose(onlyEnemy,a),'idle');
  assert.equal(arenaActorPose(onlyEnemy,b),'skill');
});

test('Valid server timestamps and movement choose the correct animation without phantom attack',()=>{
  const actor={id:'B0',lastMoveTick:65,lastAttacked:0};
  assert.equal(arenaActorPose({elapsed:5000,tick:65,events:[]},actor),'walk');
  assert.equal(arenaActorPose({elapsed:5000,tick:68,events:[]},actor),'idle');
  assert.equal(arenaActorPose({elapsed:5000,tick:68,events:[]},{...actor,lastAttacked:4650}),'attack');
  assert.equal(arenaActorPose({elapsed:5000,tick:68,events:[]},{...actor,lastAttacked:100}),'idle');
  assert.equal(arenaActorPose({elapsed:5000,tick:68,events:[{actor:'B0',time:100,type:'skill'}]},actor),'idle');
});

test('Local practice cue never overrides another ranked player animation',()=>{
  const scene={elapsed:7000,tick:55,events:[]};
  assert.equal(arenaActorPose(scene,{id:'A0'}, {type:'skill',actor:'B0',time:6700}),'idle');
  assert.equal(arenaActorPose(scene,{id:'A0'}, {type:'skill',actor:'A0',time:6700}),'skill');
  assert.equal(arenaActorPose(scene,{id:'B0'}, {type:'seal_attack',actor:'B0',time:6699}),'attack');
  assert.equal(arenaActorPose(scene,{id:'B0'}, {type:'seal_attack',actor:'B0',time:3000}),'idle');
});

test('Native in-app renderer reads the verified server snapshot pose, no client combat authority',()=>{
  assert.match(route,/arenaActorPose\(state, p, state\.visualCue\)/);
  assert.match(route,/fullbody:' \+ p\.hero \+ '_' \+ pose/);
  assert.match(route,/ArenaRankedSocket/);
  assert.doesNotMatch(route,/supabase\.rpc\(|awardDiamond|awardBp/);
});
