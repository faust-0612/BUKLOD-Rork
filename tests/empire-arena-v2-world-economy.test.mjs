import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createExchangeSandbox,sandboxEvidence,defineTradeItem,listWorldItem,settleWorldTrade,
 cancelWorldOffer,canEquipWorldItem,startCommunityProject,contributeWorldMaterial,
 registerClusterStrategy,allocateArenaStrategy,commitArenaStrategy,cancelArenaStrategy,
 proposeArenaBp,simulateApprovedArenaBp,sumSandboxBp,TRADE_KINDS,WORLD_SURFACES
} from '../experiments/empire-arena-v2/buklod-exchange.mjs';
import {startLinkedArenaPractice} from '../experiments/empire-arena-v2/arena-v2-world-bridge.mjs';
import {command,tick} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {BUILD_COSTS} from '../experiments/empire-arena-v2/arena-v2-empire.mjs';

function world(){return createExchangeSandbox({accounts:[
 {id:'anna',bp:100,clusterId:'north',activeHero:'quin',rank:2,showFaith:true},
 {id:'ben',bp:500,clusterId:'south',activeHero:'phan',rank:6,showFaith:false},
 {id:'cara',bp:100,clusterId:'east',activeHero:'mitch',rank:9,showFaith:false},
 {id:'leaderN',bp:0,clusterId:'north',rank:4},
 {id:'leaderS',bp:0,clusterId:'south',rank:8}
 ],scopes:[
 {id:'north',managerIds:['leaderN'],kind:'cluster'},
 {id:'south',managerIds:['leaderS'],kind:'cluster'},
 {id:'east',managerIds:['cara'],kind:'cluster'},
 {id:'ben-house',managerIds:['ben'],kind:'personal'}]})}
const proof=(w,eventId,actorId,more={})=>sandboxEvidence(w,{eventId,actorId,source:'kingdom',...more});
const gear=(w,owner,hero,slot,id='evidence-gear',tier=1)=>{proof(w,id,owner,{hero,slot,tier});return defineTradeItem(w,{ownerId:owner,evidenceId:id,hero,slot,tier})};
const material=(w,owner,resource,id,quantity=20)=>{proof(w,id,owner,{purpose:`material:${resource}`});return defineTradeItem(w,{ownerId:owner,evidenceId:id,kind:TRADE_KINDS.material,material:resource,quantity})};
const strategy=(w,owner,scopeId,strategy,id)=>{proof(w,id,owner,{purpose:`strategy:${strategy}`});return defineTradeItem(w,{ownerId:owner,evidenceId:id,kind:TRADE_KINDS.strategy,scopeId,strategy})};

test('one connected catalog can serve Kingdom, Arena, Character, Wall, Cluster, House, Lot, and non-faith routes',()=>{
 for(const x of ['kingdom','empire','character','cluster','organization','house','lot','community_map','wall','connect','learning','bayanihan','market','government_focus'])assert.ok(WORLD_SURFACES.includes(x));
 const w=world();assert.equal(w.accounts.anna.showFaith,true);assert.equal(w.accounts.ben.showFaith,false);
 const i=gear(w,'anna','quin','armor','kingdom-compass-1');assert.equal(i.name,'Explorer Hiking Compass');assert.equal(i.assetKey,'quin:L07:I03');
 assert.equal(i.tradable,true);assert.equal(i.origin,'kingdom');assert.equal(i.kind,TRADE_KINDS.gear);
});

