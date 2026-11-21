import {createOfflineJourney,DEMO_IDS} from './world-exchange-journey.mjs';
import {itemDefinition} from './arena-v2-armory.mjs';
import {HEROES} from './arena-v2-engine.mjs';
import {ARENA_MAPS} from './arena-v2-maps.mjs';

const $=id=>document.getElementById(id);
let demo=createOfflineJourney();
let lastGearId=null,lastOfferId=null,lastMaterialId=null,lastPermitId=null,lastMatchId=null;
const history=[];
const nameOf=id=>HEROES[id]?.name??id;
function option(value,label){const e=document.createElement('option');e.value=value;e.textContent=label;return e;}
function populate(){
 for(const id of demo.heroIds)$('hero').append(option(id,nameOf(id)));
 for(const slot of demo.slots)$('slot').append(option(slot,slot.toUpperCase()));
 for(const id of demo.maps){const m=ARENA_MAPS[id];$('map').append(option(id,`${m.name} · ${'★'.repeat(m.difficulty)}`));}
 $('hero').value='quin';$('slot').value='armor';$('map').value='verdant_fracture';
}
function log(message){history.unshift(message);if(history.length>10)history.pop();const root=$('log');root.replaceChildren(...history.map(line=>{const p=document.createElement('p');p.textContent=line;return p}));}
function text(id,value){$(id).textContent=String(value)}
function makePill(textValue){const b=document.createElement('span');b.className='pill';b.textContent=textValue;return b;}
function render(){const s=demo.summary(),cat=demo.gearCatalog($('hero').value),selected=cat.find(x=>x.slot===$('slot').value);
 text('kingdomBp',s.bp.kingdom+' BP');text('arenaBp',s.bp.arena+' BP');text('conservedBp',s.bp.total+' / '+s.bp.initial+' BP');
 text('heroDetail',`${nameOf($('hero').value)} · ${selected?.name} · ${selected?.sourceKey}`);
 const item=itemDefinition($('hero').value,$('slot').value,Number($('tier').value));
 const statText=Object.entries(item.stats).map(([k,v])=>`${k} +${v}`).join('  ·  ');
 text('gearStats',statText);
 const available=s.items.filter(x=>x.ownerId===DEMO_IDS.arena&&x.location==='inventory'&&!x.used);
 $('backpack').replaceChildren(...(available.length?available.map(i=>makePill(`${i.name} · ${i.assetKey}`)):[makePill('Empty — earned items remain with their owner until purchased')]));
 text('tradeInfo',s.trades.length?`${s.trades.length} settled item trade(s), no fresh lifetime BP`:'No item trades yet');
 text('materialInfo',lastMaterialId?(s.items.find(x=>x.id===lastMaterialId)?.quantity??0)+' units remaining from last material pack':'No material pack generated');
 text('clusterProgress',`${s.projects.cluster.progress}/${s.projects.cluster.target}`);
 text('houseProgress',`${s.projects.house.progress}/${s.projects.house.target}`);
 $('clusterBar').style.width=(100*s.projects.cluster.progress/s.projects.cluster.target)+'%';
 $('houseBar').style.width=(100*s.projects.house.progress/s.projects.house.target)+'%';
 text('matchState',s.match?`${nameOf(s.match.hero)} entered ${ARENA_MAPS[s.match.mapId].name}; gear ${s.match.worldGear?.slot??'none'}, support ${s.match.worldSupport?.effect??'none'}`:'No pre-match reservations');
 const map=ARENA_MAPS[$('map').value];text('mapDetail',`${map.identity}. Difficulty ${map.difficulty}/3; ${map.description}`);
 text('eligibility',lastGearId?(demo.eligibleGear({itemId:lastGearId,hero:$('hero').value,characterLevel:Number($('level').value)})?'Eligible for selected hero and level':'Not eligible: wrong owner, hero or level'):'Item acquisition required');
 $('earnedLabel').textContent=lastGearId?`Kingdom item ${lastGearId} created (SIMULATED)`:'No Kingdom item minted';
 $('offerLabel').textContent=lastOfferId?`Escrow offer ${lastOfferId} (SIMULATED)`:'No escrow offer';
 $('faithNote').textContent='Both demo accounts have Show Faith OFF. Every item/progress action here is equally accessible without religious participation.';
}
function run(fn){try{fn();render();}catch(err){log('Denied: '+String(err.message??err));render();}}
function createGear(){const hero=$('hero').value,slot=$('slot').value,tier=Number($('tier').value);const i=demo.simulateKingdomGear({hero,slot,tier});lastGearId=i.id;lastOfferId=null;log(`Kingdom helper (North) found ${i.name} [${i.assetKey}]. No BP created.`)}
function listGear(){if(!lastGearId)throw Error('Earn a simulated Kingdom item first');const o=demo.listItem({itemId:lastGearId,priceBp:Number($('price').value)});lastOfferId=o.id;log(`North seller listed item for ${o.priceBp} existing BP. Item locked in escrow.`)}
function buyGear(){if(!lastOfferId)throw Error('List the item first');const r=demo.buyItem({offerId:lastOfferId});log(`South buyer purchased for ${r.priceBp} BP. Total BP unchanged; seller/buyer lifetime ranks untouched.`)}
function material(){const i=demo.simulateKingdomMaterial({material:$('materialType').value,quantity:Number($('materialCount').value)});lastMaterialId=i.id;log(`North Kingdom helper gained ${i.quantity} ${i.material} (OFFLINE FIXTURE).`)}
function donate(){if(!lastMaterialId)throw Error('Generate a materials pack first');const p=$('project').value;const r=demo.donateMaterials({itemId:lastMaterialId,project:p});log(`${r.applied} material units went from North to ${p==='house'?'South personal house':'South Cluster Map'}. Remaining ${demo.summary().items.find(x=>x.id===lastMaterialId).quantity}. Construction XP and time still required.`)}
function launch(){if(lastMatchId)throw Error('Already started a demo match. Reset to create another.');
 const hero=$('hero').value,mapId=$('map').value,level=Number($('level').value),item=lastGearId&&demo.eligibleGear({itemId:lastGearId,hero,characterLevel:level})?lastGearId:null;
 if(lastGearId&&!item)throw Error('Owned item must match this hero and required level before it can be equipped.');
 const matchId=demo.prepareMatchId();let permitId=null;
 if($('support').checked){const p=demo.simulateKingdomStrategy({strategy:$('strategy').value,matchId});permitId=p.requestId;}
 const game=demo.startPractice({matchId,hero,mapId,mode:$('mode').value,characterLevel:level,gearItemId:item,permitId});
 lastPermitId=permitId;lastMatchId=matchId;
 log(`Practice prepared: ${nameOf(hero)} / ${ARENA_MAPS[mapId].name} / ${game.mode} with ${item?'exclusive gear':'basic loadout'} and ${permitId?'cross-cluster strategy':'no aid'}. No actual match server or BP reward.`);
}
function reset(){demo=createOfflineJourney();lastGearId=null;lastOfferId=null;lastMaterialId=null;lastPermitId=null;lastMatchId=null;history.length=0;log('Fresh offline scenario. All in-memory items and trades reset.');}
for(const id of ['hero','slot','tier','level','map'])$(id).addEventListener('change',()=>run(()=>{}));
const actions={earnGear:createGear,listGear,buyGear,earnMaterial:material,donate,launch,reset};
for(const [id,fn]of Object.entries(actions))$(id).addEventListener('click',()=>run(fn));
populate();render();log('OFFLINE SIMULATION ONLY. No connection to real BUKLOD accounts, wallets, inventories, QMP or ranked matches.');