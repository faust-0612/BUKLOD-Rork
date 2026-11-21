/**
 * BUKLOD V2 connected-world economy CONTRACT SIMULATOR (no persistent money/DB).
 * Implements inventory custody, cross-community BP exchange, nontradable progression,
 * cluster-sponsored support and independent BP participation eligibility.
 * This is NEVER a wallet implementation or a trusted signature/receipt verifier.
 * All events added here are simulated server attestations for offline tests only.
 * Online adapters must source them from authenticated audited ledgers, not a client.
 */
import {HEROES,assetKey,heroRankEligible} from './arena-v2-engine.mjs';
import {EQUIPMENT_SLOTS,itemDefinition} from './arena-v2-armory.mjs';

export const TRADE_KINDS=Object.freeze({
 gear:'trade_gear',strategy:'cluster_strategy',material:'construction_material',
 evolution:'evolution_receipt',cosmetic:'character_cosmetic',field:'arena_field_drop'
});
export const WORLD_SURFACES=Object.freeze([
 'kingdom','empire','character','cluster','organization','house','lot','community_map',
 'wall','connect','learning','bayanihan','market','government_focus'
]);
export const SUPPORTED_STRATEGIES=Object.freeze({
 scout:{hero:'quin',slot:'armor',effect:'reveal_once',budget:1},
 engineering:{hero:'mitch',slot:'jewel',effect:'construction_queue',budget:1},
 supply:{hero:'christian',slot:'boots',effect:'dispatch_intel',budget:1}
});
const OWNER_KINDS=new Set([TRADE_KINDS.gear,TRADE_KINDS.strategy,TRADE_KINDS.material]);
const SOURCES=new Set(WORLD_SURFACES);
const copy=o=>structuredClone(o);
const required=(ok,msg)=>{if(!ok)throw Error(msg)};
const positiveInt=n=>Number.isSafeInteger(n)&&n>0;
const realAmount=n=>Number.isSafeInteger(n)&&n>=0;
const hasOwn=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
const dict=()=>Object.create(null);