test('nonplaying Kingdom member sells real catalog item to Arena member from other cluster and BP is conserved',()=>{
 const w=world(),i=gear(w,'anna','quin','armor','kingdom-gear-1');const before=sumSandboxBp(w);
 const offer=listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:65,requestId:'listing-001'});
 assert.equal(offer.status,'open');assert.equal(w.items[i.id].location,'escrow');
 const sale=settleWorldTrade(w,{offerId:offer.id,buyerId:'ben',requestId:'settle-001'});
 assert.equal(sale.sourceCluster,'north');assert.equal(sale.destinationCluster,'south');
 assert.equal(w.accounts.anna.bp,165);assert.equal(w.accounts.ben.bp,435);
 assert.equal(w.items[i.id].ownerId,'ben');assert.equal(sumSandboxBp(w),before);
 assert.equal(canEquipWorldItem(w,{userId:'ben',itemId:i.id,hero:'phan',characterLevel:20}),false,'gear remains character-exclusive even after sale');
 assert.equal(canEquipWorldItem(w,{userId:'ben',itemId:i.id,hero:'quin',characterLevel:7}),true);
 assert.equal(canEquipWorldItem(w,{userId:'ben',itemId:i.id,hero:'quin',characterLevel:6}),false);
 assert.equal(settleWorldTrade(w,{offerId:offer.id,buyerId:'ben',requestId:'settle-001'}).requestId,'settle-001','idempotent response');
 assert.equal(sumSandboxBp(w),before,'retry must not double-pay seller');
});

test('escrow locks ownership, rejects simultaneous sale, underfunded buyer, self-purchase, and unauthorized cancellation',()=>{
 const w=world(),i=gear(w,'anna','quin','armor','kingdom-gear-2');listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:400,requestId:'listing-002'});
 assert.throws(()=>listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:200,requestId:'listing-003'}),/locked/);
 assert.throws(()=>settleWorldTrade(w,{offerId:'listing-002',buyerId:'anna',requestId:'settle-self'}),/self/);
 assert.throws(()=>settleWorldTrade(w,{offerId:'listing-002',buyerId:'cara',requestId:'settle-poor'}),/insufficient/);
 assert.throws(()=>cancelWorldOffer(w,{offerId:'listing-002',sellerId:'ben'}),/not cancellable/);
 assert.equal(w.accounts.anna.bp,100);assert.equal(w.accounts.ben.bp,500);
 cancelWorldOffer(w,{offerId:'listing-002',sellerId:'anna'});assert.equal(w.items[i.id].location,'inventory');
 assert.throws(()=>settleWorldTrade(w,{offerId:'listing-002',buyerId:'ben',requestId:'settle-after-cancel'}),/not open/);
});

test('replay/collusion guard: list retry idempotent; same ID with different price rejected; item cannot be issued twice',()=>{
 const w=world(),i=gear(w,'anna','quin','armor','kingdom-gear-3');assert.deepEqual(defineTradeItem(w,{ownerId:'anna',evidenceId:'kingdom-gear-3',hero:'quin',slot:'armor'}),i);
 const one=listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:35,requestId:'listing-004'});
 assert.deepEqual(listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:35,requestId:'listing-004'}),one);
 assert.throws(()=>listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:36,requestId:'listing-004'}),/conflicting/);
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'kingdom-gear-3',hero:'quin',slot:'boots'}),/conflicting/);
});

test('mandatory evolution, cosmetics and match-only drops can never enter transferable inventory',()=>{
 const w=world();for(const kind of [TRADE_KINDS.evolution,TRADE_KINDS.cosmetic,TRADE_KINDS.field]){
  proof(w,'proof-'+kind,'anna');assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'proof-'+kind,kind}),/NONTRANSFERABLE/);
 }
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'not-real',hero:'quin',slot:'armor'}),/missing/);
 proof(w,'disqualified','anna',{qualified:false,hero:'quin',slot:'armor'});
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'disqualified',hero:'quin',slot:'armor'}),/invalid/);
});

test('evidence binds recipient, source, tier and exact source character/slot; no fabricated tier-4 legendary',()=>{
 const w=world();proof(w,'badsource','anna',{source:'wall',hero:'quin',slot:'armor'});
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'badsource',hero:'quin',slot:'armor'}),/authorized source/);
 proof(w,'tier1','anna',{hero:'quin',slot:'armor',tier:1});
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'tier1',hero:'quin',slot:'armor',tier:4}),/mismatch/);
 assert.throws(()=>defineTradeItem(w,{ownerId:'ben',evidenceId:'tier1',hero:'quin',slot:'armor'}),/invalid/);
});

