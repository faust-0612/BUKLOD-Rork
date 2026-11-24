import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_PICKUP_CATALOG} from '../experiments/empire-arena-v2/arena-v2-pickups.mjs';
import {EQUIPMENT_SLOTS,CONSUMABLE_TYPES,itemDefinition,consumableDefinition} from '../experiments/empire-arena-v2/arena-v2-armory.mjs';
const src=name=>readFileSync(new URL('../apps/buklod-empire-unity/Assets/Scripts/'+name,import.meta.url),'utf8');
test('all 300 Unity field pickup definitions preserve canonical identity and values',()=>{
 const rows=[...src('ArenaPickupCatalog.cs').matchAll(/new ArenaPickupDefinition\((.*?)\),/g)].map(m=>JSON.parse('['+m[1].replace(/(\d+(?:\.\d+)?)f(?=,|$)/g,'$1')+']'));
 assert.equal(rows.length,300);assert.deepEqual(rows,ARENA_PICKUP_CATALOG.map(x=>[x.id,x.name,x.effect,x.hero,x.tier,x.minMatchLevel,x.value,x.durationMs/1000]));
});
test('all 91 base relic/consumable names match original armory and generate 364 tier identities',()=>{
 const rows=[...src('ArenaRelicCatalog.cs').matchAll(/\{"([^"]+)",new\[\]\{([^}]+)\}\}/g)].map(m=>[m[1],JSON.parse('['+m[2]+']')]);
 const heroes=rows.slice(0,13).map(x=>x[0]);assert.equal(new Set(heroes).size,13);
 assert.deepEqual(rows,[...heroes.map(h=>[h,EQUIPMENT_SLOTS.map(s=>itemDefinition(h,s,1).name)]),...heroes.map(h=>[h,CONSUMABLE_TYPES.map(s=>consumableDefinition(h,s,1).name)])]);
 const ids=heroes.flatMap(h=>[...EQUIPMENT_SLOTS.flatMap(s=>[1,2,3,4].map(t=>itemDefinition(h,s,t).id)),...CONSUMABLE_TYPES.flatMap(s=>[1,2,3,4].map(t=>consumableDefinition(h,s,t).id))]);
 assert.equal(new Set(ids).size,364);
});