/** Sandbox accounts are intentionally explicit fixtures and carry no real identity. */
export function createExchangeSandbox({accounts=[],scopes=[]}={}){
 const a=dict(),s=dict();for(const u of accounts){required(typeof u.id==='string'&&u.id&&!a[u.id],'duplicate/invalid user');required(realAmount(u.bp||0),'invalid initial BP');a[u.id]={id:u.id,bp:u.bp||0,clusterId:u.clusterId||null,activeHero:u.activeHero||'phan',rank:u.rank||1,showFaith:Boolean(u.showFaith)};}
 for(const c of scopes){required(typeof c.id==='string'&&c.id&&!s[c.id],'duplicate/invalid scope');s[c.id]={id:c.id,kind:c.kind||'cluster',managerIds:[...(c.managerIds||[])],treasury:[],projects:dict()};}
 return {kind:'OFFLINE_EXCHANGE_SIMULATION',accounts:a,scopes:s,events:dict(),issuedEvidence:new Set(),items:dict(),itemByEvidence:dict(),offers:dict(),trades:dict(),receiptLog:[],projectUses:dict(),support:dict(),bpProposals:dict(),approvedBpRewards:dict(),nextId:1};
}
export function sandboxEvidence(s,{eventId,actorId,source,qualified=true,hero=null,slot=null,tier=1,purpose='reward'}){
 required(s?.kind==='OFFLINE_EXCHANGE_SIMULATION','no real wallet authority');
 required(typeof eventId==='string'&&eventId.length>3&&!s.events[eventId],'duplicate evidence');
 required(s.accounts[actorId]&&SOURCES.has(source),'invalid event source/actor');
 required(positiveInt(tier)&&tier<=4,'invalid evidence tier');
 s.events[eventId]=Object.freeze({eventId,actorId,source,qualified:qualified===true,hero,slot,tier,purpose});
 return s.events[eventId];
}
export function defineTradeItem(s,{ownerId,evidenceId,hero,slot,tier=1,kind=TRADE_KINDS.gear,scopeId=null,material='wood',quantity=1,strategy='scout'}){
 required(s?.kind==='OFFLINE_EXCHANGE_SIMULATION','sandbox only');
 required(s.accounts[ownerId],'unknown owner');
 const e=s.events[evidenceId];required(e&&e.qualified&&e.actorId===ownerId,'missing or invalid server evidence');
 if(s.itemByEvidence[evidenceId]){const previous=s.items[s.itemByEvidence[evidenceId]];required(previous.kind===kind&&previous.hero===(hero||null)&&previous.slot===(slot||null)&&previous.tier===tier&&previous.scopeId===(kind===TRADE_KINDS.strategy?scopeId:null)&&previous.strategy===(kind===TRADE_KINDS.strategy?strategy:null)&&previous.material===(kind===TRADE_KINDS.material?material:null)&&previous.quantity===(kind===TRADE_KINDS.material?quantity:1),'conflicting item issuance retry');return copy(previous)}
 required(OWNER_KINDS.has(kind),'progression receipts, field drops and cosmetics are NONTRANSFERABLE');
 let name,key,gear=null;
 if(kind===TRADE_KINDS.gear){required(e.source==='kingdom'||e.source==='empire','gear not from authorized source');required(hero&&EQUIPMENT_SLOTS.includes(slot)&&e.hero===hero&&e.slot===slot&&e.tier>=tier,'hero/slot/tier mismatch');gear=itemDefinition(hero,slot,tier);name=gear.name;key=gear.sourceKey;}
 else if(kind===TRADE_KINDS.strategy){required(e.source==='kingdom'||e.source==='cluster','strategy must be earned in Kingdom/Cluster');required(SUPPORTED_STRATEGIES[strategy]&&s.scopes[scopeId],'invalid cluster strategy scope');required(s.accounts[ownerId].clusterId===scopeId&&e.purpose===`strategy:${strategy}`,'strategy evidence/scope mismatch');const definition=itemDefinition(SUPPORTED_STRATEGIES[strategy].hero,SUPPORTED_STRATEGIES[strategy].slot,tier);name=definition.name;key=definition.sourceKey;}
 else {required(['wood','gold','stone'].includes(material)&&positiveInt(quantity)&&quantity<=100&&e.purpose===`material:${material}`,'invalid material or evidence');name=material.toUpperCase();key=`material:${material}`;}
 const id='world-item-'+s.nextId++;
 s.items[id]={id,kind,name,assetKey:key,ownerId,originEvent:evidenceId,origin:e.source,hero:hero||null,slot:slot||null,tier,gear,strategy:kind===TRADE_KINDS.strategy?strategy:null,material:kind===TRADE_KINDS.material?material:null,quantity:kind===TRADE_KINDS.material?quantity:1,scopeId:kind===TRADE_KINDS.strategy?scopeId:null,location:'inventory',tradable:true,used:false};
 s.issuedEvidence.add(evidenceId);s.itemByEvidence[evidenceId]=id;s.receiptLog.push({type:'item_issued',itemId:id,eventId:evidenceId,ownerId});return copy(s.items[id]);
}
export function listWorldItem(s,{sellerId,itemId,priceBp,buyerId=null,requestId}){
 required(typeof requestId==='string'&&requestId.length>3,'listing id required');
 if(hasOwn(s.offers,requestId)){const o=s.offers[requestId];required(o.itemId===itemId&&o.sellerId===sellerId&&o.priceBp===priceBp&&o.buyerId===buyerId,'conflicting retry');return copy(o)}
 const item=s.items[itemId];required(s.accounts[sellerId]&&item&&item.ownerId===sellerId,'not owner');
 required(item.tradable&&item.location==='inventory'&&!item.used,'item locked, spent or bound');
 required(positiveInt(priceBp)&&priceBp<=100000,'invalid BP price');
 const offer={id:requestId,itemId,sellerId,priceBp,buyerId,status:'open'};s.offers[requestId]=offer;item.location='escrow';s.receiptLog.push({type:'escrow_lock',offerId:requestId,itemId});return copy(offer);
}
export function settleWorldTrade(s,{offerId,buyerId,requestId}){
 required(typeof requestId==='string'&&requestId.length>3,'settlement id required');
 if(s.trades[requestId]){const prev=s.trades[requestId];required(prev.offerId===offerId&&prev.buyerId===buyerId,'conflicting settlement retry');return copy(prev)}
 const offer=s.offers[offerId],item=offer&&s.items[offer.itemId];
 required(offer&&offer.status==='open'&&item&&item.location==='escrow'&&item.ownerId===offer.sellerId,'offer not open');
 required(buyerId!==offer.sellerId&&s.accounts[buyerId],'self trade or unknown buyer');
 required(!offer.buyerId||offer.buyerId===buyerId,'private buyer restriction');
 const buyer=s.accounts[buyerId],seller=s.accounts[offer.sellerId];required(buyer.bp>=offer.priceBp&&Number.isSafeInteger(seller.bp+offer.priceBp),'insufficient BP or unsafe amount');
 // One synchronous atomic transition in the offline model. Production must be DB transaction with row locks.
 buyer.bp-=offer.priceBp;seller.bp+=offer.priceBp;item.ownerId=buyerId;item.location='inventory';offer.status='settled';
 const receipt={requestId,offerId,itemId:item.id,buyerId,sellerId:seller.id,priceBp:offer.priceBp,sourceCluster:seller.clusterId,destinationCluster:buyer.clusterId};
 s.trades[requestId]=receipt;s.receiptLog.push({type:'bp_transfer',...receipt});return copy(receipt);
}
export function cancelWorldOffer(s,{offerId,sellerId}){
 const o=s.offers[offerId];required(o&&o.status==='open'&&o.sellerId===sellerId,'not cancellable');
 const item=s.items[o.itemId];required(item&&item.location==='escrow','escrow missing');o.status='cancelled';item.location='inventory';return true;
}
export function canEquipWorldItem(s,{userId,itemId,hero,characterLevel=1}){
 const u=s.accounts[userId],i=s.items[itemId];if(!u||!i||i.location!=='inventory'||i.used||i.ownerId!==userId||i.kind!==TRADE_KINDS.gear)return false;
 if(i.hero!==hero||!HEROES[hero]||!heroRankEligible(hero,u.rank))return false;
 return Number.isInteger(characterLevel)&&characterLevel>=i.gear.sourceLevel;
}
/** Lock a durable marketplace certificate while an Arena match uses it.
 * Production must authenticate the match session; this is a sandbox owner check.
 */
