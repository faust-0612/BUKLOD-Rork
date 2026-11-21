/** Integrates cross-world offline exchange permits into an Arena V2 practice match.
 * The inventory and BP fixtures are not production records and cannot settle PvP.
 * In live play, only the authoritative matchmaking server may call the equivalent.
 */
import {createPractice} from './arena-v2-engine.mjs';
import {commitArenaStrategy,canEquipWorldItem,reserveWorldGear} from './buklod-exchange.mjs';
import {itemDefinition,resolveGear} from './arena-v2-armory.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message)};

export function startLinkedArenaPractice({exchange,participantId,hero,team='A',matchId,permitId=null,preMatchGearId=null,mapId='verdant_fracture',mode='cluster',snapshot=null}={}){
 assert(exchange?.kind==='OFFLINE_EXCHANGE_SIMULATION'&&exchange.accounts[participantId],'sandbox membership required');
 assert(team==='A','this local demo controls team A only');
 assert(typeof matchId==='string'&&matchId.length>4,'unique practice match id required');
 let permit=null;
 if(permitId){permit=exchange.support[permitId];assert(permit&&permit.status==='reserved'&&permit.recipientUserId===participantId&&permit.matchId===matchId&&permit.targetTeam===team,'unauthorized or stale strategy support');}
 // Build and validate game BEFORE committing the unique item. If setup fails, inventory remains reserved.
 const game=createPractice({hero,mode,mapId,snapshot});
 game.linkedPracticeMatchId=matchId;
 if(preMatchGearId){
  const p=game.players.A0,linked=exchange.items[preMatchGearId];
  assert(linked&&canEquipWorldItem(exchange,{userId:participantId,itemId:preMatchGearId,hero,characterLevel:p.developmentLevel}),
   'world gear is not owned, unlocked or exclusive to this hero');
  // Demo policy: only one pre-match item, normalized to Tier 1 even if a rare
  // certificate was bought. Ranked matchmaking must enforce the same budget.
  reserveWorldGear(exchange,{userId:participantId,itemId:preMatchGearId,hero,characterLevel:p.developmentLevel,matchId});
  const slot=linked.slot;const gear=itemDefinition(hero,slot,1);p.gear[slot]=gear;
  const stats=resolveGear(hero,p.gear);p.maxHp+=stats.hp;p.hp+=stats.hp;
  p.maxMana+=stats.mana;p.mana+=stats.mana;
  game.worldGear={kind:'OFFLINE_SANDBOX_ONLY',ownerId:participantId,sourceItemId:preMatchGearId,sourceKey:gear.sourceKey,slot,tier:1};
 }
 if(permit){const committed=commitArenaStrategy(exchange,{requestId:permitId,matchId});
  const t=game.teams[team];game.worldSupport={kind:'OFFLINE_SANDBOX_ONLY',receiptId:committed.requestId,fromScope:committed.scopeId,targetTeam:team,effect:committed.effect,budget:committed.budget};
  if(committed.effect==='construction_queue')t.constructionSupportRemaining=1;
  if(committed.effect==='reveal_once')t.intelOneShot=true;
  if(committed.effect==='dispatch_intel')t.dispatchHint='Resource / army synchronization available';
  game.events.push({seq:++game.eventSeq,time:0,type:'world_support',effect:committed.effect,scopeId:committed.scopeId});
 }
 return game;
}