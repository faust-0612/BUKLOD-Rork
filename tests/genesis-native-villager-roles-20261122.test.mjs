import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Godot villagers preserve exact owner faction identities and jobs inside native simulation',()=>{
 const g=read('godot/empire-arena/scripts/native_villager_roles.gd');
 for(const role of ['builder','gatherer','guardian','healer','researcher','supplier'])
  assert.match(g,new RegExp('"'+role+'"'));
 for(const name of ['Aron','Lira','Daren','Serah','Kiel','Miko','Rogar','Velin','Kael','Mora','Zed','Taro'])
  assert.match(g,new RegExp('"'+name+'"'));
 for(const job of ['mine','repair','defend','support','research','retreat','escort','patrol'])
  assert.match(g,new RegExp('"'+job+'"'));
 assert.match(g,/const LIMIT := 6/);
 assert.match(g,/sim\._spend/);
 assert.match(g,/villager_deposit/);
 assert.match(g,/villager_heal/);
 assert.match(g,/villager_research/);
 assert.doesNotMatch(g.split('\n').filter(x=>!x.trimStart().startsWith('#')).join('\n'),
  /supabase|wallet|awardBP|characterDiamonds|https?:\/\//i);
});
test('real Godot engine uses separate worker roles, capped training and native UI commands',()=>{
 const sim=read('godot/empire-arena/scripts/arena_simulation.gd');
 const hud=read('godot/empire-arena/scripts/arena_hud.gd');
 const root=read('godot/empire-arena/scripts/arena_root.gd');
 assert.match(sim,/NATIVE_VILLAGER_ROLES\.configure\(resident, team, i\)/);
 assert.match(sim,/NATIVE_VILLAGER_ROLES\.configure\(recruited, team/);
 assert.match(sim,/NATIVE_VILLAGER_ROLES\.next_slot/);
 assert.match(sim,/NATIVE_VILLAGER_ROLES\.step\(self, unit\)/);
 assert.match(sim,/NATIVE_VILLAGER_ROLES\.order\(self/);
 assert.match(sim,/state\["next_id"\] = int\(state\["next_id"\]\) \+ 1/);
 assert.match(hud,/WORKER_JOBS/);
 assert.match(hud,/worker_job/);
 assert.match(root,/villager_name/);
 assert.match(root,/villager_role/);
 const smoke=read('godot/empire-arena/tests/native_villager_smoke.gd');
 assert.match(smoke,/BUKLOD_NATIVE_VILLAGER_PASS/);
 assert.match(smoke,/cannot control enemy villager/);
 assert.match(smoke,/depot can credit only physically carried match resources/);
});