export function reserveWorldGear(s,{userId,itemId,hero,characterLevel,matchId}){
 const i=s.items[itemId];required(typeof matchId==='string'&&matchId.length>4,'match id required');
 if(i?.location==='match_equipped'&&i.currentMatchId===matchId&&i.ownerId===userId)return copy(i);
 required(canEquipWorldItem(s,{userId,itemId,hero,characterLevel}),'not eligible/owned trade gear');
 i.location='match_equipped';i.currentMatchId=matchId;s.receiptLog.push({type:'match_gear_reserved',itemId,userId,matchId});return copy(i);
}
export function releaseWorldGear(s,{userId,itemId,matchId,verifiedEnded=false}){
 const i=s.items[itemId];required(i&&i.ownerId===userId&&i.currentMatchId===matchId,'gear does not belong to this match');
 if(i.location==='inventory')return copy(i);
 required(i.location==='match_equipped'&&verifiedEnded===true,'match not verified concluded');
 i.location='inventory';s.receiptLog.push({type:'match_gear_released',itemId,userId,matchId});return copy(i);
}
export function startCommunityProject(s,{scopeId,projectId,target,kind='cluster_map',requestedBy}){
 const c=s.scopes[scopeId];required(c&&c.managerIds.includes(requestedBy),'scope project management authorization required');
 required(['cluster_map','house','lot'].includes(kind)&&positiveInt(target)&&target<=10000,'invalid project');
 required(typeof projectId==='string'&&projectId.length>3&&!c.projects[projectId],'duplicate project');
 c.projects[projectId]={id:projectId,scopeId,kind,target,progress:0,contributors:dict(),completed:false};return copy(c.projects[projectId]);
}
export function contributeWorldMaterial(s,{itemId,contributorId,scopeId,projectId,requestId}){
 required(typeof requestId==='string'&&requestId.length>=4&&requestId.length<=120,'invalid contribution id');
 if(s.projectUses[requestId]){
  const old=s.projectUses[requestId];
  required(old.itemId===itemId&&old.contributorId===contributorId&&old.projectId===projectId&&old.scopeId===scopeId,'conflicting project retry');
  return copy(old);
 }
 const item=s.items[itemId],project=s.scopes[scopeId]?.projects[projectId];
 required(s.accounts[contributorId]&&item&&item.ownerId===contributorId&&item.kind===TRADE_KINDS.material&&item.location==='inventory'&&!item.used,'not owned transferable materials');
 required(project&&!project.completed,'project closed');
 // Transfer ONLY the useful quantity. The unspent remainder stays in custody
 // and can support another consented project or a later cross-cluster sale.
 const beforeQuantity=item.quantity;
 required(positiveInt(beforeQuantity),'invalid source material quantity');
 const applied=Math.min(beforeQuantity,project.target-project.progress);required(applied>0,'nothing to contribute');
 const remainingQuantity=beforeQuantity-applied;
 item.quantity=remainingQuantity;
 item.used=remainingQuantity===0;
 item.location=item.used?'consumed':'inventory';
 project.progress+=applied;project.completed=project.progress>=project.target;
 project.contributors[contributorId]=(project.contributors[contributorId]||0)+applied;
 const receipt={requestId,itemId,contributorId,projectId,scopeId,applied,beforeQuantity,remainingQuantity,progress:project.progress,completed:project.completed};
 s.projectUses[requestId]=receipt;s.receiptLog.push({type:'project_contribution',...receipt});
 return copy(receipt);
}
export function registerClusterStrategy(s,{itemId,ownerId,scopeId,authorizedBy,requestId}){
 required(typeof requestId==='string'&&requestId.length>3,'approval id required');
 const exists=s.receiptLog.find(x=>x.type==='strategy_treasury'&&x.requestId===requestId);if(exists){required(exists.itemId===itemId&&exists.scopeId===scopeId,'conflicting registration');return copy(exists)}
 const i=s.items[itemId],c=s.scopes[scopeId];required(s.accounts[ownerId]&&c&&c.managerIds.includes(authorizedBy),'cluster approval required');
 required(i&&i.kind===TRADE_KINDS.strategy&&i.ownerId===ownerId&&i.location==='inventory'&&!i.used,'invalid strategy item');
 required(s.accounts[ownerId].clusterId===scopeId,'recipient must join receiving scope');
 i.originScopeId=i.originScopeId||i.scopeId;i.scopeId=scopeId;i.location='cluster_treasury';i.ownerId=scopeId;c.treasury.push(itemId);
 const receipt={type:'strategy_treasury',requestId,itemId,scopeId};s.receiptLog.push(receipt);return copy(receipt);
}
export function allocateArenaStrategy(s,{scopeId,itemId,authorizedBy,matchId,targetTeam,recipientUserId,requestId}){
 if(s.support[requestId]){const p=s.support[requestId];required(p.itemId===itemId&&p.matchId===matchId&&p.targetTeam===targetTeam&&p.recipientUserId===recipientUserId,'conflicting support retry');return copy(p)}
 const c=s.scopes[scopeId],item=s.items[itemId];required(c&&c.managerIds.includes(authorizedBy),'cluster strategy management required');
 required(item&&item.kind===TRADE_KINDS.strategy&&item.ownerId===scopeId&&item.location==='cluster_treasury'&&!item.used,'strategy unavailable');
 required(s.accounts[recipientUserId]&&['A','B'].includes(targetTeam)&&typeof matchId==='string'&&matchId.length>4,'invalid Arena target');
 required(Object.values(s.support).filter(x=>x.matchId===matchId&&x.targetTeam===targetTeam&&x.status!=='cancelled').length<1,'one approved support effect per team');
 // Reservation is refundable if the match is cancelled; only commit spends the item.
 item.location='match_reserved';
 const permit={requestId,itemId,scopeId,matchId,targetTeam,recipientUserId,effect:SUPPORTED_STRATEGIES[item.strategy].effect,startingCombatPower:0,budget:1,kind:'OFFLINE_SUPPORT_PERMIT',status:'reserved'};
 s.support[requestId]=permit;s.receiptLog.push({type:'team_strategy_reservation',...permit});return copy(permit);
}
export function commitArenaStrategy(s,{requestId,matchId}){
 const permit=s.support[requestId];required(permit&&permit.matchId===matchId,'wrong match support');
 if(permit.status==='committed')return copy(permit);
 required(permit.status==='reserved','support not reserved');
 const item=s.items[permit.itemId];required(item&&item.location==='match_reserved'&&!item.used,'support item unavailable');
 item.used=true;item.location='consumed';const scope=s.scopes[permit.scopeId];scope.treasury=scope.treasury.filter(id=>id!==item.id);
 permit.status='committed';s.receiptLog.push({type:'team_strategy_committed',requestId,matchId});return copy(permit);
}
export function cancelArenaStrategy(s,{requestId,authorizedBy}){
 const permit=s.support[requestId];required(permit&&permit.status==='reserved','support not cancellable');
 const scope=s.scopes[permit.scopeId];required(scope&&scope.managerIds.includes(authorizedBy),'not scope manager');
 s.items[permit.itemId].location='cluster_treasury';permit.status='cancelled';s.receiptLog.push({type:'team_strategy_cancelled',requestId});return copy(permit);
}
/** Arena BP requires **independent existing verified reward service**.
 * Produces eligibility only; NEVER credits a BP balance and NEVER creates QMP.
 * This must be authorized by the official BP ledger after match attestation.
 */
