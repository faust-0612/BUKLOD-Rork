/** BUKLOD Empire Arena V2 — deterministic, dependency-free, OFFLINE PRACTICE simulation.
 * No account, BP/QMP, Diamond settlement, network, ranked results or live writes.
 * A future trusted game server must run and validate all commands itself.
 */
import {EQUIPMENT_SLOTS,itemDefinition,resolveGear,isExclusiveItem,dropTier,CONSUMABLE_TYPES,consumableDefinition} from './arena-v2-armory.mjs';
import {PICKUP_LIMIT,PICKUP_LIFETIME_MS,ARENA_PICKUP_BY_ID,rollArenaPickupDefinition,applyArenaPickupEffect} from './arena-v2-pickups.mjs';
import {ARENA_MAPS,getArenaMap,terrainFor} from './arena-v2-maps.mjs';
import {BUILD_COSTS,initializeBuildings,operational,baseSite,beginBuild,beginSealRebuild,processEmpireBuilds} from './arena-v2-empire.mjs';
import {STARTER_HERO_KITS,starterAttack,starterSkillCooldown,starterCanAct,starterMoveFactor,starterHitModifiers,starterEvades,starterAfterDamage,castStarterSkill,tickStarterKits} from './arena-starter-hero-kits.mjs';
export {STARTER_HERO_KITS,starterAttack,starterSkillCooldown};
export const STEP_MS=100;
export {EQUIPMENT_SLOTS,itemDefinition,resolveGear,CONSUMABLE_TYPES,consumableDefinition,ARENA_MAPS,BUILD_COSTS};
export const HEROES=Object.freeze({
 phan:{name:'Phan',role:'engineer',style:'supply',item:'Hand-Forged Farm Hoe',itemLevel:1},
 quin:{name:'Quin',role:'scout',style:'blink',item:'Explorer Hiking Compass',itemLevel:7},
 van:{name:'Van',role:'support',style:'heal',item:'Joy Tambourine',itemLevel:1},
 christian:{name:'Christian',role:'commander',style:'guard',item:'Team Leader Radio Set',itemLevel:10},
 lhen:{name:'Lhen',role:'rally',style:'supply',item:'Outreach Loudhailer',itemLevel:13},
 ace:{name:'Ace',role:'vanguard',style:'burst',item:'Junior Nurse BP Cuff',itemLevel:10},
 ellusur:{name:'ELESUR',role:'protector',style:'guard',item:'Legacy Shepherd Crook Staff',itemLevel:20},
 jawo:{name:'Jawo',role:'skirmisher',style:'blink',item:'Community Organizer Radio Set',itemLevel:15},
 mitch:{name:'Mitch',role:'engineer',style:'guard',item:'Workshop Facilitator Tool Caddy',itemLevel:13},
 niel:{name:'Niel',role:'disruptor',style:'disrupt',item:'Outreach Trainer Loudhailer',itemLevel:13},
 angel:{name:'Angel',role:'logistician',style:'heal',item:'Financial Trainer Demo Ledger',itemLevel:15},
 vhen:{name:'Vhen',role:'grower',style:'supply',item:'Seed Kit Hand Trowel',itemLevel:1},
 trudice:{name:'Trudice',role:'controller',style:'disrupt',item:"Children's Ministry Teacher Puppet Kit",itemLevel:13}
});
export const MODES=Object.freeze({duel:{n:1,width:160,height:110,minutes:14},cluster:{n:3,width:240,height:160,minutes:20},grand:{n:5,width:320,height:220,minutes:25}});
export const COSTS=Object.freeze({villager:{wood:35,gold:10,stone:0,time:6000,hp:72},scout:{wood:30,gold:20,stone:0,time:6000,hp:74},warrior:{wood:55,gold:25,stone:0,time:9000,hp:145},archer:{wood:65,gold:30,stone:0,time:10000,hp:90},guardian:{wood:35,gold:45,stone:55,time:14000,hp:230},siege:{wood:100,gold:65,stone:85,time:18000,hp:260}});
export const BUFFS=Object.freeze({forest:{resource:'wood',rate:.2,duration:90000},golden:{resource:'gold',rate:.15,duration:90000},stone:{resource:'stone',rate:.25,duration:90000},lumen:{resource:null,rate:0,duration:60000},forager:{resource:null,rate:0,duration:90000},wisp:{resource:null,rate:0,duration:75000}});
export const SPECIAL_RANK_GATES=Object.freeze({ace:5,ellusur:6,jawo:7,mitch:8,niel:9,angel:10,vhen:11,trudice:13});
export function heroRankEligible(hero,circleRank){if(!HEROES[hero])return false;return !SPECIAL_RANK_GATES[hero]||Number(circleRank)>=SPECIAL_RANK_GATES[hero]}
export function rankedBracket(effective){return Math.max(0,Math.min(4,Math.floor((Math.max(1,effective)-1)/4)))}
export function rankedMatchCompatible(a,b){if(!a||!b||!heroRankEligible(a.hero,a.circleRank)||!heroRankEligible(b.hero,b.circleRank))return false;return rankedBracket(a.effectiveLevel)===rankedBracket(b.effectiveLevel)&&Math.abs((a.mmr||1000)-(b.mmr||1000))<=250&&Math.abs(a.effectiveLevel-b.effectiveLevel)<=3}
export const DIAMOND_THRESHOLDS=Object.freeze([0,15,35,55,75,100,120,155,200,260,340,440,570,730,930,1180,1490,1870,2330,2900]);
const between=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const opponent=t=>t==='A'?'B':'A';
const owner=(s,id)=>s.players[id]||s.units.find(x=>x.id===id)||s.creatures.find(x=>x.id===id)||s.towers.find(x=>x.id===id)||s.buildings.find(x=>x.id===id)||s.heroWalls?.find(x=>x.id===id);
const alive=o=>o&&o.hp>0&&(o.alive!==false);
const xpNeeded=level=>Math.round(65*level+18*level*level);
function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296}
function log(s,type,extra={}){s.events.push({seq:++s.eventSeq,time:s.elapsed,type,...extra});if(s.events.length>100)s.events.shift()}
function spend(team,cost){if(['wood','gold','stone'].some(k=>team.resources[k]<(cost[k]||0)))return false;for(const k of ['wood','gold','stone'])team.resources[k]-=cost[k]||0;return true}
export function assetKey(hero,level,index){if(!HEROES[hero]||!Number.isInteger(level)||level<1||level>20||!Number.isInteger(index)||index<1||index>5)throw Error('Invalid verified collectible key');return `${hero}:L${String(level).padStart(2,'0')}:I${String(index).padStart(2,'0')}`}
export function collectibleArtPath(hero,level,index){assetKey(hero,level,index);return `character-collectibles/${hero}/l${String(level).padStart(2,'0')}-i${String(index).padStart(2,'0')}.webp`}
export function diamondLevel(balance){let level=1;for(let i=0;i<DIAMOND_THRESHOLDS.length;i++)if(balance>=DIAMOND_THRESHOLDS[i])level=i+1;return level}
export function effectiveLevel(snapshot={}){return Math.max(1,Math.min(20,...['characterLevel','bpEligibleLevel','itemVerifiedLevel'].map(k=>between(Math.floor(snapshot[k]??1),1,20)),diamondLevel(Math.max(0,Number(snapshot.diamonds)||0))))}
export function itemPower(hero,level,verifiedKeys){if(!HEROES[hero])return 0;const keys=new Set(Array.isArray(verifiedKeys)?verifiedKeys:[]);let score=0;for(let l=1;l<=Math.min(20,level);l++)for(let i=1;i<=5;i++)if(keys.has(assetKey(hero,l,i)))score+=(i===3?3:i===5?2:1);return between(score/24,0,5)}
export function createPractice({mode='cluster',mapId='verdant_fracture',hero='phan',seed=20261121,snapshot,snapshots=null,allies=[],foes=[]}={}){
 if(!MODES[mode]||!HEROES[hero])throw Error('Invalid Arena V2 mode/character');
 const m=MODES[mode],w=m.width,h=m.height,terrain=terrainFor(mode,w,h,mapId),map=terrain.cfg;
 const s={kind:'OFFLINE_PRACTICE',ranked:false,mode,mapId,map,w,h,seed:seed>>>0,elapsed:0,tick:0,status:'active',phase:'expansion',huntStarted:null,hardLock:false,deadline:m.minutes*60000+240000,hardDeadline:m.minutes*60000,eventSeq:0,events:[],result:null,players:{},teams:{A:{resources:{wood:150,gold:100,stone:110},queue:[],tech:0,kills:0},B:{resources:{wood:150,gold:100,stone:110},queue:[],tech:0,kills:0}},towers:[],units:[],creatures:[],nodes:[],loot:[],cover:terrain.cover,traps:[],heroWalls:[],seals:{A:{hp:1050,maxHp:1050,breached:false,lastDamage:-1e8},B:{hp:1050,maxHp:1050,breached:false,lastDamage:-1e8}},nextId:1,raidCount:0};
 const identities=Object.keys(HEROES);for(const team of ['A','B'])for(let i=0;i<m.n;i++){
  const char=team==='A'?(i===0?hero:(allies[i-1]||identities[(i+3)%13])):(foes[i]||identities[(i+7)%13]);if(!HEROES[char])throw Error('Invalid roster hero');
  const isLocal=team==='A'&&i===0,profile=(snapshots?.[team+i]|| (isLocal?snapshot:null) || {characterLevel:1,bpEligibleLevel:1,itemVerifiedLevel:1,diamonds:0,verifiedItems:[]});
  const lv=effectiveLevel(profile),x=team==='A'?17:w-17,y=h/2+(i-(m.n-1)/2)*5;
  s.players[team+i]={id:team+i,team,hero:char,role:HEROES[char].role,bot:!isLocal,developmentLevel:lv,itemMastery:itemPower(char,lv,profile.verifiedItems),x,y,spawn:{x,y},hp:135,maxHp:135,mana:100,maxMana:100,shield:0,gear:{},killHistory:{},alive:true,respawnAt:0,matchLevel:1,xp:0,kills:0,deaths:0,assists:0,contributions:0,mined:0,moves:0,attacks:0,hits:0,dodges:0,lastAttacked:-1e8,lastMine:-1e8,lastMoveTick:-1,lastOrderTick:-1,lastDamage:-1e8,lastSkill:-1e8,cooldowns:{primary:-1e8,secondary:-1e8,ultimate:-1e8},bag:{wood:0,gold:0,stone:0},effects:{},target:null,botAt:0};
 }
 initializeBuildings(s);
 for(const team of ['A','B'])for(let i=0;i<3;i++){const x=team==='A'?35:w-35,y=h*map.lanes[i];s.towers.push({id:team+'-tower-'+i,team,x,y,lane:i,level:1,hp:340,maxHp:340,lastDamage:-1e8,lastShot:-1e8,lastRepair:-1e8,structureXp:0,specialization:'range',alive:true})}
 // Mirrored deposits: both homelands have each resource, the center is contested.
 for(const side of ['A','B','CENTER'])for(let i=0;i<3;i++){
  const type=['wood','gold','stone'][i],y=h*map.lanes[i],x=w*(side==='A'?.24:side==='B'?.76:.5),capacity=Math.round(600*map.mineBias[type]);
  s.nodes.push({id:'mine'+s.nodes.length,type,side,x,y,stock:capacity,capacity,last:0});
 }
 for(let i=0;i<6;i++){const kind=Object.keys(BUFFS)[i%6],x=w*(i%2?.65:.35),y=h*(.13+Math.floor(i/2)*.34);s.creatures.push({id:'buff'+i,kind,team:null,x,y,home:{x,y},hp:125,maxHp:125,alive:true,respawnAt:0,roamAt:0,lastAttack:-1e8})}
 for(const kind of ['stalker','shellkeeper']){const x=w*.5,y=h*(kind==='stalker'?.37:.63);s.creatures.push({id:kind,kind,team:null,x,y,home:{x,y},hp:kind==='stalker'?420:480,maxHp:kind==='stalker'?420:480,alive:true,respawnAt:0,roamAt:0,lastAttack:-1e8})}
 for(const team of ['A','B'])for(let i=0;i<2;i++){const x=team==='A'?21:w-21,y=h/2+(i?6:-6);s.units.push({id:'v'+team+i,team,kind:'villager',x,y,hp:72,maxHp:72,alive:true,carry:{wood:0,gold:0,stone:0},targetNode:team==='A'?i:i+3,command:'mine',attackAt:-1e8,respawnAt:0})}
 log(s,'match_start',{mode,mapId,mapDifficulty:map.difficulty,roster:Object.values(s.players).map(p=>[p.id,p.hero])});return s;
}
function awardXp(s,p,amount,reason){if(!p?.alive||!amount)return;p.xp+=amount;while(p.matchLevel<15&&p.xp>=xpNeeded(p.matchLevel)){p.xp-=xpNeeded(p.matchLevel);p.matchLevel++;p.maxHp+=8;p.hp=Math.min(p.maxHp,p.hp+22);p.maxMana+=3;p.mana=Math.min(p.maxMana,p.mana+12);log(s,'level_up',{actor:p.id,level:p.matchLevel,x:p.x,y:p.y})}if(reason)log(s,'xp',{actor:p.id,amount,reason})}
function skillMult(p){return 1+Math.min(.12,p.itemMastery*.025)+Math.min(.22,(p.matchLevel-1)*.015)}
const gearOf=p=>resolveGear(p.hero,p.gear);
const shieldCap=p=>105+gearOf(p).shieldMax;
const totalResources=t=>Object.values(t.resources).reduce((a,b)=>a+b,0);
function addBuff(s,p,kind){const cfg=BUFFS[kind];if(!cfg)return;p.effects[kind]=s.elapsed+cfg.duration;if(kind==='forager')s.teams[p.team].foragerUntil=s.elapsed+cfg.duration;if(kind==='lumen')p.mana=Math.min(p.maxMana,p.mana+32);log(s,'buff',{actor:p.id,kind,x:p.x,y:p.y});awardXp(s,p,24,'neutral')}
function lineBlocked(s,a,b){return s.cover.some(([cx,cy,r])=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;const v=d?between(((cx-a.x)*dx+(cy-a.y)*dy)/d,0,1):0;return Math.hypot(a.x+v*dx-cx,a.y+v*dy-cy)<r+.3})}
/** Traverse displacement in small checked segments: dash and blink may not
 * teleport through walls, even if their final destination is free. */
