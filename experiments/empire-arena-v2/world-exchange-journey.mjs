/**
 * BUKLOD World Journey V2 — deterministic, disposable OFFLINE demonstration.
 * Reuses Arena V2 domain simulation. No user auth, RPC, ledger, QMP or persistence.
 * Sandbox evidence here is synthetic and must NEVER back any real reward or item.
 */
import {
  createExchangeSandbox,sandboxEvidence,defineTradeItem,listWorldItem,
  settleWorldTrade,canEquipWorldItem,startCommunityProject,
  contributeWorldMaterial,registerClusterStrategy,allocateArenaStrategy,
  sumSandboxBp,worldJourneySummary,TRADE_KINDS,SUPPORTED_STRATEGIES
} from './buklod-exchange.mjs';
import {startLinkedArenaPractice} from './arena-v2-world-bridge.mjs';
import {catalogueFor,itemDefinition,EQUIPMENT_SLOTS} from './arena-v2-armory.mjs';
import {HEROES,assetKey} from './arena-v2-engine.mjs';
import {ARENA_MAPS} from './arena-v2-maps.mjs';

export const DEMO_IDS=Object.freeze({kingdom:'kingdom-helper',arena:'arena-player',north:'north',south:'south',house:'arena-house'});
export const DEMO_START_BP=Object.freeze({kingdom:35,arena:250});
export const DEMO_PROJECTS=Object.freeze({cluster:{scopeId:'south',projectId:'cluster-stage-02',kind:'cluster_map',target:25},house:{scopeId:'arena-house',projectId:'house-stage-02',kind:'house',target:20}});
const fail=(ok,message)=>{if(!ok)throw Error(message)};
const integer=n=>Number.isSafeInteger(n)&&n>0;
const copy=x=>structuredClone(x);