test('non-playing supporters can donate materials across clusters to house, lot and community-map developments',()=>{
 const w=world();startCommunityProject(w,{scopeId:'south',projectId:'cluster-world-map',target:25,kind:'cluster_map',requestedBy:'leaderS'});
 startCommunityProject(w,{scopeId:'ben-house',projectId:'ben-house-build',target:50,kind:'house',requestedBy:'ben'});
 const a=material(w,'anna','wood','wood-proof-1',20),b=material(w,'cara','stone','stone-proof-1',20);
 const r=contributeWorldMaterial(w,{itemId:a.id,contributorId:'anna',scopeId:'south',projectId:'cluster-world-map',requestId:'contri-1'});
 assert.equal(r.applied,20);assert.equal(r.completed,false);assert.equal(w.items[a.id].location,'consumed');
 const r2=contributeWorldMaterial(w,{itemId:b.id,contributorId:'cara',scopeId:'south',projectId:'cluster-world-map',requestId:'contri-2'});
 assert.equal(r2.applied,5);assert.equal(r2.completed,true);assert.equal(w.scopes.south.projects['cluster-world-map'].progress,25);
 assert.equal(contributeWorldMaterial(w,{itemId:a.id,contributorId:'anna',scopeId:'south',projectId:'cluster-world-map',requestId:'contri-1'}).applied,20);
 assert.throws(()=>contributeWorldMaterial(w,{itemId:a.id,contributorId:'anna',scopeId:'ben-house',projectId:'ben-house-build',requestId:'contri-3'}),/not owned/);
 assert.equal(sumSandboxBp(w),700,'house/cluster construction cannot mint BP');
});

test('scope strategy item retains authentic BUKLOD catalog identity, may transfer cross-cluster, and requires owner+manager approval',()=>{
 const w=world(),i=strategy(w,'anna','north','engineering','strategy-source-mitch');
 assert.equal(i.name,'Legacy Art Mentor Master Brush Chest Tools');
 const offer=listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:50,requestId:'strategy-listing'});
 settleWorldTrade(w,{offerId:offer.id,buyerId:'ben',requestId:'strategy-settlement'});
 assert.throws(()=>registerClusterStrategy(w,{itemId:i.id,ownerId:'ben',scopeId:'south',authorizedBy:'leaderN',requestId:'approval-wrong'}),/approval/);
 const reg=registerClusterStrategy(w,{itemId:i.id,ownerId:'ben',scopeId:'south',authorizedBy:'leaderS',requestId:'approval-001'});
 assert.equal(reg.scopeId,'south');assert.equal(w.items[i.id].originScopeId,'north');
 assert.equal(w.items[i.id].location,'cluster_treasury');
 assert.deepEqual(registerClusterStrategy(w,{itemId:i.id,ownerId:'ben',scopeId:'south',authorizedBy:'leaderS',requestId:'approval-001'}),reg);
});

test('support reservation cancellation refunds exact item and permits only one aid per team/match',()=>{
 const w=world();const i=strategy(w,'anna','north','scout','strategy-scout-1');
 registerClusterStrategy(w,{itemId:i.id,ownerId:'anna',scopeId:'north',authorizedBy:'leaderN',requestId:'approve-scout-1'});
 const first=allocateArenaStrategy(w,{scopeId:'north',itemId:i.id,authorizedBy:'leaderN',matchId:'match-100',targetTeam:'A',recipientUserId:'ben',requestId:'reserve-scout-1'});
 assert.equal(first.status,'reserved');assert.equal(w.items[i.id].location,'match_reserved');
 assert.throws(()=>allocateArenaStrategy(w,{scopeId:'north',itemId:i.id,authorizedBy:'leaderN',matchId:'match-101',targetTeam:'A',recipientUserId:'ben',requestId:'reserve-scout-2'}),/unavailable/);
 assert.throws(()=>cancelArenaStrategy(w,{requestId:'reserve-scout-1',authorizedBy:'leaderS'}),/not scope manager/);
 cancelArenaStrategy(w,{requestId:'reserve-scout-1',authorizedBy:'leaderN'});
 assert.equal(w.items[i.id].location,'cluster_treasury');
 const again=allocateArenaStrategy(w,{scopeId:'north',itemId:i.id,authorizedBy:'leaderN',matchId:'match-102',targetTeam:'A',recipientUserId:'ben',requestId:'reserve-scout-3'});
 assert.equal(again.status,'reserved');assert.throws(()=>commitArenaStrategy(w,{requestId:'reserve-scout-3',matchId:'incorrect'}),/wrong match/);
 assert.equal(w.items[i.id].used,false);const committed=commitArenaStrategy(w,{requestId:'reserve-scout-3',matchId:'match-102'});
 assert.equal(committed.status,'committed');assert.equal(w.items[i.id].used,true);
 assert.equal(commitArenaStrategy(w,{requestId:'reserve-scout-3',matchId:'match-102'}).status,'committed');
 assert.throws(()=>cancelArenaStrategy(w,{requestId:'reserve-scout-3',authorizedBy:'leaderN'}),/not cancellable/);
});

