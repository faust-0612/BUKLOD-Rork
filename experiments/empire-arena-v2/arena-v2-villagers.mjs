/**
 * BUKLOD Empire Arena: two original six-person village teams.
 * Deterministic, match-only AI. Never mints BP, Diamonds, XP outside a match,
 * account inventory, or any persistent economy transaction.
 */
export const VILLAGER_LIMIT=6;
export const VILLAGER_ROLES=Object.freeze(['builder','gatherer','guardian','healer','researcher','supplier']);
export const VILLAGER_FACTIONS=Object.freeze({
 A:Object.freeze({id:'lux',name:'Team Lux',title:'The Lightbearers',colors:['#69ddfc','#f4d88e'],
   members:Object.freeze(['Aron','Lira','Daren','Serah','Kiel','Miko'])}),
 B:Object.freeze({id:'tenebra',name:'Team Tenebra',title:'The Shadowborne',colors:['#f98085','#e8ba77'],
   members:Object.freeze(['Rogar','Velin','Kael','Mora','Zed','Taro'])})
});
export const VILLAGER_JOBS=Object.freeze(['mine','repair','defend','support','research','retreat','escort','patrol']);
const RESOURCE_TYPES=['wood','gold','stone'];
const point=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=o=>o&&o.alive!==false&&o.hp>0;
const money=(team,cost)=>{
 if(!team?.resources||RESOURCE_TYPES.some(k=>(team.resources[k]||0)<(cost[k]||0)))return false;
 for(const k of RESOURCE_TYPES)team.resources[k]-=cost[k]||0;
 return true;
};
const home=(s,team)=>({x:team==='A'?20:s.w-20,y:s.h/2});
const march=(s,unit,to,speed)=>{
 if(!to||!Number.isFinite(to.x)||!Number.isFinite(to.y))return;
 const dist=point(unit,to);if(dist<.01)return;
 const step=Math.min(dist,speed);
 const x=Math.max(2,Math.min(s.w-2,unit.x+(to.x-unit.x)/dist*step));
 const y=Math.max(2,Math.min(s.h-2,unit.y+(to.y-unit.y)/dist*step));
 if(!s.cover.some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r+.8)){
  if(Math.hypot(x-unit.x,y-unit.y)>.005){
   unit.facing=x<unit.x?-1:1;
   unit.lastMovedAt=s.elapsed;
  }
  unit.x=x;unit.y=y;
 }
};
const carried=u=>RESOURCE_TYPES.reduce((n,k)=>n+Math.max(0,u.carry?.[k]||0),0);
function findNode(s,u){
 const preferred=s.nodes.find(n=>n.id===u.targetNode&&n.stock>=1);
 if(preferred)return preferred;
 const owned=s.nodes.filter(n=>n.side===u.team&&n.stock>=1);
 const chosen=owned.sort((a,b)=>point(a,u)-point(b,u))[0];
 if(chosen)u.targetNode=chosen.id;
 return chosen||null;
}
export function nextVillagerSlot(s,team){
 if(!VILLAGER_FACTIONS[team])return null;
 const taken=new Set([
  ...s.units.filter(u=>u.team===team&&u.kind==='villager'&&alive(u)).map(u=>u.villagerSlot),
  ...(s.teams[team]?.queue||[]).filter(q=>q.kind==='villager').map(q=>q.villagerSlot)
 ]);
 for(let i=0;i<VILLAGER_LIMIT;i++)if(!taken.has(i))return i;
 return null;
}
export function makeVillager(s,team,slot,id){
 if(!VILLAGER_FACTIONS[team]||!Number.isInteger(slot)||slot<0||slot>=VILLAGER_LIMIT)throw Error('invalid_villager_slot');
 const role=VILLAGER_ROLES[slot];
 const defaultJob={builder:'mine',gatherer:'mine',guardian:'defend',healer:'support',researcher:'research',supplier:'mine'}[role];
 const b=home(s,team);
 return {id,team,kind:'villager',villagerSlot:slot,villagerRole:role,villagerName:VILLAGER_FACTIONS[team].members[slot],
  x:b.x+(team==='A'?1:-1)*(slot%2),y:b.y+(slot-2.5)*2.7,
  hp:role==='guardian'?92:role==='healer'?74:72,maxHp:role==='guardian'?92:role==='healer'?74:72,alive:true,
  carry:{wood:0,gold:0,stone:0},targetNode:'mine'+(team==='A'?(slot%3):(slot%3)+3),
  command:defaultJob,facing:team==='A'?1:-1,lastMovedAt:-1e8,attackAt:-1e8,jobAt:-1e8,respawnAt:0};
}
export function issueVillagerOrder(s,team,order,unitId=null){
 if(!VILLAGER_FACTIONS[team]||!VILLAGER_JOBS.includes(order))return false;
 const workers=s.units.filter(u=>u.team===team&&u.kind==='villager'&&alive(u)&&(unitId===null||unitId===u.id));
 if(!workers.length||unitId!==null&&workers.length!==1)return false;
 for(const worker of workers){worker.command=order;worker.jobAt=-1e8;}
 return true;
}
function collect(s,u,team,log){
 const node=findNode(s,u),cap=u.villagerRole==='supplier'?58:50;
 if(!node||carried(u)>=cap||node.stock<1){
  const depot=home(s,u.team);march(s,u,depot,u.villagerRole==='supplier'?.72:.50);
  if(point(u,depot)<3&&carried(u)>0){
   const transferred={...u.carry};
   for(const k of RESOURCE_TYPES){team.resources[k]+=u.carry[k];u.carry[k]=0;}
   log(s,'villager_deposit',{team:u.team,actor:u.id,role:u.villagerRole,resources:transferred,x:depot.x,y:depot.y});
  }
  return;
 }
 march(s,u,node,u.villagerRole==='supplier'?.72:.5);
 if(point(u,node)<4){
  const basic=u.villagerRole==='gatherer'?4:3;
  const buff=team.foragerUntil>s.elapsed?1.2:1;
  const tech=Math.min(1,Math.floor((team.tech||0)/2));
  const amount=Math.min(node.stock,cap-carried(u),Math.max(1,Math.floor((basic+tech)*buff)));
  if(amount>0){node.stock-=amount;u.carry[node.type]+=amount;
   if(s.tick%20===0)log(s,'villager_mine',{team:u.team,actor:u.id,role:u.villagerRole,kind:node.type,amount,nodeId:node.id,x:node.x,y:node.y});
  }
 }
}
function repair(s,u,team,log){
 const structures=[
  ...s.towers.filter(t=>t.team===u.team&&alive(t)&&!t.upgrading),
  ...s.buildings.filter(b=>b.team===u.team&&alive(b)&&b.status==='operational')
 ].filter(x=>x.hp<x.maxHp&&s.elapsed-(x.lastDamage??-1e8)>4000);
 structures.sort((a,b)=>point(a,u)-point(b,u));
 const building=structures[0];
 if(building){
  march(s,u,building,.5);
  if(point(u,building)<4&&s.elapsed-u.jobAt>=2500&&money(team,{wood:5,stone:8})){
   const restored=Math.min(19,building.maxHp-building.hp);
   building.hp+=restored;u.jobAt=s.elapsed;
   log(s,'villager_repair',{actor:u.id,team:u.team,role:u.villagerRole,target:building.id,
    amount:restored,x:building.x,y:building.y});
  }
  return;
 }
 const work=s.buildings.find(b=>b.team===u.team&&alive(b)&&b.status==='building');
 march(s,u,work||home(s,u.team),.5); // Construction only advances using existing engine's proximity gate.
}
function defend(s,u,team,log){
 const base=home(s,u.team);
 const enemies=[...Object.values(s.players),...s.units].filter(x=>x.team!==u.team&&alive(x)&&point(x,base)<27)
  .sort((a,b)=>point(a,u)-point(b,u));
 const enemy=enemies[0];
 if(!enemy){march(s,u,{x:base.x+(u.team==='A'?7:-7),y:base.y},.48);return;}
 if(point(enemy,u)>4.5){march(s,u,enemy,.57);return;}
 if(s.elapsed-u.attackAt<1600)return;
 const lost=Math.min(enemy.hp,6+Math.min(3,team.tech||0));
 enemy.hp=Math.max(0,enemy.hp-lost);enemy.lastDamage=s.elapsed;u.attackAt=s.elapsed;
 log(s,'villager_guard',{actor:u.id,team:u.team,role:u.villagerRole,to:enemy.id,amount:lost,x:enemy.x,y:enemy.y});
 if(enemy.hp===0){enemy.alive=false;
  log(s,'unit_ko',{from:u.id,target:enemy.id,team:enemy.team,x:enemy.x,y:enemy.y});
  if(s.players[enemy.id]){enemy.deaths++;enemy.respawnAt=s.elapsed+7500;}
 }
}
function heal(s,u,team,log){
 const friends=[...Object.values(s.players),...s.units].filter(x=>x.team===u.team&&alive(x)&&x.hp<x.maxHp);
 friends.sort((a,b)=>point(a,u)-point(b,u));
 const target=friends[0];
 if(!target){march(s,u,home(s,u.team),.5);return;}
 march(s,u,target,.5);
 if(point(u,target)>=5||s.elapsed-u.jobAt<2500||!money(team,{gold:2}))return;
 const amount=Math.min(target.maxHp-target.hp,12+(team.tech>=3?2:0));
 target.hp+=amount;u.jobAt=s.elapsed;
 log(s,'villager_heal',{actor:u.id,team:u.team,to:target.id,amount,x:target.x,y:target.y});
}
function research(s,u,team,log){
 march(s,u,home(s,u.team),.5);
 if(point(u,home(s,u.team))>5||team.tech>=3||s.elapsed-u.jobAt<15000)return;
 const next=team.tech+1,cost={wood:8*next,gold:8*next,stone:3*next};
 if(!money(team,cost))return;
 team.tech=next;u.jobAt=s.elapsed;
 log(s,'villager_research',{actor:u.id,team:u.team,level:next,cost,x:u.x,y:u.y});
}
export function stepVillager(s,u,log){
 if(!alive(u)||u.kind!=='villager'||!VILLAGER_FACTIONS[u.team])return;
 const team=s.teams[u.team];if(!team)return;
 const order=u.command;
 if(order==='retreat'){march(s,u,home(s,u.team),.7);return;}
 if(order==='mine'||order==='escort'&&u.villagerRole==='supplier'){collect(s,u,team,log);return;}
 if(order==='repair'){repair(s,u,team,log);return;}
 if(order==='research'&&u.villagerRole==='researcher'){research(s,u,team,log);return;}
 if(order==='support'&&u.villagerRole==='healer'){heal(s,u,team,log);return;}
 if((order==='defend'||order==='patrol'||order==='escort')&&u.villagerRole==='guardian'){defend(s,u,team,log);return;}
 // Other non-combat specialists stay near home when ordered to guard.
 march(s,u,home(s,u.team),.5);
}