export function createOfflineJourney(){
 const w=createExchangeSandbox({accounts:[
   {id:DEMO_IDS.kingdom,bp:DEMO_START_BP.kingdom,clusterId:DEMO_IDS.north,rank:20,showFaith:false},
   {id:DEMO_IDS.arena,bp:DEMO_START_BP.arena,clusterId:DEMO_IDS.south,rank:20,showFaith:false}
  ],scopes:[
   {id:DEMO_IDS.north,managerIds:[DEMO_IDS.kingdom],kind:'cluster'},
   {id:DEMO_IDS.south,managerIds:[DEMO_IDS.arena],kind:'cluster'},
   {id:DEMO_IDS.house,managerIds:[DEMO_IDS.arena],kind:'personal'}
  ]});
 for(const p of Object.values(DEMO_PROJECTS))startCommunityProject(w,{...p,requestedBy:DEMO_IDS.arena});
 const state={world:w,sequence:1,initialTotalBp:sumSandboxBp(w),lastMatch:null,lastMatchId:null};
 const next=(prefix)=>`offline-${prefix}-${state.sequence++}`;
 function gearCatalog(hero){fail(HEROES[hero],'Unknown canonical hero');return catalogueFor(hero).map(x=>({hero:x.hero,slot:x.slot,name:x.name,sourceKey:x.sourceKey,level:x.sourceLevel,stats:copy(x.stats)}))}
 function simulateKingdomGear({hero,slot,tier=1}={}){
  fail(HEROES[hero]&&EQUIPMENT_SLOTS.includes(slot),'Unknown hero or equipment slot');
  const evidenceId=next('kingdom-item');
  sandboxEvidence(w,{eventId:evidenceId,actorId:DEMO_IDS.kingdom,source:'kingdom',hero,slot,tier});
  return defineTradeItem(w,{ownerId:DEMO_IDS.kingdom,evidenceId,hero,slot,tier});
 }
 function listItem({itemId,sellerId=DEMO_IDS.kingdom,priceBp}={}){
  fail(integer(priceBp)&&priceBp<=100000,'Invalid item BP price');
  return listWorldItem(w,{sellerId,itemId,priceBp,requestId:next('offer')});
 }
 function buyItem({offerId,buyerId=DEMO_IDS.arena,requestId}={}){
  return settleWorldTrade(w,{offerId,buyerId,requestId:requestId||next('purchase')});
 }
 function eligibleGear({itemId,hero,characterLevel=20}={}){
  return canEquipWorldItem(w,{userId:DEMO_IDS.arena,itemId,hero,characterLevel});
 }
 function simulateKingdomMaterial({material='wood',quantity=30}={}){
  fail(['wood','gold','stone'].includes(material)&&integer(quantity)&&quantity<=100,'Invalid simulated material');
  const evidenceId=next('kingdom-material');
  sandboxEvidence(w,{eventId:evidenceId,actorId:DEMO_IDS.kingdom,source:'kingdom',purpose:`material:${material}`});
  return defineTradeItem(w,{ownerId:DEMO_IDS.kingdom,evidenceId,kind:TRADE_KINDS.material,material,quantity});
 }
 function donateMaterials({itemId,project='cluster'}={}){
  const p=DEMO_PROJECTS[project];fail(p,'Unknown project');
  return contributeWorldMaterial(w,{itemId,contributorId:DEMO_IDS.kingdom,scopeId:p.scopeId,projectId:p.projectId,requestId:next('donation')});
 }
 function simulateKingdomStrategy({strategy='scout',matchId}={}){
  fail(SUPPORTED_STRATEGIES[strategy]&&typeof matchId==='string'&&matchId.length>4,'Invalid strategy / match');
  const evidenceId=next('kingdom-strategy');
  sandboxEvidence(w,{eventId:evidenceId,actorId:DEMO_IDS.kingdom,source:'kingdom',purpose:`strategy:${strategy}`});
  const item=defineTradeItem(w,{ownerId:DEMO_IDS.kingdom,evidenceId,kind:TRADE_KINDS.strategy,scopeId:DEMO_IDS.north,strategy});
  registerClusterStrategy(w,{itemId:item.id,ownerId:DEMO_IDS.kingdom,scopeId:DEMO_IDS.north,authorizedBy:DEMO_IDS.kingdom,requestId:next('treasury')});
  return allocateArenaStrategy(w,{scopeId:DEMO_IDS.north,itemId:item.id,authorizedBy:DEMO_IDS.kingdom,matchId,targetTeam:'A',recipientUserId:DEMO_IDS.arena,requestId:next('permit')});
 }
 function prepareMatchId(){return next('arena-match')}
 function startPractice({matchId,hero='phan',mapId='verdant_fracture',mode='cluster',characterLevel=20,gearItemId=null,permitId=null}={}){
  fail(typeof matchId==='string'&&matchId.length>4,'Match id required');
  if(state.lastMatchId===matchId){fail(state.lastMatch,'Match already reserved');return state.lastMatch;}
  fail(HEROES[hero]&&ARENA_MAPS[mapId],'Unknown hero / Arena map');
  fail(integer(characterLevel)&&characterLevel<=20,'Invalid simulated character level');
  if(gearItemId)fail(eligibleGear({itemId:gearItemId,hero,characterLevel}),'Item is not eligible for this character and level');
  const verifiedItems=[];
  for(let l=1;l<=characterLevel;l++)for(let i=1;i<=5;i++)verifiedItems.push(assetKey(hero,l,i));
  const snapshot={characterLevel,bpEligibleLevel:characterLevel,itemVerifiedLevel:characterLevel,diamonds:4000,verifiedItems};
  const game=startLinkedArenaPractice({exchange:w,participantId:DEMO_IDS.arena,hero,matchId,permitId,preMatchGearId:gearItemId,mapId,mode,snapshot});
  state.lastMatch=game;state.lastMatchId=matchId;
  return game;
 }
 function summary(){
  const projects=Object.fromEntries(Object.entries(DEMO_PROJECTS).map(([key,p])=>[key,copy(w.scopes[p.scopeId].projects[p.projectId])]));
  const snapshot={
   bp:{kingdom:w.accounts[DEMO_IDS.kingdom].bp,arena:w.accounts[DEMO_IDS.arena].bp,total:sumSandboxBp(w),initial:state.initialTotalBp},
   scopeIds:{kingdom:DEMO_IDS.north,arena:DEMO_IDS.south},
   showFaithOffAllowed:!w.accounts[DEMO_IDS.kingdom].showFaith&&!w.accounts[DEMO_IDS.arena].showFaith,
   items:copy(Object.values(w.items).map(x=>({id:x.id,ownerId:x.ownerId,name:x.name,assetKey:x.assetKey,kind:x.kind,hero:x.hero,slot:x.slot,quantity:x.quantity,used:x.used,location:x.location,strategy:x.strategy}))),
   offers:copy(Object.values(w.offers)),trades:copy(Object.values(w.trades)),projects,
   strategyPermits:copy(Object.values(w.support)),
   match:state.lastMatch?{id:state.lastMatchId,mapId:state.lastMatch.mapId,hero:state.lastMatch.players.A0?.hero,worldGear:copy(state.lastMatch.worldGear??null),worldSupport:copy(state.lastMatch.worldSupport??null)}:null,
   pathway:worldJourneySummary(w,DEMO_IDS.arena).paths
  };
  return Object.freeze(snapshot);
 }
 return Object.freeze({gearCatalog,simulateKingdomGear,listItem,buyItem,eligibleGear,simulateKingdomMaterial,donateMaterials,simulateKingdomStrategy,prepareMatchId,startPractice,summary,
    heroIds:Object.freeze(Object.keys(HEROES)),maps:Object.freeze(Object.keys(ARENA_MAPS)),slots:EQUIPMENT_SLOTS});
}