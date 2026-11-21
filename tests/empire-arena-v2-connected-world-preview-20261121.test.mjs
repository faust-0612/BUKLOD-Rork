import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOfflineJourney,DEMO_IDS,DEMO_START_BP} from '../experiments/empire-arena-v2/world-exchange-journey.mjs';
import {itemDefinition} from '../experiments/empire-arena-v2/arena-v2-armory.mjs';
import {ARENA_MAPS} from '../experiments/empire-arena-v2/arena-v2-maps.mjs';
import {HEROES} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';

const begin=()=>createOfflineJourney();
const exchange=(d,{hero='quin',slot='armor',priceBp=40}={})=>{
 const i=d.simulateKingdomGear({hero,slot});
 const offer=d.listItem({itemId:i.id,priceBp});
 const receipt=d.buyItem({offerId:offer.id,requestId:'same-durable-receipt'});
 return {i,offer,receipt};
};

test('all 13 official heroes have 5 existing named, character-exclusive catalog entries',()=>{
 const d=begin();assert.equal(d.heroIds.length,13);assert.deepEqual(d.slots,['weapon','shield','armor','boots','jewel']);
 for(const hero of d.heroIds){const c=d.gearCatalog(hero);assert.equal(c.length,5);for(const x of c){assert.equal(x.hero,hero);assert.match(x.sourceKey,new RegExp('^'+hero+':L\\d\\d:I03$'));assert.ok(x.name.length>6);assert.deepEqual(x.stats,itemDefinition(hero,x.slot,1).stats);}}
 assert.equal(d.heroIds.length*5,65);
});

test('cross-cluster Kingdom seller to Empire buyer conserves BP, ownership and no lifetime rank mint',()=>{
 const d=begin(),before=d.summary();const {i,receipt}=exchange(d);
 const after=d.summary();assert.equal(receipt.itemId,i.id);assert.equal(after.bp.kingdom,DEMO_START_BP.kingdom+40);assert.equal(after.bp.arena,DEMO_START_BP.arena-40);
 assert.equal(after.bp.total,before.bp.total);assert.equal(after.bp.total,after.bp.initial);assert.equal(after.scopeIds.kingdom,DEMO_IDS.north);assert.equal(after.scopeIds.arena,DEMO_IDS.south);
 assert.ok(after.showFaithOffAllowed);assert.equal(after.items.find(x=>x.id===i.id).ownerId,DEMO_IDS.arena);
 assert.equal(d.buyItem({offerId:receipt.offerId,requestId:'same-durable-receipt'}).priceBp,40,'same purchase retry must not debit again');
 assert.equal(d.summary().bp.total,before.bp.total);
});

test('item remains character- and level-exclusive even after buyer paid BP',()=>{
 const d=begin();const {i}=exchange(d,{hero:'quin',slot:'jewel',priceBp:25});
 assert.equal(d.eligibleGear({itemId:i.id,hero:'quin',characterLevel:20}),true);
 assert.equal(d.eligibleGear({itemId:i.id,hero:'phan',characterLevel:20}),false);
 assert.equal(d.eligibleGear({itemId:i.id,hero:'quin',characterLevel:7}),false);
});

test('no trade is allowed when simulated buyer lacks existing available BP',()=>{
 const d=begin();const i=d.simulateKingdomGear({hero:'phan',slot:'weapon'});
 const offer=d.listItem({itemId:i.id,priceBp:251});
 assert.throws(()=>d.buyItem({offerId:offer.id}),/insufficient/i);
 const s=d.summary();assert.equal(s.bp.total,285);assert.equal(s.items.find(x=>x.id===i.id).location,'escrow');
});