export function proposeArenaBp(s,{matchId,userId,dayKey,verified=false,ranked=false,botMatch=false,durationMs=0,meaningfulActions=0,opponentGroup='',result='loss'}){
 required(s.accounts[userId],'unknown account');
 required(typeof matchId==='string'&&matchId.length>4&&typeof dayKey==='string'&&dayKey.length===10,'invalid match/date');
 const key=userId+':'+matchId;
 if(s.bpProposals[key])return copy(s.bpProposals[key]);
 const perDay=Object.values(s.bpProposals).filter(p=>p.userId===userId&&p.dayKey===dayKey&&p.eligible).length;
 const opponents=Object.values(s.bpProposals).filter(p=>p.userId===userId&&p.dayKey===dayKey&&p.opponentGroup===opponentGroup&&p.eligible).length;
 const eligible=verified===true&&ranked===true&&botMatch===false&&durationMs>=300000&&meaningfulActions>=8&&['win','loss','draw'].includes(result)&&perDay<3&&opponents<2&&typeof opponentGroup==='string'&&opponentGroup.length>4;
 const proposedBp=eligible?Math.min(8,4+(result==='win'?2:0)+(meaningfulActions>=18?2:0)):0;
 const entry={key,matchId,userId,dayKey,opponentGroup,eligible,proposedBp,source:'arena_verified_participation',status:'requires_existing_BP_reward_authority'};
 s.bpProposals[key]=entry;return copy(entry);
}
export function sumSandboxBp(s){return Object.values(s.accounts).reduce((a,u)=>a+u.bp,0)}