function skillStep(s,p,dx,dy,length){
 const mag=Math.hypot(dx,dy);if(!Number.isFinite(mag)||mag<.01)return false;
 const steps=Math.max(1,Math.ceil(length/.48)),ux=dx/mag,uy=dy/mag;
 let x=p.x,y=p.y;
 for(let i=0;i<steps;i++){
  const nx=between(x+ux*length/steps,2,s.w-2),ny=between(y+uy*length/steps,2,s.h-2);
  if(Math.hypot(nx-x,ny-y)<.001||s.cover.some(([cx,cy,r])=>Math.hypot(nx-cx,ny-cy)<r+1))break;
  x=nx;y=ny;
 }
 if(Math.hypot(x-p.x,y-p.y)<.05)return false;
 p.x=x;p.y=y;p.lastMoveTick=s.tick;return true;
}
function living(s,team){return Object.values(s.players).filter(p=>p.team===team&&p.alive)}
function closeEnemy(s,p,radius=8){return [...Object.values(s.players),...s.units,...s.creatures].filter(x=>x!==p&&alive(x)&&x.team!==p.team&&(x.team!==null||x.kind==='stalker'||x.kind==='shellkeeper'||BUFFS[x.kind])&&distance(p,x)<=radius).sort((a,b)=>distance(p,a)-distance(p,b))[0]}
/** Named, exclusive, match-only relic drops: deterministic quality, bounded RNG.
 * Rare drops use existing canonical item names/art; no persistent ownership transfer.
 */