test('material donation only uses needed units, preserves remainder, and is independently auditable',()=>{
 const d=begin(),pack=d.simulateKingdomMaterial({material:'wood',quantity:40});
 const cluster=d.donateMaterials({itemId:pack.id,project:'cluster'});
 assert.equal(cluster.applied,25);assert.equal(cluster.remainingQuantity,15);
 let s=d.summary();assert.equal(s.projects.cluster.progress,25);assert.equal(s.projects.cluster.completed,true);
 assert.equal(s.items.find(x=>x.id===pack.id).quantity,15);assert.equal(s.items.find(x=>x.id===pack.id).location,'inventory');
 const house=d.donateMaterials({itemId:pack.id,project:'house'});
 assert.equal(house.applied,15);assert.equal(house.remainingQuantity,0);
 s=d.summary();assert.equal(s.projects.house.progress,15);assert.equal(s.items.find(x=>x.id===pack.id).used,true);
 assert.equal(s.items.find(x=>x.id===pack.id).location,'consumed');assert.equal(s.bp.total,s.bp.initial);
});

test('partial material pack is still tradable for pre-existing BP, without secretly transferring original full quantity',()=>{
 const d=begin(),pack=d.simulateKingdomMaterial({material:'stone',quantity:40});
 d.donateMaterials({itemId:pack.id,project:'cluster'});
 const offered=d.listItem({itemId:pack.id,priceBp:9});d.buyItem({offerId:offered.id});
 const i=d.summary().items.find(x=>x.id===pack.id);assert.equal(i.ownerId,DEMO_IDS.arena);assert.equal(i.quantity,15);assert.equal(d.summary().bp.total,285);
});

test('strategy support crosses clusters once and applies only bounded one-time match benefit',()=>{
 const d=begin(),matchId=d.prepareMatchId();const permit=d.simulateKingdomStrategy({strategy:'engineering',matchId});
 const game=d.startPractice({matchId,hero:'mitch',mapId:'aurora_foundry',mode:'cluster',characterLevel:20,permitId:permit.requestId});
 assert.equal(game.worldSupport.effect,'construction_queue');assert.equal(game.worldSupport.budget,1);assert.equal(game.teams.A.constructionSupportRemaining,1);
 assert.equal(d.summary().strategyPermits.length,1);assert.equal(d.summary().strategyPermits[0].status,'committed');assert.equal(d.summary().bp.total,285);
});

test('matched existing purchased gear produces a valid linked practice match without a real wallet',()=>{
 const d=begin(),{i}=exchange(d,{hero:'quin',slot:'armor'}),matchId=d.prepareMatchId();
 const game=d.startPractice({matchId,hero:'quin',gearItemId:i.id,mapId:'genesis_rift',characterLevel:20,mode:'duel'});
 assert.equal(game.worldGear.sourceItemId,i.id);assert.equal(game.worldGear.slot,'armor');assert.equal(game.worldGear.tier,1);
 assert.equal(game.mapId,'genesis_rift');assert.equal(d.summary().bp.total,285);
 assert.equal(d.summary().items.find(x=>x.id===i.id).location,'match_equipped');
});

test('map difficulty is opt-in terrain/PvE, not a hidden spendable BP mint',()=>{
 const d=begin();assert.equal(d.maps.length,3);
 assert.deepEqual(d.maps.map(x=>ARENA_MAPS[x].difficulty).sort(),[1,2,3]);
 for(const m of d.maps){assert.equal(typeof ARENA_MAPS[m].description,'string');assert.equal(ARENA_MAPS[m].mineBias.gold>0,true)}
 assert.equal(d.summary().bp.total,285);
});

test('standalone preview is clear about its sandbox nature and never loads backend API or payment script',()=>{
 const h=readFileSync(new URL('../experiments/empire-arena-v2/world-exchange-preview.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../experiments/empire-arena-v2/world-exchange-preview.mjs',import.meta.url),'utf8');
 assert.match(h,/OFFLINE DEMONSTRATION/);assert.match(h,/No real trading, BP, QMP or rewards/);
 assert.match(h,/world-exchange-preview\.mjs/);assert.match(js,/createOfflineJourney/);
 assert.doesNotMatch(js,/supabase\.co|fetch\(|localStorage|service_role/);
 assert.doesNotMatch(h,/https:\/\/[^"']*\.js/);
});