test('cross-cluster support reaches actual Arena simulation and cannot secretly increase starting damage',()=>{
 const w=world();const i=strategy(w,'anna','north','engineering','strategy-world-1');
 registerClusterStrategy(w,{itemId:i.id,ownerId:'anna',scopeId:'north',authorizedBy:'leaderN',requestId:'approve-match-1'});
 const permit=allocateArenaStrategy(w,{scopeId:'north',itemId:i.id,authorizedBy:'leaderN',matchId:'match-to-begin',targetTeam:'A',recipientUserId:'ben',requestId:'reserve-match-1'});
 assert.throws(()=>startLinkedArenaPractice({exchange:w,participantId:'cara',hero:'phan',matchId:'match-to-begin',permitId:permit.requestId}),/unauthorized/);
 assert.equal(w.items[i.id].used,false);
 assert.throws(()=>startLinkedArenaPractice({exchange:w,participantId:'ben',hero:'no_hero',matchId:'match-to-begin',permitId:permit.requestId}),/Invalid Arena/);
 assert.equal(w.items[i.id].used,false,'invalid match setup may not consume the scope item');
 const game=startLinkedArenaPractice({exchange:w,participantId:'ben',hero:'phan',matchId:'match-to-begin',permitId:permit.requestId,mode:'duel'});
 assert.equal(game.kind,'OFFLINE_PRACTICE');assert.equal(game.worldSupport.fromScope,'north');assert.equal(game.worldSupport.startingCombatPower,undefined);
 assert.equal(game.teams.A.constructionSupportRemaining,1);assert.equal(w.items[i.id].used,true);
 const p=game.players.A0;p.x=36;p.y=game.h*.5+13;game.teams.A.resources={wood:1000,gold:1000,stone:1000};
 assert.equal(command(game,'A0',{type:'build',kind:'workshop',x:p.x,y:p.y}),true);
 const built=game.buildings.find(x=>x.kind==='workshop');assert.equal(built.duration,Math.ceil(BUILD_COSTS.workshop.time*.92));
 assert.equal(game.teams.A.constructionSupportRemaining,0);
 p.x=45;p.y=game.h*.5+13;
 assert.equal(command(game,'A0',{type:'build',kind:'watchtower',x:p.x,y:p.y}),true);
 assert.equal(game.buildings.find(x=>x.kind==='watchtower').duration,BUILD_COSTS.watchtower.time);
 assert.equal(sumSandboxBp(w),700,'battlefield consumes item but does not create BP');
});

test('rank gating remains canonical even for market-bought gear; Show Faith OFF can trade',()=>{
 const w=world(),i=gear(w,'anna','ace','weapon','ace-gear-1');listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:50,requestId:'ace-list-01'});
 settleWorldTrade(w,{offerId:'ace-list-01',buyerId:'ben',requestId:'ace-settle-01'});
 assert.equal(w.accounts.ben.showFaith,false);
 assert.equal(canEquipWorldItem(w,{userId:'ben',itemId:i.id,hero:'ace',characterLevel:20}),true);
 w.accounts.ben.rank=4;assert.equal(canEquipWorldItem(w,{userId:'ben',itemId:i.id,hero:'ace',characterLevel:20}),false);
 assert.equal(w.items[i.id].ownerId,'ben','item remains saved even if rank falls');
});