export function rollEquipmentDrop(s,killer,loser,quality=.45,source='hero'){
 if(!killer||!loser||!HEROES[killer.hero])return null;
 const hasComeback=totalResources(s.teams[killer.team])+80<totalResources(s.teams[opponent(killer.team)]);
 const chance=between((source==='boss'?.65:source==='buff'?.17:.1)+quality*(source==='boss'?.16:.08)+(hasComeback?.03:0),.1,.81);
 if(rand(s)>chance)return null;
 const tier=dropTier({matchLevel:killer.matchLevel,quality,phase:s.phase,behind:hasComeback});
 // Health/mana milestone consumables remain character-exclusive; gear unlocks gradually
 // with match XP, not permanent BP spending. Every combat gear slot remains attainable.
 const giveConsumable=rand(s)<.27;
 const slotIndexMax=killer.matchLevel>=12?4:killer.matchLevel>=9?3:killer.matchLevel>=6?2:killer.matchLevel>=3?1:0;
 const slot=EQUIPMENT_SLOTS[Math.floor(rand(s)*(slotIndexMax+1))];
 const item=giveConsumable?consumableDefinition(killer.hero,CONSUMABLE_TYPES[Math.floor(rand(s)*CONSUMABLE_TYPES.length)],tier):itemDefinition(killer.hero,slot,tier);
 const kind=giveConsumable?'consumable':'equipment';
 const drop={id:'relic'+s.nextId++,x:loser.x,y:loser.y,kind,item,ownerHero:killer.hero,expires:s.elapsed+55000};
 s.loot.push(drop);log(s,'equipment_drop',{actor:killer.id,hero:killer.hero,name:item.name,slot:item.slot||item.type,tier,source,x:loser.x,y:loser.y});return drop;
}