/** One-off sandbox receipt: real authority must be existing audited BP participation service.
 * Explicitly separate new BP reward issuance from zero-mint peer-to-peer trade.
 */
export function simulateApprovedArenaBp(s,{proposalKey,approvalId}){
 required(s?.kind==='OFFLINE_EXCHANGE_SIMULATION','only offline sandbox');
 required(typeof approvalId==='string'&&approvalId.length>4,'approval id required');
 if(s.approvedBpRewards[approvalId]){const r=s.approvedBpRewards[approvalId];required(r.proposalKey===proposalKey,'conflicting approval retry');return copy(r)}
 const entry=s.bpProposals[proposalKey];required(entry&&entry.eligible,'not eligible for independent approval');
 required(!Object.values(s.approvedBpRewards).some(r=>r.proposalKey===proposalKey),'already awarded');
 required(entry.status==='requires_existing_BP_reward_authority','approval status invalid');
 const account=s.accounts[entry.userId];required(Number.isSafeInteger(account.bp+entry.proposedBp),'overflow');
 account.bp+=entry.proposedBp;entry.status='simulated_approved_by_BP_authority';
 const r={approvalId,proposalKey,kind:'SIMULATED_AUTHORITY_ISSUANCE',userId:entry.userId,bp:entry.proposedBp};s.approvedBpRewards[approvalId]=r;s.receiptLog.push(r);return copy(r);
}