test('Arena participation earns BP only after independent approved reward authority, not by trade or offline replay',()=>{
 const w=world(),before=sumSandboxBp(w);
 let proposal=proposeArenaBp(w,{matchId:'ranked-match-01',userId:'ben',dayKey:'2026-11-21',verified:true,ranked:true,botMatch:false,durationMs:420000,meaningfulActions:19,opponentGroup:'other-players-111',result:'win'});
 assert.equal(proposal.eligible,true);assert.equal(proposal.proposedBp,8);assert.equal(sumSandboxBp(w),before,'mere result cannot mint BP');
 assert.equal(proposeArenaBp(w,{matchId:'ranked-match-01',userId:'ben',dayKey:'2026-11-21',verified:true,ranked:true,botMatch:false,durationMs:999999,meaningfulActions:999,opponentGroup:'other-players-111',result:'win'}).proposedBp,8);
 assert.equal(simulateApprovedArenaBp(w,{proposalKey:proposal.key,approvalId:'signed-reward-1'}).bp,8);
 assert.equal(w.accounts.ben.bp,508);assert.equal(sumSandboxBp(w),before+8,'only approved separate reward issuance can add BP');
 assert.equal(simulateApprovedArenaBp(w,{proposalKey:proposal.key,approvalId:'signed-reward-1'}).bp,8);
 assert.throws(()=>simulateApprovedArenaBp(w,{proposalKey:proposal.key,approvalId:'signed-reward-2'}),/already awarded/);
 for(const [id,params] of [
  ['offline-1',{verified:true,ranked:false,botMatch:false}],
  ['bot-1',{verified:true,ranked:true,botMatch:true}],
  ['fake-1',{verified:false,ranked:true,botMatch:false}],
  ['short-1',{verified:true,ranked:true,botMatch:false,durationMs:10000}],
  ['idle-1',{verified:true,ranked:true,botMatch:false,meaningfulActions:1}]
 ]){
  const q=proposeArenaBp(w,{matchId:'not-approved-'+id,userId:'ben',dayKey:'2026-11-21',durationMs:360000,meaningfulActions:18,opponentGroup:'different-players-'+id,result:'loss',...params});assert.equal(q.proposedBp,0);
 }
});

test('reward caps resist repeats against same opponent group and daily match farms',()=>{
 const w=world(),args={userId:'cara',dayKey:'2026-11-21',verified:true,ranked:true,botMatch:false,durationMs:360000,meaningfulActions:18,result:'win'};
 assert.equal(proposeArenaBp(w,{...args,matchId:'ranked-farm-1',opponentGroup:'opponent-group-A'}).eligible,true);
 assert.equal(proposeArenaBp(w,{...args,matchId:'ranked-farm-2',opponentGroup:'opponent-group-A'}).eligible,true);
 assert.equal(proposeArenaBp(w,{...args,matchId:'ranked-farm-3',opponentGroup:'opponent-group-A'}).eligible,false);
 assert.equal(proposeArenaBp(w,{...args,matchId:'ranked-farm-4',opponentGroup:'opponent-group-B'}).eligible,true);
 assert.equal(proposeArenaBp(w,{...args,matchId:'ranked-farm-5',opponentGroup:'opponent-group-C'}).eligible,false);
});

test('no feature can alter real QMP, cash, historic BP, or production clients through sandbox transitions',()=>{
 const w=world();const before=JSON.stringify({qmp:undefined,wallet:undefined,production:undefined}),old=sumSandboxBp(w);
 const item=material(w,'anna','stone','material-verified-1');assert.equal(item.quantity,20);
 assert.equal(sumSandboxBp(w),old);assert.equal(JSON.stringify({qmp:w.qmp,wallet:w.wallet,production:w.production}),before);
 assert.equal('supabase' in w,false);assert.equal('rankedSettlement' in w,false);
});

