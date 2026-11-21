import test from 'node:test';
import assert from 'node:assert/strict';
import {createPractice,tick,VILLAGER_ROLES,VILLAGER_FACTIONS} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';

test('both named Arena villager factions retain initial autonomous wood supply and symmetrical roles',()=>{
 const s=createPractice({mode:'cluster',seed:808});
 for(const p of Object.values(s.players))p.bot=false;
 assert.equal(VILLAGER_ROLES.length,6);
 assert.equal(VILLAGER_FACTIONS.A.members.length,6);
 assert.equal(VILLAGER_FACTIONS.B.members.length,6);
 const first=s.units.find(u=>u.id==='vA0');
 assert.equal(first.villagerName,'Aron');
 assert.equal(first.villagerRole,'builder');
 assert.equal(first.command,'mine');
 const initialStock=s.teams.A.resources.wood;
 for(let i=0;i<500;i++)tick(s);
 assert.ok(s.teams.A.resources.wood>initialStock,'builder preserves existing autonomous wood-gathering when idle');
 assert.equal(s.kind,'OFFLINE_PRACTICE');
 assert.equal(s.ranked,false);
});