/** Portable progress/navigation view model. No private medical/student content is ever used.
 * The production UI can show optional related goals without forcing cross-app visits.
 */
export function worldJourneySummary(s,userId){
 const a=s.accounts[userId];required(a,'unknown participant');
 const owned=Object.values(s.items).filter(i=>i.ownerId===userId&&!i.used&&i.location==='inventory');
 const listed=Object.values(s.offers).filter(o=>o.sellerId===userId&&o.status==='open');
 const purchases=Object.values(s.trades).filter(t=>t.buyerId===userId);
 const sales=Object.values(s.trades).filter(t=>t.sellerId===userId);
 const projects=Object.values(s.scopes).flatMap(c=>Object.values(c.projects)).filter(p=>(p.contributors[userId]||0)>0);
 const proposals=Object.values(s.bpProposals).filter(p=>p.userId===userId&&p.eligible);
 return Object.freeze({
  userId,showFaith:a.showFaith,bp:a.bp,clusterId:a.clusterId,
  availableItems:owned.length,listedItems:listed.length,boughtItems:purchases.length,
  tradeBpReceived:sales.reduce((v,t)=>v+t.priceBp,0),
  eligibleArenaBpPending:proposals.filter(p=>p.status==='requires_existing_BP_reward_authority').reduce((v,p)=>v+p.proposedBp,0),
  projectProgress:projects.map(p=>({projectId:p.id,kind:p.kind,contribution:p.contributors[userId],completed:p.completed})),
  paths:[
   {from:'kingdom',to:'market',reason:'verified transferable loot can be listed for existing BP'},
   {from:'market',to:'empire',reason:'character-exclusive equipment and consented team strategy aid'},
   {from:'kingdom',to:'house',reason:'verified construction resources may support visible personal development'},
   {from:'wall',to:'character',reason:'meaningful verified public participation progresses independent Character items'},
   {from:'cluster',to:'community_map',reason:'consented contributions build communal project stages'},
   {from:'empire',to:'character',reason:'independently verified activity may qualify for audited BP and future items'},
   {from:'market',to:'cluster',reason:'other communities may trade and contribute regardless of membership'}
  ]
 });
}