test('prototype-looking object IDs cannot alias Object.prototype map entries',()=>{
 const w=world();proof(w,'__proto__','anna',{hero:'quin',slot:'armor'});
 const i=defineTradeItem(w,{ownerId:'anna',evidenceId:'__proto__',hero:'quin',slot:'armor'});
 const listing=listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:5,requestId:'__proto__'});
 assert.equal(listing.itemId,i.id);settleWorldTrade(w,{offerId:'__proto__',buyerId:'ben',requestId:'constructor'});
 assert.equal(w.accounts.ben.bp,495);assert.equal(sumSandboxBp(w),700);
});

test('user journey view shows connected opportunities without forcing Kingdom on Arena player or Show Faith participation',async()=>{
 const {worldJourneySummary}=await import('../experiments/empire-arena-v2/buklod-exchange.mjs');
 const w=world();let j=worldJourneySummary(w,'ben');assert.equal(j.showFaith,false);assert.equal(j.eligibleArenaBpPending,0);
 assert.ok(j.paths.some(p=>p.from==='kingdom'&&p.to==='market'));
 assert.ok(j.paths.some(p=>p.from==='empire'&&p.to==='character'));
 const i=gear(w,'anna','quin','armor','summary-item-1');listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:10,requestId:'summary-listing'});
 settleWorldTrade(w,{offerId:'summary-listing',buyerId:'ben',requestId:'summary-trade'});
 j=worldJourneySummary(w,'ben');assert.equal(j.bp,490);assert.equal(j.boughtItems,1);assert.equal(j.availableItems,1);
 const seller=worldJourneySummary(w,'anna');assert.equal(seller.tradeBpReceived,10);
});

test('unauthorized people cannot open personal House project or strategy treasury; valid owner can build with earned materials',()=>{
 const w=world();assert.throws(()=>startCommunityProject(w,{scopeId:'ben-house',projectId:'house-01',target:18,kind:'house',requestedBy:'anna'}),/authorization/);
 startCommunityProject(w,{scopeId:'ben-house',projectId:'house-01',target:18,kind:'house',requestedBy:'ben'});
 const pkg=material(w,'anna','wood','gift-to-home',20);const gift=contributeWorldMaterial(w,{itemId:pkg.id,contributorId:'anna',scopeId:'ben-house',projectId:'house-01',requestId:'home-contribution'});
 assert.equal(gift.completed,true);assert.equal(gift.applied,18);assert.equal(sumSandboxBp(w),700);
});

test('different simulated accounts cannot reuse the same verified resource event or claim each other’s goods',()=>{
 const w=world();const item=material(w,'anna','gold','mining-proof-1',50);
 assert.throws(()=>defineTradeItem(w,{ownerId:'ben',evidenceId:'mining-proof-1',kind:TRADE_KINDS.material,material:'gold',quantity:50}),/invalid/);
 assert.throws(()=>listWorldItem(w,{sellerId:'ben',itemId:item.id,priceBp:20,requestId:'not-the-owner'}),/not owner/);
 assert.throws(()=>defineTradeItem(w,{ownerId:'anna',evidenceId:'mining-proof-1',kind:TRADE_KINDS.material,material:'stone',quantity:50}),/conflicting/);
 assert.equal(w.items[item.id].ownerId,'anna');
});

test('strategy support cannot be reused by second recipient on same team even with another item',()=>{
 const w=world();const a=strategy(w,'anna','north','scout','scout-source-01');const b=strategy(w,'anna','north','supply','supply-source-01');
 for(const [i,id]of [[a,'scout-approval'],[b,'supply-approval']])registerClusterStrategy(w,{itemId:i.id,ownerId:'anna',scopeId:'north',authorizedBy:'leaderN',requestId:id});
 allocateArenaStrategy(w,{scopeId:'north',itemId:a.id,authorizedBy:'leaderN',matchId:'tactical-match-44',targetTeam:'A',recipientUserId:'ben',requestId:'permit-44'});
 assert.throws(()=>allocateArenaStrategy(w,{scopeId:'north',itemId:b.id,authorizedBy:'leaderN',matchId:'tactical-match-44',targetTeam:'A',recipientUserId:'cara',requestId:'permit-45'}),/one approved support/);
 assert.equal(w.items[b.id].location,'cluster_treasury');
});