/** Match-only deterministic drop, capped independently of all permanent economy. */
export function rollArenaFieldPickup(s,killer,loser,source='hero'){
 if(!s||s.status!=='active'||!killer?.alive||!loser||!HEROES[killer.hero])return null;
 if(s.loot.filter(x=>x.kind==='field_pickup').length>=PICKUP_LIMIT||s.loot.length>=36)return null;
 const chance={hero:.43,boss:.92,buff:.48,unit:.17,tower:.65}[source]??.2;
 if(rand(s)>chance)return null;
 const item=rollArenaPickupDefinition({hero:killer.hero,matchLevel:killer.matchLevel,source,random:()=>rand(s)});
 if(!item)return null;
 const drop={id:'field'+s.nextId++,x:loser.x,y:loser.y,kind:'field_pickup',
  itemId:item.id,ownerHero:item.hero,effect:item.effect,rarity:item.rarity,
  expires:s.elapsed+PICKUP_LIFETIME_MS};
 s.loot.push(drop);
 log(s,'field_pickup_drop',{actor:killer.id,id:drop.id,itemId:item.id,name:item.name,
  rarity:item.rarity,hero:item.hero,source,x:drop.x,y:drop.y});
 return drop;
}
function hit(s,p,target,base){if(!p?.alive||!alive(target)||target.team===p.team||(target.kind!=='kit_wall'&&lineBlocked(s,p,target)))return false;
 if(starterEvades(s,target)){log(s,'kit_evasion',{actor:target.id,from:p.id,x:target.x,y:target.y});return true;}
 const offense=gearOf(p),defense=s.players[target.id]?gearOf(target):{mitigation:0,block:0};const fieldFury=p.effects?.fieldFury>s.elapsed?Math.min(.22,p.effects.fieldFuryStrength||0):0,fieldGuard=target.effects?.fieldGuard>s.elapsed?Math.min(.2,target.effects.fieldGuardStrength||0):0;const raw=starterHitModifiers(s,p,target,(base+offense.attack)*skillMult(p)*(1+fieldFury)),mitigated=raw*(1-Math.min(.42,(defense.mitigation||0)+(defense.block||0)+fieldGuard));const resisted=target.shield?Math.min(target.shield,mitigated):0;target.shield=(target.shield||0)-resisted;const d=Math.max(0,mitigated-resisted),priorHp=target.hp;target.hp=Math.max(0,target.hp-d);target.lastDamage=s.elapsed;p.hits++;log(s,'damage',{from:p.id,to:target.id,amount:Math.round(Math.min(d,priorHp)),absorbed:Math.round(resisted),fromX:p.x,fromY:p.y,toX:target.x,toY:target.y,x:target.x,y:target.y});
 starterAfterDamage(s,p,target,log);
  if(target.hp>0)return true;target.alive=false;log(s,'defeat',{from:p.id,to:target.id,team:target.team??null,kind:target.kind||'hero',x:target.x,y:target.y});
 if(s.players[target.id]){target.deaths++;p.kills++;s.teams[p.team].kills++;target.respawnAt=s.elapsed+7500;
  const carried=Object.values(target.bag).reduce((a,b)=>a+b,0);if(carried>0){s.loot.push({id:'resources'+s.nextId++,x:target.x,y:target.y,kind:'resources',resources:{...target.bag},expires:s.elapsed+45000});target.bag={wood:0,gold:0,stone:0};log(s,'resource_drop',{from:target.id,amount:Math.round(carried)})}const repeat=p.killHistory[target.id]||0;p.killHistory[target.id]=repeat+1;awardXp(s,p,Math.max(12,Math.round(115/(repeat+1))),'hero_defeat');const quality=between((p.attacks? p.hits/p.attacks:0)*.45+(p.contributions? .35:0)+.2,0,1);if(repeat<2)rollEquipmentDrop(s,p,target,quality,'hero');rollArenaFieldPickup(s,p,target,'hero')}
 else if(target.kind==='stalker'||target.kind==='shellkeeper'){log(s,'boss_defeat',{actor:p.id,target:target.id,kind:target.kind,x:target.x,y:target.y});awardXp(s,p,140,'world_boss');rollEquipmentDrop(s,p,target,.65,'boss');rollArenaFieldPickup(s,p,target,'boss');if(target.kind==='shellkeeper'){for(const t of s.towers.filter(t=>t.team===p.team&&t.alive))t.structureXp+=65;s.seals[p.team].hp=Math.min(s.seals[p.team].maxHp,s.seals[p.team].hp+70);log(s,'structure_xp',{team:p.team,amount:65})}else{p.effects.hunter=s.elapsed+55000;log(s,'hunter_reward',{actor:p.id})}target.respawnAt=s.elapsed+105000;}
 else if(BUFFS[target.kind]){addBuff(s,p,target.kind);rollEquipmentDrop(s,p,target,.4,'buff');rollArenaFieldPickup(s,p,target,'buff');target.respawnAt=s.elapsed+65000;}
 else if(s.units.includes(target)){awardXp(s,p,16,'unit_defeat');rollArenaFieldPickup(s,p,target,'unit');}
 else if(s.towers.includes(target)){target.lastDamage=s.elapsed;awardXp(s,p,65,'tower_destroyed');rollArenaFieldPickup(s,p,target,'tower');log(s,'tower_destroyed',{team:target.team,tower:target.id})}
 else if(s.buildings.includes(target)){target.lastDamage=s.elapsed;awardXp(s,p,32,'building_destroyed');log(s,'building_destroyed',{team:target.team,building:target.id})}
  else if(target.kind==='kit_wall'){log(s,'kit_wall_destroyed',{wallId:target.id,team:target.team,x:target.x,y:target.y})}
 return true;
}
function resolve(s){if(s.status!=='active')return;const a=living(s,'A'),b=living(s,'B');
 if(s.huntStarted!==null){if(!a.length&&!b.length){s.status='void';s.result={winner:null,reason:'simultaneous_final_elimination'};log(s,'result',s.result);return}
  if(!b.length&&s.seals.B.breached){s.status='finished';s.result={winner:'A',reason:'seal_and_elimination'};log(s,'result',s.result);return}
  if(!a.length&&s.seals.A.breached){s.status='finished';s.result={winner:'B',reason:'seal_and_elimination'};log(s,'result',s.result);return}}
}
function assertOwner(s,playerId){const p=s.players[playerId];if(!p||!p.alive)return null;return p}
/** Commands are bounded and validated. This is practice only: no trusted network identity exists. */
export function command(s,playerId,action={}){
 if(s.status!=='active')return false;const p=assertOwner(s,playerId);if(!p||!action||typeof action.type!=='string')return false;
  if(['move','attack','skill'].includes(action.type)&&!starterCanAct(s,p))return false;
  const t=s.teams[p.team];
 if(action.type==='move'){if(p.lastMoveTick===s.tick)return false;const dx=Number(action.dx),dy=Number(action.dy),mag=Math.hypot(dx,dy);if(!Number.isFinite(mag)||mag<.05)return false;const sp=4.4*(1+gearOf(p).speed)*(p.effects.lumen>s.elapsed?1.16:1)*(p.effects.slow>s.elapsed?.7:1)*(p.effects.fieldHaste>s.elapsed?1+Math.min(.25,p.effects.fieldHasteStrength||0):1)*starterMoveFactor(s,p),step=sp*STEP_MS/1000;
  const x=between(p.x+dx/mag*step,2,s.w-2),y=between(p.y+dy/mag*step,2,s.h-2);if(distance({x,y},p)>.6||s.cover.some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r+1))return false;p.x=x;p.y=y;p.moves++;p.lastMoveTick=s.tick;return true}
 if(action.type==='mine'){if(s.elapsed-p.lastMine<700)return false;const node=s.nodes.find(x=>x.id===action.nodeId)||s.nodes.filter(n=>distance(p,n)<8).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(!node||distance(p,node)>8||node.stock<=0)return false;
  const bagTotal=Object.values(p.bag).reduce((a,b)=>a+b,0);if(bagTotal>=65)return false;const base=Math.min(12,node.stock,65-bagTotal),buff=p.effects[{wood:'forest',gold:'golden',stone:'stone'}[node.type]]>s.elapsed?BUFFS[{wood:'forest',gold:'golden',stone:'stone'}[node.type]].rate:0;
  const mastery=(HEROES[p.hero].role==='grower'||HEROES[p.hero].role==='engineer'?Math.min(.09,p.itemMastery*.02):0)+(gearOf(p).specialty.miningBonus||gearOf(p).specialty.resourceBonus||0);const mined=Math.min(node.stock,65-bagTotal,Math.round(base*(1+buff+mastery)));p.bag[node.type]+=mined;node.stock-=mined;p.lastMine=s.elapsed;p.mined+=mined;p.contributions++;if(p.hero==='vhen')p.hp=Math.min(p.maxHp,p.hp+1.5);if(p.mined%60<mined)awardXp(s,p,9,'mining');log(s,'mine',{actor:p.id,kind:node.type,amount:mined,nodeId:node.id,x:node.x,y:node.y});return true}
 if(action.type==='deposit'){const depot={x:p.team==='A'?18:s.w-18,y:s.h/2};if(distance(p,depot)>13||!operational(s,p.team,'depot'))return false;const transferred={wood:p.bag.wood||0,gold:p.bag.gold||0,stone:p.bag.stone||0};if(!Object.values(transferred).some(v=>v>0))return false;for(const k of ['wood','gold','stone']){t.resources[k]+=transferred[k];p.bag[k]=0}log(s,'deposit',{actor:p.id,resources:transferred,x:depot.x,y:depot.y});return true}
 if(action.type==='train'){if(p.lastOrderTick===s.tick)return false;const kind=action.kind,c=COSTS[kind];if(!c||t.queue.length>=3||s.units.filter(x=>x.team===p.team&&x.alive&&x.kind!=='villager').length>=18||s.units.filter(x=>x.team===p.team&&x.alive&&x.kind==='villager').length>=6&&kind==='villager')return false;const depot={x:p.team==='A'?18:s.w-18,y:s.h/2};if(distance(p,depot)>18||!operational(s,p.team,'barracks')||!spend(t,c))return false;t.queue.push({kind,ready:s.elapsed+c.time*(t.tempoUntil>s.elapsed?.88:1)});p.lastOrderTick=s.tick;log(s,'train_order',{actor:p.id,kind});p.contributions++;return true}
 if(action.type==='order'){if(!['mine','escort','defend','push','retreat','patrol','repair'].includes(action.order))return false;for(const unit of s.units.filter(u=>u.team===p.team&&u.alive)){if(action.kind&&unit.kind!==action.kind)continue;unit.command=action.order;if(action.nodeId&&s.nodes.some(n=>n.id===action.nodeId))unit.targetNode=action.nodeId}log(s,'army_order',{team:p.team,order:action.order});return true}
 if(action.type==='tower_upgrade'){const tower=s.towers.find(x=>x.id===action.towerId&&x.team===p.team&&x.alive);if(!tower||tower.level>=5||distance(p,tower)>10||s.elapsed-tower.lastDamage<4000||tower.structureXp<Math.max(0,(tower.level-1)*35))return false;const c={wood:45+20*tower.level,gold:20+15*tower.level,stone:55+25*tower.level};if(tower.upgrading||!spend(t,c))return false;const neededXp=Math.max(0,(tower.level-1)*35);tower.upgrading={ms:0,progress:0,stage:'foundation',duration:9000+3000*tower.level,requiredXp:neededXp};log(s,'tower_upgrade_start',{actor:p.id,team:p.team,tower:tower.id,to:tower.level+1,x:tower.x,y:tower.y});p.contributions++;awardXp(s,p,20,'engineering');return true}
 if(action.type==='tower_repair'){const tower=s.towers.find(x=>x.id===action.towerId&&x.team===p.team&&x.alive);if(!tower||distance(p,tower)>10||s.elapsed-tower.lastDamage<4000||s.elapsed-tower.lastRepair<1500||tower.hp>=tower.maxHp)return false;if(!spend(t,{wood:12,stone:18}))return false;tower.hp=Math.min(tower.maxHp,tower.hp+55);tower.lastRepair=s.elapsed;log(s,'tower_repair',{actor:p.id,tower:tower.id});p.contributions++;return true}
 if(action.type==='reinforce_gear'){
  const slot=action.slot,item=p.gear[slot],forge=s.buildings.find(b=>b.team===p.team&&b.kind==='workshop'&&b.status==='operational'&&b.alive&&distance(p,b)<9);
  if(!forge||!EQUIPMENT_SLOTS.includes(slot)||!item||item.tier>=4||p.matchLevel<3*item.tier+2)return false;
  const cost={wood:10+10*item.tier,gold:35+25*item.tier,stone:20+20*item.tier};if(!spend(t,cost))return false;
  const prev=gearOf(p);p.gear[slot]=itemDefinition(p.hero,slot,item.tier+1);const current=gearOf(p);
  p.maxHp+=current.hp-prev.hp;p.hp=Math.min(p.maxHp,p.hp+current.hp-prev.hp);
  p.maxMana+=current.mana-prev.mana;p.mana=Math.min(p.maxMana,p.mana+current.mana-prev.mana);
  p.shield=Math.min(shieldCap(p),p.shield+Math.max(0,current.shieldMax-prev.shieldMax));
  log(s,'relic_reinforced',{actor:p.id,name:item.name,slot,tier:item.tier+1});return true}
 if(action.type==='build')return beginBuild(s,p,action.kind,Number(action.x),Number(action.y),log);
 if(action.type==='rebuild_seal')return beginSealRebuild(s,p,log);
 if(action.type==='attack'){
  const basic=starterAttack(p.hero);const cooldown=basic?.cooldown??800,range=basic?.range??5.5;
   if(s.elapsed-p.lastAttacked<cooldown)return false;const target=action.targetId?owner(s,action.targetId):closeEnemy(s,p,range);
   if(!target||!alive(target)||target.team===p.team||distance(p,target)>range||(target.kind!=='kit_wall'&&lineBlocked(s,p,target)))return false;
   p.lastAttacked=s.elapsed;p.attacks++;return hit(s,p,target,basic?.damage??20)}
 if(action.type==='skill'){
  const slot=action.slot;if(!['primary','secondary','ultimate'].includes(slot)||slot==='secondary'&&p.matchLevel<3||slot==='ultimate'&&p.matchLevel<6)return false;
  const cd=(starterSkillCooldown(p.hero,slot)??{primary:5800,secondary:11000,ultimate:38000}[slot])/(1+Math.min(.2,p.itemMastery*.04)+gearOf(p).cooldown);const manaCost={primary:18,secondary:14,ultimate:55}[slot];if(s.elapsed-p.cooldowns[slot]<cd||p.mana<manaCost)return false;
  const hero=HEROES[p.hero],target=action.targetId?owner(s,action.targetId):closeEnemy(s,p,8);
  const kitResult=STARTER_HERO_KITS[p.hero]?castStarterSkill(s,p,slot,action,{hit,skillStep,log,shieldCap}):null;
  let success=Boolean(kitResult);
  if(!STARTER_HERO_KITS[p.hero]){
  if(slot==='secondary'){const dx=Number(action.dx)||1,dy=Number(action.dy)||0;success=skillStep(s,p,dx,dy,4);if(success)log(s,'dash',{actor:p.id,x:p.x,y:p.y})}
  else if(hero.style==='heal'){const ally=[...living(s,p.team)].sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];if(ally&&distance(p,ally)<10){ally.hp=Math.min(ally.maxHp,ally.hp+(slot==='ultimate'?80:38)*skillMult(p));success=true}}
  else if(hero.style==='guard'){p.shield=Math.min(shieldCap(p),(p.shield||0)+(slot==='ultimate'?68:36)*skillMult(p));if(slot==='ultimate')for(const a of living(s,p.team))if(distance(p,a)<9)a.shield=Math.min(90,(a.shield||0)+25);success=true}
  else if(hero.style==='supply'){if(slot==='ultimate'){for(const a of living(s,p.team))if(distance(p,a)<12){a.hp=Math.min(a.maxHp,a.hp+35);a.effects.lumen=s.elapsed+2500}}else p.shield=Math.min(shieldCap(p),p.shield+25);success=true}
  else if(hero.style==='blink'){const dx=Number(action.dx)||1,dy=Number(action.dy)||0;success=skillStep(s,p,dx,dy,slot==='ultimate'?8:5);if(success&&target&&distance(p,target)<6)hit(s,p,target,slot==='ultimate'?55:22)}
  else if(target&&alive(target)&&distance(p,target)<(slot==='ultimate'?10:7)){success=hit(s,p,target,slot==='ultimate'?69:35);if(hero.style==='disrupt'&&target.effects)target.effects.slow=s.elapsed+2800}
  }
  if(!success)return false;
  // Character-specific tactical modifiers: 13 canon identities, item mastery governs strength.
  const q=p.itemMastery,boost=1+Math.min(.15,q*.03);
  if(!STARTER_HERO_KITS[p.hero]){
  if(p.hero==='phan'){const tower=s.towers.find(t=>t.alive&&t.team===p.team&&distance(p,t)<9);if(tower&&s.elapsed-tower.lastDamage>4000)tower.hp=Math.min(tower.maxHp,tower.hp+Math.round(8*boost));}
  else if(p.hero==='quin')p.effects.scout=s.elapsed+Math.round(4200*boost);
  else if(p.hero==='van'){for(const a of living(s,p.team))if(distance(p,a)<7)a.shield=Math.min(100,(a.shield||0)+Math.round(6*boost));}
  else if(p.hero==='christian'){for(const a of living(s,p.team))if(distance(p,a)<7)a.shield=Math.min(100,(a.shield||0)+Math.round(12*boost));}
  else if(p.hero==='lhen')s.teams[p.team].tempoUntil=s.elapsed+Math.round(7500*boost);
  else if(p.hero==='ace')p.effects.edge=s.elapsed+Math.round(4800*boost);
  else if(p.hero==='ellusur'){for(const a of living(s,p.team))if(distance(p,a)<7)a.shield=Math.min(100,(a.shield||0)+Math.round(18*boost));}
  else if(p.hero==='jawo'){for(const a of living(s,p.team))if(distance(p,a)<6)a.effects.lumen=s.elapsed+Math.round(2800*boost);}
  else if(p.hero==='mitch'&&s.traps.length<12){s.traps.push({id:'trap'+s.nextId++,team:p.team,x:p.x,y:p.y,expires:s.elapsed+30000,damage:Math.round(18*boost)});}
  else if(p.hero==='niel'){for(const a of living(s,opponent(p.team)))if(distance(p,a)<7)a.effects.slow=s.elapsed+Math.round(2500*boost);}
  else if(p.hero==='angel'){for(const a of living(s,p.team))if(distance(p,a)<8)a.hp=Math.min(a.maxHp,a.hp+Math.round(7*boost));}
  else if(p.hero==='vhen')p.effects.forest=s.elapsed+Math.round(8000*boost);
  else if(p.hero==='trudice'&&s.traps.length<12){s.traps.push({id:'decoy'+s.nextId++,team:p.team,x:p.x,y:p.y,expires:s.elapsed+12000,damage:Math.round(10*boost)});}
  }
  p.mana-=manaCost;p.cooldowns[slot]=s.elapsed;p.contributions++;log(s,'skill',{actor:p.id,slot,style:hero.style,mastery:p.itemMastery,identity:p.hero,skillId:kitResult?.id??null,x:p.x,y:p.y,targetId:target?.id??null,targetX:target?.x??p.x,targetY:target?.y??p.y});return true}
 if(action.type==='seal_attack'){const enemy=opponent(p.team),seal=s.seals[enemy],base={x:enemy==='A'?14:s.w-14,y:s.h/2};if(seal.breached||distance(p,base)>7||s.towers.filter(t=>t.team===enemy&&t.alive).length>1||s.elapsed-p.lastAttacked<950)return false;p.lastAttacked=s.elapsed;seal.hp=Math.max(0,seal.hp-(27+4*p.matchLevel)*skillMult(p));seal.lastDamage=s.elapsed;log(s,'seal_damage',{from:p.id,team:enemy,hp:Math.round(seal.hp)});if(seal.hp<=0){seal.breached=true;startHunt(s,'seal_breach');log(s,'seal_breached',{team:enemy})}resolve(s);return true}
 if(action.type==='loot'){
  const item=s.loot.find(x=>x.id===action.id&&distance(p,x)<3);if(!item)return false;
  const kind=item.kind;
  const collectedResources={wood:0,gold:0,stone:0};
  if(kind==='equipment'){
   if(!isExclusiveItem(p.hero,item.item)||item.ownerHero!==p.hero)return false;
   const previous=p.gear[item.item.slot];if(previous&&previous.tier>=item.item.tier)return false;
   const before=gearOf(p);p.gear[item.item.slot]=item.item;const after=gearOf(p);
   p.maxHp+=after.hp-before.hp;p.hp=Math.min(p.maxHp,p.hp+after.hp-before.hp);
   p.maxMana+=after.mana-before.mana;p.mana=Math.min(p.maxMana,p.mana+after.mana-before.mana);
   p.shield=Math.min(shieldCap(p),p.shield+Math.max(0,after.shieldMax-before.shieldMax));
   log(s,'equipment_equip',{actor:p.id,hero:p.hero,slot:item.item.slot,tier:item.item.tier,name:item.item.name});
  }else if(kind==='consumable'){const c=item.item,verified=consumableDefinition(p.hero,c.type,c.tier);if(item.ownerHero!==p.hero||verified.id!==c.id)return false;if(c.type==='health')p.hp=Math.min(p.maxHp,p.hp+verified.amount);else p.mana=Math.min(p.maxMana,p.mana+verified.amount);log(s,'item_consumed',{actor:p.id,type:c.type,name:c.name,amount:verified.amount});
  }else if(kind==='vital')p.hp=Math.min(p.maxHp,p.hp+45);
  else if(kind==='mana')p.mana=Math.min(p.maxMana,p.mana+45);
  else if(kind==='ward')p.shield=Math.min(shieldCap(p),p.shield+40);
  else if(kind==='edge')p.effects.edge=s.elapsed+50000;
  else if(kind==='field_pickup'){
   if(!item.itemId||!ARENA_PICKUP_BY_ID[item.itemId]||item.expires<=s.elapsed)return false;
   const definition=ARENA_PICKUP_BY_ID[item.itemId];
   if(item.ownerHero!==definition.hero)return false;
   const receipt=applyArenaPickupEffect(s,p,definition,{awardXp,shieldCap});
   if(!receipt)return false;
   log(s,'field_pickup_claimed',{actor:p.id,id:item.id,itemId:definition.id,
    name:definition.name,effect:receipt.effect,amount:receipt.amount,rarity:definition.rarity,
    x:item.x,y:item.y});
  }else if(kind==='resources'){
    let limit=Math.max(0,65-Object.values(p.bag).reduce((a,b)=>a+b,0));
    if(limit<=0)return false;
    for(const k of ['wood','gold','stone']){
      const n=Math.min(limit,Math.max(0,item.resources[k]||0));
      p.bag[k]+=n;collectedResources[k]=n;limit-=n;
    }
    if(!Object.values(collectedResources).some(v=>v>0))return false;
    // Keep uncollected stock in the same expiring ground drop. A full bag must
    // never make another player's earned resources disappear.
    for(const k of ['wood','gold','stone'])item.resources[k]=Math.max(0,(item.resources[k]||0)-collectedResources[k]);
  }else p.effects.lumen=s.elapsed+40000;
  const allCollected=kind!=='resources'||!Object.values(item.resources).some(v=>v>0);
  if(allCollected)s.loot=s.loot.filter(x=>x.id!==item.id);
  log(s,'loot',{actor:p.id,kind,lootId:item.id,name:item.item?.name??ARENA_PICKUP_BY_ID[item.itemId]?.name??kind,tier:item.item?.tier??ARENA_PICKUP_BY_ID[item.itemId]?.tier??1,itemId:item.itemId??null,resources:collectedResources,x:item.x,y:item.y});return true}

 return false;
}
function startHunt(s,reason){if(s.huntStarted!==null)return;s.huntStarted=s.elapsed;s.phase='hunt';log(s,'final_hunt',{reason});}
function sealRestored(s,team){if(!s.hardLock&&!s.seals.A.breached&&!s.seals.B.breached){s.huntStarted=null;s.phase='siege';log(s,'defense_recovered',{team,respawnsRestored:true})}}
function moveToward(o,d,amount,s){const len=distance(o,d);if(len<.02)return;const step=Math.min(amount,len);o.x=between(o.x+(d.x-o.x)/len*step,2,s.w-2);o.y=between(o.y+(d.y-o.y)/len*step,2,s.h-2)}
function automata(s){
 // Production is explicit: queued units only, never free auto-spawning minion waves.
 for(const team of ['A','B']){const t=s.teams[team];while(t.queue.length&&t.queue[0].ready<=s.elapsed){const q=t.queue.shift(),c=COSTS[q.kind],idx=s.nextId++;const x=team==='A'?23:s.w-23,y=s.h*(.24+(idx%3)*.26);s.units.push({id:'u'+idx,team,kind:q.kind,x,y,hp:c.hp,maxHp:c.hp,alive:true,carry:{wood:0,gold:0,stone:0},targetNode:team==='A'?0:3,command:q.kind==='villager'?'mine':'push',attackAt:-1e8});log(s,'unit_spawn',{team,kind:q.kind})}}
 for(const node of s.nodes)node.stock=Math.min(node.capacity,node.stock+.065*s.map.regenRate);
 for(const unit of s.units){if(!unit.alive)continue;const target=[...Object.values(s.players),...s.units].filter(x=>alive(x)&&x.team!==unit.team&&distance(unit,x)<(unit.kind==='archer'?7:4.5)).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(target&&s.elapsed-unit.attackAt>=1400){unit.attackAt=s.elapsed;const base=unit.kind==='villager'?4:unit.kind==='guardian'?12:unit.kind==='siege'?18:9;target.hp=Math.max(0,target.hp-base);target.lastDamage=s.elapsed;log(s,'unit_hit',{from:unit.id,to:target.id,team:target.team??null,x:target.x,y:target.y});if(target.hp<=0){target.alive=false;log(s,'unit_ko',{from:unit.id,target:target.id,team:target.team??null,x:target.x,y:target.y});if(s.players[target.id]){target.deaths++;target.respawnAt=s.elapsed+7500}}continue}
  if(unit.kind==='villager'&&unit.command==='repair'){
   const tower=s.towers.filter(t=>t.alive&&t.team===unit.team&&t.hp<t.maxHp&&s.elapsed-t.lastDamage>4000).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
   if(tower){moveToward(unit,tower,.5,s);if(distance(unit,tower)<4&&s.elapsed-unit.attackAt>2500&&spend(s.teams[unit.team],{wood:5,stone:8})){tower.hp=Math.min(tower.maxHp,tower.hp+19);unit.attackAt=s.elapsed;log(s,'villager_repair',{tower:tower.id,team:unit.team})}continue}}
  if(unit.kind==='villager'&&unit.command==='mine'){
   const node=s.nodes.find(n=>n.id===unit.targetNode)||s.nodes[unit.team==='A'?0:3];const carried=Object.values(unit.carry).reduce((a,b)=>a+b,0);if(carried>=50||node.stock<1){const depot={x:unit.team==='A'?20:s.w-20,y:s.h/2};moveToward(unit,depot,.5,s);if(distance(unit,depot)<3){for(const k of ['wood','gold','stone']){s.teams[unit.team].resources[k]+=unit.carry[k];unit.carry[k]=0}unit.targetNode=unit.team==='A'?Math.floor(rand(s)*3):3+Math.floor(rand(s)*3)}}else{moveToward(unit,node,.5,s);if(distance(unit,node)<4){const amount=Math.min(3,node.stock,50-carried);node.stock-=amount;unit.carry[node.type]+=Math.min(50-carried,amount*(s.teams[unit.team].foragerUntil>s.elapsed?1.2:1))}}continue}
  const dest=unit.command==='retreat'?{x:unit.team==='A'?20:s.w-20,y:s.h/2}:unit.command==='defend'?{x:unit.team==='A'?37:s.w-37,y:s.h/2}:unit.command==='mine'?s.nodes[unit.targetNode]||s.nodes[0]:{x:unit.team==='A'?s.w-14:14,y:s.h*(.24+(s.units.indexOf(unit)%3)*.26)};
  moveToward(unit,dest,unit.kind==='siege'?.26:.43,s);
  if(unit.kind==='siege'&&distance(unit,{x:unit.team==='A'?s.w-14:14,y:s.h/2})<8){const enemy=opponent(unit.team),seal=s.seals[enemy];if(s.towers.filter(x=>x.team===enemy&&x.alive).length<=1&&!seal.breached){seal.hp=Math.max(0,seal.hp-6);seal.lastDamage=s.elapsed;if(seal.hp===0){seal.breached=true;startHunt(s,'siege_breach');log(s,'seal_breached',{team:enemy})}}}
 }
 // towers fire at units or heroes, only inside defended area.
 for(const tower of s.towers){if(!tower.alive||s.elapsed-tower.lastShot<1400)continue;const targets=[...Object.values(s.players),...s.units].filter(x=>x.team!==tower.team&&alive(x)&&distance(x,tower)<9+tower.level*1.5).sort((a,b)=>distance(a,tower)-distance(b,tower));if(!targets.length)continue;const target=targets[0],armor=s.players[target.id]?gearOf(target).mitigation:0;target.hp=Math.max(0,target.hp-(11+4*tower.level)*(1-armor));target.lastDamage=s.elapsed;tower.lastShot=s.elapsed;log(s,'tower_hit',{tower:tower.id,team:tower.team,target:target.id,x:target.x,y:target.y});if(target.hp===0){target.alive=false;log(s,'tower_ko',{tower:tower.id,team:target.team??null,target:target.id,x:target.x,y:target.y});if(s.players[target.id]){target.deaths++;target.respawnAt=s.elapsed+7500}}}
 for(const creature of s.creatures){if(!creature.alive){if(s.elapsed>=creature.respawnAt){creature.alive=true;creature.hp=creature.maxHp;creature.x=creature.home.x;creature.y=creature.home.y;log(s,'creature_respawn',{kind:creature.kind,x:creature.x,y:creature.y})}continue}
  if(creature.kind==='stalker'){const target=Object.values(s.players).filter(x=>x.alive&&distance(x,creature)<30).sort((a,b)=>distance(a,creature)-distance(b,creature))[0];if(target){moveToward(creature,target,.52,s);if(distance(creature,target)<4&&s.elapsed-creature.lastAttack>1600){target.hp=Math.max(0,target.hp-16*s.map.bossPressure);target.lastDamage=s.elapsed;creature.lastAttack=s.elapsed;log(s,'boss_hit',{actor:creature.id,target:target.id,kind:creature.kind,x:target.x,y:target.y});if(target.hp===0){target.alive=false;target.deaths++;target.respawnAt=s.elapsed+7500;log(s,'boss_ko',{actor:creature.id,target:target.id,team:target.team??null,x:target.x,y:target.y})}}}else if(distance(creature,creature.home)>3)moveToward(creature,creature.home,.3,s)}
  else if(s.elapsed-creature.roamAt>2200){creature.roamAt=s.elapsed;const theta=rand(s)*Math.PI*2,r=3+rand(s)*5;const dest={x:between(creature.home.x+Math.cos(theta)*r,3,s.w-3),y:between(creature.home.y+Math.sin(theta)*r,3,s.h-3)};moveToward(creature,dest,2.5,s)}
 }
 // Resurrections only BEFORE the Final Hunt begins.
 if(s.huntStarted===null)for(const p of Object.values(s.players)){if(!p.alive&&s.elapsed>=p.respawnAt){p.alive=true;p.hp=p.maxHp;p.mana=p.maxMana;p.shield=0;for(const kind of ['Haste','Fury','Guard','Regen']){p.effects['field'+kind]=0;p.effects['field'+kind+'Strength']=0;}p.x=p.spawn.x;p.y=p.spawn.y;log(s,'respawn',{actor:p.id})}}
 for(const trap of s.traps){if(trap.expires<=s.elapsed)continue;const foe=[...Object.values(s.players),...s.units].find(x=>x.team!==trap.team&&alive(x)&&distance(x,trap)<2.2);if(foe){foe.hp=Math.max(0,foe.hp-trap.damage);foe.lastDamage=s.elapsed;trap.expires=0;log(s,'trap_hit',{target:foe.id,team:trap.team,x:foe.x,y:foe.y});if(foe.hp===0){foe.alive=false;log(s,'trap_ko',{target:foe.id,team:foe.team??null,x:foe.x,y:foe.y});if(s.players[foe.id]){foe.deaths++;foe.respawnAt=s.elapsed+7500}}}}s.traps=s.traps.filter(t=>t.expires>s.elapsed);
 for(const item of s.loot)if(item.expires<=s.elapsed)item.expired=true;s.loot=s.loot.filter(x=>!x.expired);
}
function runBot(s,p){if(!p.alive||s.elapsed-p.botAt<400)return;p.botAt=s.elapsed;
 if(s.huntStarted!==null&&s.seals[p.team].breached&&!s.hardLock&&s.teams[p.team].rebuildCount<1){const site=baseSite(s,p.team);if(distance(p,site)>8){command(s,p.id,{type:'move',dx:site.x-p.x,dy:site.y-p.y});return}if(!s.teams[p.team].rebuildJob){command(s,p.id,{type:'rebuild_seal'});return}}
 const foe=closeEnemy(s,p,7);if(foe){if(distance(p,foe)<=5.5){command(s,p.id,{type:'attack',targetId:foe.id});if(rand(s)<.4)command(s,p.id,{type:'skill',slot:'primary',targetId:foe.id,dx:foe.x-p.x,dy:foe.y-p.y})}else command(s,p.id,{type:'move',dx:foe.x-p.x,dy:foe.y-p.y});return}
 if(s.huntStarted!==null){const enemy=opponent(p.team),seal=s.seals[enemy],dest=seal.breached?living(s,enemy)[0]:{x:enemy==='A'?14:s.w-14,y:s.h/2};if(!dest)return;if(distance(p,dest)<7&&!seal.breached)command(s,p.id,{type:'seal_attack'});else command(s,p.id,{type:'move',dx:dest.x-p.x,dy:dest.y-p.y});return}
 const nearDepot=distance(p,{x:p.team==='A'?18:s.w-18,y:s.h/2})<13;if(nearDepot&&Object.values(p.bag).some(n=>n>0))command(s,p.id,{type:'deposit'});
 if(nearDepot&&s.units.filter(x=>x.team===p.team&&x.alive).length<10&&s.teams[p.team].queue.length<2){command(s,p.id,{type:'train',kind:s.teams[p.team].resources.gold>100?'warrior':'villager'})}
 const enemy=opponent(p.team),tower=s.towers.filter(x=>x.team===enemy&&x.alive).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 if(s.elapsed>250000&&tower){if(distance(p,tower)<5.5)command(s,p.id,{type:'attack',targetId:tower.id});else command(s,p.id,{type:'move',dx:tower.x-p.x,dy:tower.y-p.y});return}
 if(s.elapsed>360000&&!tower){const dest={x:enemy==='A'?14:s.w-14,y:s.h/2};if(distance(p,dest)<7)command(s,p.id,{type:'seal_attack'});else command(s,p.id,{type:'move',dx:dest.x-p.x,dy:dest.y-p.y});return}
 const node=s.nodes.filter(n=>n.stock>10).sort((a,b)=>distance(a,p)-distance(b,p))[0];if(!node)return;const bag=Object.values(p.bag).reduce((a,b)=>a+b,0);if(bag>=60){const depot={x:p.team==='A'?18:s.w-18,y:s.h/2};command(s,p.id,{type:'move',dx:depot.x-p.x,dy:depot.y-p.y})}else if(distance(p,node)<8)command(s,p.id,{type:'mine',nodeId:node.id});else command(s,p.id,{type:'move',dx:node.x-p.x,dy:node.y-p.y});
}
export function tick(s,commands=[]){if(s.status!=='active')return s;s.tick++;s.elapsed+=STEP_MS;
 // Expiration is authoritative on every fixed tick, not deferred to NPC automation.
 s.loot=s.loot.filter(item=>!Number.isFinite(item.expires)||item.expires>s.elapsed);
 for(const p of Object.values(s.players))if(p.alive){p.mana=Math.min(p.maxMana,p.mana+(3.3+gearOf(p).regen)*STEP_MS/1000);if(p.effects.fieldRegen>s.elapsed)p.hp=Math.min(p.maxHp,p.hp+Math.max(0,p.effects.fieldRegenStrength||0)*STEP_MS/1000);if(s.huntStarted===null){const home=baseSite(s,p.team);if(distance(p,home)<7){p.hp=Math.min(p.maxHp,p.hp+.55);p.mana=Math.min(p.maxMana,p.mana+.5)}}}
s.phase=s.huntStarted!==null?'hunt':s.elapsed<120000?'expansion':s.elapsed<540000?'territory':'siege';
 for(const c of commands){if(c&&typeof c.playerId==='string')command(s,c.playerId,c.action)}
 if(s.tick%4===0)for(const p of Object.values(s.players))if(p.bot)runBot(s,p);
 if(s.tick%5===0){automata(s);processEmpireBuilds(s,log,b=>{s.towers.push({id:'watch-'+b.id,team:b.team,x:b.x,y:b.y,lane:1,level:1,hp:340,maxHp:340,lastDamage:-1e8,lastShot:-1e8,lastRepair:-1e8,structureXp:0,specialization:'range',alive:true})},team=>sealRestored(s,team))}
 if(s.map.hazard!=='none'&&s.elapsed>120000&&s.tick%10===0&&Math.floor(s.elapsed/s.map.hazardInterval)!==Math.floor((s.elapsed-STEP_MS)/s.map.hazardInterval))for(const p of Object.values(s.players)){if(p.alive&&Math.abs(p.x-s.w*.5)<s.w*.055){p.hp=Math.max(0,p.hp-s.map.hazardDamage);log(s,'map_hazard',{actor:p.id,kind:s.map.hazard});if(p.hp===0){p.alive=false;p.deaths++;p.respawnAt=s.elapsed+7500;log(s,'hazard_ko',{actor:p.id,team:p.team,x:p.x,y:p.y})}}}
 if(!s.hardLock&&s.elapsed>=s.hardDeadline){s.hardLock=true;s.seals.A.breached=true;s.seals.B.breached=true;startHunt(s,'hard_deadline');log(s,'both_seals_breached',{reason:'overtime'})}
 if(s.huntStarted!==null){const age=s.elapsed-s.huntStarted;if(age>120000&&s.tick%10===0){const radius=Math.max(10,Math.min(s.w,s.h)/2-(age-120000)/2000);for(const p of Object.values(s.players))if(p.alive&&distance(p,{x:s.w/2,y:s.h/2})>radius){p.hp=Math.max(0,p.hp-12);if(p.hp===0){p.alive=false;p.deaths++;log(s,'storm_defeat',{actor:p.id})}}}
  if(age>240000&&s.tick%10===0)for(const p of Object.values(s.players))if(p.alive){p.hp=Math.max(0,p.hp-20);if(p.hp===0){p.alive=false;p.deaths++}}
 }
 tickStarterKits(s,STEP_MS,log);
 resolve(s);return s}
export function getHud(s){return {mapId:s.mapId,mapName:s.map.name,mapDifficulty:s.map.difficulty,phase:s.phase,time:s.elapsed,winner:s.result?.winner,teamA:s.teams.A.resources,teamB:s.teams.B.resources,sealA:s.seals.A,sealB:s.seals.B,buildings:s.buildings,construction:s.teams.A.rebuildJob,units:s.units.filter(x=>x.alive).length,heroes:Object.values(s.players).map(p=>({id:p.id,hero:p.hero,level:p.matchLevel,hp:p.hp,maxHp:p.maxHp,mana:p.mana,maxMana:p.maxMana,shield:p.shield,gear:Object.keys(p.gear).map(k=>p.gear[k].name),alive:p.alive,mastery:p.itemMastery})),recent:s.events.slice(-8)}};