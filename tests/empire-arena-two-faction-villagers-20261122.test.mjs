import test from 'node:test';
import assert from 'node:assert/strict';
import {createPractice,command,tick} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {VILLAGER_FACTIONS,VILLAGER_ROLES,VILLAGER_LIMIT,makeVillager,nextVillagerSlot,
 issueVillagerOrder,stepVillager} from '../experiments/empire-arena-v2/arena-v2-villagers.mjs';
const practice=()=>{const s=createPractice({mode:'cluster',seed:919});for(const p of Object.values(s.players))p.bot=false;return s;};
const count=(s,t)=>s.units.filter(u=>u.kind==='villager'&&u.team===t&&u.alive).length;
const add=(s,t,slot)=>{const u=makeVillager(s,t,slot,'test-'+t+'-'+slot);s.units.push(u);return u;};
test('two six-role identities are complete, unique and mechanically mirrored',()=>{
 assert.equal(VILLAGER_ROLES.length,6);assert.equal(VILLAGER_LIMIT,6);
 assert.equal(new Set(VILLAGER_FACTIONS.A.members).size,6);
 assert.equal(new Set(VILLAGER_FACTIONS.B.members).size,6);
 const s=practice();
 assert.deepEqual(s.units.filter(u=>u.team==='A').map(u=>u.villagerName),['Aron','Lira']);
 assert.deepEqual(s.units.filter(u=>u.team==='B').map(u=>u.villagerName),['Rogar','Velin']);
 for(let i=0;i<6;i++){const a=makeVillager(s,'A',i,'a'+i),b=makeVillager(s,'B',i,'b'+i);
  assert.equal(a.villagerRole,b.villagerRole);assert.equal(a.hp,b.hp);assert.equal(a.maxHp,b.maxHp);
  assert.equal(a.command,b.command);}
});
test('recruiting respects paid queue, six active/queued cap and recyclable defeated slot',()=>{
 const s=practice();s.teams.A.resources={wood:2000,gold:2000,stone:2000};
 assert.equal(command(s,'A0',{type:'train',kind:'villager'}),true);
 assert.equal(command(s,'A0',{type:'train',kind:'villager'}),false,'same tick double order blocked');
 tick(s);assert.equal(command(s,'A0',{type:'train',kind:'villager'}),true);
 tick(s);assert.equal(command(s,'A0',{type:'train',kind:'villager'}),true);
 assert.deepEqual(s.teams.A.queue.map(q=>q.villagerSlot),[2,3,4]);
 assert.equal(nextVillagerSlot(s,'A'),5);
 for(let i=0;i<70;i++)tick(s);
 assert.equal(count(s,'A'),5);
 assert.equal(command(s,'A0',{type:'train',kind:'villager'}),true);
 for(let i=0;i<70;i++)tick(s);
 assert.equal(count(s,'A'),6);
 assert.equal(nextVillagerSlot(s,'A'),null);
 assert.equal(command(s,'A0',{type:'train',kind:'villager'}),false);
 s.units.find(u=>u.team==='A'&&u.villagerSlot===3).alive=false;
 assert.equal(nextVillagerSlot(s,'A'),3);
});
test('workers move real material out of nodes and deposit only carried amounts',()=>{
 const s=practice(),u=s.units.find(x=>x.id==='vA1'),n=s.nodes.find(x=>x.id==='mine1');
 s.cover=[];u.x=n.x;u.y=n.y;u.targetNode=n.id;
 const start=n.stock,initial=s.teams.A.resources.gold;
 for(let i=0;i<8;i++)stepVillager(s,u,(state,type,extra)=>state.events.push({type,...extra}));
 assert.ok(n.stock<start);const mined=start-n.stock;
 assert.ok(u.carry.gold>0&&u.carry.gold<=50);
 for(const node of s.nodes.filter(n=>n.side==='A'))node.stock=0;
 u.x=20;u.y=s.h/2;
 stepVillager(s,u,()=>{});
 assert.equal(s.teams.A.resources.gold-initial,mined);
 assert.equal(u.carry.gold,0);
});
test('research consumes finite wood/gold/stone, is capped at tech 3 and cannot fabricate stock',()=>{
 const s=practice(),r=add(s,'A',4),team=s.teams.A;
 r.x=20;r.y=s.h/2;s.cover=[];
 const before={...team.resources};
 stepVillager(s,r,()=>{});
 assert.equal(team.tech,1);
 assert.deepEqual(team.resources,{wood:before.wood-8,gold:before.gold-8,stone:before.stone-3});
 stepVillager(s,r,()=>{});assert.equal(team.tech,1);
 for(let level=2;level<=3;level++){s.elapsed+=15000;stepVillager(s,r,()=>{});assert.equal(team.tech,level);}
 s.elapsed+=900000;stepVillager(s,r,()=>{});assert.equal(team.tech,3);
});
test('healer spends actual gold, heals injured allies only and never revives fallen units',()=>{
 const s=practice(),u=add(s,'A',3),p=s.players.A0,u2=s.units.find(x=>x.id==='vB0');
 u.x=p.x;u.y=p.y;p.hp-=35;u2.hp-=40;const before=s.teams.A.resources.gold;
 stepVillager(s,u,()=>{});
 assert.ok(p.hp>p.maxHp-35);assert.equal(s.teams.A.resources.gold,before-2);
 assert.equal(u2.hp,u2.maxHp-40);
 p.alive=false;p.hp=0;const gold=s.teams.A.resources.gold;
 stepVillager(s,u,()=>{});assert.equal(p.hp,0);assert.equal(s.teams.A.resources.gold,gold);
});
test('guardian does not attack allies or pursue foes outside the homeland',()=>{
 const s=practice(),u=add(s,'A',2),friend=s.players.A0,foe=s.players.B0;
 u.x=23;u.y=s.h/2;friend.x=24;friend.y=s.h/2;foe.x=26;foe.y=s.h/2;
 const own=friend.hp,enemy=foe.hp;
 stepVillager(s,u,()=>{});assert.equal(friend.hp,own);assert.ok(foe.hp<enemy);
 s.elapsed+=2000;foe.x=s.w-5;foe.y=s.h/2;
 const far=foe.hp;stepVillager(s,u,()=>{});assert.equal(foe.hp,far);
});
test('orders enforce team boundaries and living worker ownership',()=>{
 const s=practice();
 assert.equal(command(s,'A0',{type:'order',order:'repair',unitId:'vB0'}),false);
 assert.equal(command(s,'A0',{type:'order',order:'research',unitId:'vA0'}),true);
 assert.equal(s.units.find(u=>u.id==='vB0').command,'mine');
 assert.equal(command(s,'A0',{type:'order',order:'invalid',unitId:'vA0'}),false);
 assert.equal(issueVillagerOrder(s,'A','retreat','vA1'),true);
 assert.equal(s.units.find(u=>u.id==='vA1').command,'retreat');
});
test('simulated villagers remain deterministic and cannot settle account economy',()=>{
 const a=practice(),b=practice();
 for(let i=0;i<100;i++){tick(a);tick(b);}
 assert.deepEqual(a.teams,b.teams);
 assert.deepEqual(a.units,b.units);
 assert.equal(a.ranked,false);assert.equal(a.kind,'OFFLINE_PRACTICE');
 assert.equal(a.wallet,undefined);assert.equal(a.diamonds,undefined);
});

test('named villagers physically move, turn and expose grounded animation timestamps',()=>{
 const s=practice();s.cover=[];s.elapsed=300;
 const u=s.units.find(x=>x.id==='vA1');
 const node=s.nodes.find(x=>x.id==='mine1');
 u.command='mine';u.targetNode=node.id;
 u.x=node.x-9;u.y=node.y;u.carry={wood:0,gold:0,stone:0};
 const x=u.x;
 stepVillager(s,u,()=>{});
 assert.ok(u.x>x,'gatherer must advance toward mine');
 assert.equal(u.facing,1);
 assert.equal(u.lastMovedAt,300);
 u.x=node.x+9;u.y=node.y;
 s.elapsed+=100;
 const x2=u.x;
 stepVillager(s,u,()=>{});
 assert.ok(u.x<x2,'worker must actually change map coordinates when facing left');
 assert.equal(u.facing,-1);
 assert.equal(u.lastMovedAt,400);
});