test('House, Personal Lot and Community Map each progress independently through the same permanent 10-level engine',async()=>{
 const {startAssetTrack,PERMANENT_ASSET_LEVEL_CAP,assetRequirements}=await import('../experiments/empire-arena-v2/buklod-assets-progression.mjs');
 const w=world();startCommunityProject(w,{scopeId:'ben-house',projectId:'house-construction-01',kind:'house',target:100,requestedBy:'ben'});
 startAssetTrack(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben'});
 startAssetTrack(w,{scopeId:'ben-house',assetType:'lot',requestedBy:'ben'});
 startAssetTrack(w,{scopeId:'south',assetType:'cluster_map',requestedBy:'leaderS'});
 assert.equal(w.scopes['ben-house'].assets.house.level,1);
 assert.equal(w.scopes['ben-house'].assets.lot.level,1);
 assert.equal(w.scopes.south.assets.cluster_map.level,1);
 assert.equal(PERMANENT_ASSET_LEVEL_CAP,10);assert.ok(assetRequirements(9).materials>assetRequirements(1).materials);
 assert.ok(assetRequirements(9).xp>assetRequirements(1).xp);assert.ok(assetRequirements(9).buildMs>assetRequirements(1).buildMs);
 assert.throws(()=>startAssetTrack(w,{scopeId:'ben-house',assetType:'house',requestedBy:'anna'}),/owner/);
});

test('cross-cluster donated materials create visible stages, but cannot skip construction XP and time gates',async()=>{
 const {startAssetTrack,contributeAssetMaterials,recordAssetDevelopmentXp,simulateVerifiedAssetWork,completeAssetLevel}=await import('../experiments/empire-arena-v2/buklod-assets-progression.mjs');
 const w=world();startCommunityProject(w,{scopeId:'ben-house',projectId:'house-construction-02',kind:'house',target:36,requestedBy:'ben'});
 startAssetTrack(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben'});
 const donated=material(w,'anna','wood','house-donated-wood',36);
 contributeWorldMaterial(w,{itemId:donated.id,contributorId:'anna',scopeId:'ben-house',projectId:'house-construction-02',requestId:'house-wood-receipt'});
 const updated=contributeAssetMaterials(w,{scopeId:'ben-house',assetType:'house',projectReceiptId:'house-wood-receipt'});
 assert.equal(updated.stage,'finishing');assert.equal(updated.level,1);
 assert.throws(()=>completeAssetLevel(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben'}),/verified XP or build time/);
 sandboxEvidence(w,{eventId:'development-house-1',actorId:'ben',source:'wall',purpose:'development:house'});
 sandboxEvidence(w,{eventId:'development-house-2',actorId:'ben',source:'wall',purpose:'development:house'});
 recordAssetDevelopmentXp(w,{scopeId:'ben-house',assetType:'house',eventId:'development-house-1'});
 recordAssetDevelopmentXp(w,{scopeId:'ben-house',assetType:'house',eventId:'development-house-2'});
 assert.equal(recordAssetDevelopmentXp(w,{scopeId:'ben-house',assetType:'house',eventId:'development-house-2'}).xp,16);
 simulateVerifiedAssetWork(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben',workMs:6000});
 assert.throws(()=>completeAssetLevel(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben'}),/build time/);
 simulateVerifiedAssetWork(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben',workMs:6000});
 const advanced=completeAssetLevel(w,{scopeId:'ben-house',assetType:'house',requestedBy:'ben'});
 assert.equal(advanced.level,2);assert.equal(advanced.history.length,1);
 assert.equal(w.scopes['ben-house'].assets.house.level,2);
 assert.equal(sumSandboxBp(w),700,'construction must not mint BP');
});

test('independent permanent tracks refuse wrong project type, duplicate material receipt, and unauthorized clock',async()=>{
 const {startAssetTrack,contributeAssetMaterials,simulateVerifiedAssetWork}=await import('../experiments/empire-arena-v2/buklod-assets-progression.mjs');
 const w=world();startCommunityProject(w,{scopeId:'south',projectId:'cluster-map-02',kind:'cluster_map',target:20,requestedBy:'leaderS'});
 startAssetTrack(w,{scopeId:'south',assetType:'cluster_map',requestedBy:'leaderS'});
 startAssetTrack(w,{scopeId:'south',assetType:'lot',requestedBy:'leaderS'});
 const pack=material(w,'anna','stone','scope-stone-2026',20);
 contributeWorldMaterial(w,{itemId:pack.id,contributorId:'anna',scopeId:'south',projectId:'cluster-map-02',requestId:'scope-stone-2026-used'});
 assert.throws(()=>contributeAssetMaterials(w,{scopeId:'south',assetType:'lot',projectReceiptId:'scope-stone-2026-used'}),/purpose mismatch/);
 const first=contributeAssetMaterials(w,{scopeId:'south',assetType:'cluster_map',projectReceiptId:'scope-stone-2026-used'});
 const twice=contributeAssetMaterials(w,{scopeId:'south',assetType:'cluster_map',projectReceiptId:'scope-stone-2026-used'});
 assert.equal(twice.materials,first.materials);
 assert.throws(()=>simulateVerifiedAssetWork(w,{scopeId:'south',assetType:'cluster_map',requestedBy:'anna',workMs:1000}),/denied/);
 assert.throws(()=>simulateVerifiedAssetWork(w,{scopeId:'south',assetType:'cluster_map',requestedBy:'leaderS',workMs:100000}),/bounded/);
});

test('durable cross-cluster equipment is locked during match, never double sold, and returned after verified conclusion',async()=>{
 const {releaseWorldGear}=await import('../experiments/empire-arena-v2/buklod-exchange.mjs');
 const w=world(),i=gear(w,'anna','quin','weapon','durable-gear-source');
 listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:20,requestId:'durable-listing'});
 settleWorldTrade(w,{offerId:'durable-listing',buyerId:'ben',requestId:'durable-settle'});
 const game=startLinkedArenaPractice({exchange:w,participantId:'ben',hero:'quin',matchId:'durable-match-1',preMatchGearId:i.id,mode:'duel'});
 assert.equal(game.worldGear.sourceKey,'quin:L01:I03');assert.equal(game.worldGear.tier,1);
 assert.ok(game.players.A0.gear.weapon);assert.equal(w.items[i.id].location,'match_equipped');
 assert.throws(()=>listWorldItem(w,{sellerId:'ben',itemId:i.id,priceBp:50,requestId:'cheat-during-match'}),/locked/);
 assert.throws(()=>releaseWorldGear(w,{userId:'ben',itemId:i.id,matchId:'durable-match-1'}),/not verified/);
 assert.throws(()=>releaseWorldGear(w,{userId:'anna',itemId:i.id,matchId:'durable-match-1',verifiedEnded:true}),/does not belong/);
 releaseWorldGear(w,{userId:'ben',itemId:i.id,matchId:'durable-match-1',verifiedEnded:true});
 assert.equal(w.items[i.id].location,'inventory');
 assert.equal(sumSandboxBp(w),700);
});

test('pre-match gear must be unlocked for the selected Character, not bought as a shortcut to level 20',()=>{
 const w=world(),i=gear(w,'anna','quin','jewel','rare-jewel-source');
 listWorldItem(w,{sellerId:'anna',itemId:i.id,priceBp:15,requestId:'jewel-listing'});
 settleWorldTrade(w,{offerId:'jewel-listing',buyerId:'ben',requestId:'jewel-settle'});
 assert.throws(()=>startLinkedArenaPractice({exchange:w,participantId:'ben',hero:'quin',matchId:'test-level-one',preMatchGearId:i.id,mode:'duel'}),/not owned, unlocked/);
 assert.equal(w.items[i.id].location,'inventory');
});