import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPractice} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {stepVillager} from '../experiments/empire-arena-v2/arena-v2-villagers.mjs';

test('game: named villagers traverse battlefield and expose trusted animation state',()=>{
 const s=createPractice({mode:'cluster',seed:101});s.cover=[];s.elapsed=700;
 const actor=s.units.find(x=>x.id==='vA1');
 const mine=s.nodes.find(x=>x.id==='mine1');
 assert.ok(actor && mine,'canonical villager and node must exist');
 actor.x=mine.x-9;actor.y=mine.y;actor.targetNode=mine.id;actor.command='mine';
 const oldX=actor.x;
 stepVillager(s,actor,()=>{});
 assert.ok(actor.x>oldX,'villager must move in world coordinates');
 assert.equal(actor.lastMovedAt,s.elapsed);
 assert.equal(actor.facing,1);
 actor.x=mine.x+9;actor.y=mine.y;s.elapsed+=100;
 stepVillager(s,actor,()=>{});
 assert.equal(actor.facing,-1,'visual facing follows actual movement');
});

test('game: practice Arena renders individual faction villagers from simulation state',()=>{
 const view=readFileSync(new URL('../src/app/games/empire-arena.tsx',import.meta.url),'utf8');
 const rig=readFileSync(new URL('../src/features/games/empire/ArenaVillagerSprite.tsx',import.meta.url),'utf8');
 assert.match(view,/import \{ ArenaVillagerSprite \}/);
 assert.match(view,/return <ArenaVillagerSprite actor=\{actor\} elapsed=\{elapsed\}/);
 assert.match(view,/state\.units\.map\(u => <ActorMark/);
 assert.match(view,/elapsed=\{state\.elapsed\}/);
 assert.match(rig,/actor\.lastMovedAt/);
 assert.match(rig,/actor\.facing/);
 assert.match(rig,/actor\.villagerName/);
 assert.match(rig,/actor\.team === 'B'/);
 assert.match(rig,/actor\.villagerSlot/);
 assert.doesNotMatch(rig,/fetch\(|supabase|\.from\(/i);
});
