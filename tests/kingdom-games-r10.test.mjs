import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 TRADE_SEASONS,createTradeRound,tradePrice,tradeBuy,tradeSell,fulfillTrade,endTradeDay,
} from '../src/features/games/phan/tradeMasterRules.ts';
import {
 MELODY_LEVELS,createMelodyRound,hintMelody,enterMelodyNote,
 BEAT_LEVELS,createBeatRound,toggleBeat,hintBeat,gradeBeat,
} from '../src/features/games/lhen/musicCityRules.ts';
import {
 EXPEDITION_MAPS,createExpeditionRun,moveExpedition,expeditionHasSolution,
} from '../src/features/games/niel/expeditionPuzzleRules.ts';
import {
 BRIDGE_LEVELS,createBridgeRound,bridgeCandidates,bridgeDegrees,bridgeSolved,
 bridgeIsConnected,setBridge,undoBridge,hintBridge,
} from '../src/features/games/elesur/bridgePuzzleRules.ts';
import {
 TOWER_LEVELS,createTowerRound,placeTower,upgradeTower,advanceTowerTurn,
} from '../src/features/games/ace/towerTacticsRules.ts';
import {
 Chess,chessStatus,legalChessMoves,chooseChessAiMove,chessMove,
} from '../src/features/games/ace/chessRules.ts';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('R10 Trade Master: finite prices, order budget, no duplicate contract and three obtainable seasons',()=>{
 for(let level=0;level<TRADE_SEASONS.length;level++){
  let r=createTradeRound(level);
  const initial=r;
  assert.ok(r.marketStock.every(v=>v>0));
  const p=tradePrice(level,0,0,'buy'),sale=tradePrice(level,0,0,'sell');
  assert.ok(p>sale);
  assert.throws(()=>tradeBuy(r,0,100),/Invalid trade order/,'reject excessive purchase');
  for(const contract of r.contracts){
   let remaining=contract.quantity-r.inventory[contract.good];
   while(remaining>0){
    const qty=Math.min(5,remaining);
    const next=tradeBuy(r,contract.good,qty);
    assert.notEqual(next,r,'budgeted contract quantity must be buyable');
    r=next;remaining-=qty;
   }
   const next=fulfillTrade(r,contract.id);
   assert.notEqual(next,r);r=next;
   assert.equal(fulfillTrade(r,contract.id),r,'contract cannot be claimed twice');
  }
  assert.equal(r.fulfilled.length,TRADE_SEASONS[level].contracts.length);
  assert.ok(r.cash>=150);
  for(let day=0;day<5;day++)r=endTradeDay(r);
  assert.equal(r.status,'won');
  assert.ok(r.score>0);
  assert.deepEqual(initial,createTradeRound(level),'source immutable');
  assert.throws(()=>endTradeDay(r),/finished/);
 }
 assert.throws(()=>createTradeRound(-1),/Invalid/);
});

test('R10 music: every note sequence reproducible, mistake/lifeline bounded, and each authored beat can be matched',()=>{
 for(let level=0;level<3;level++){
  let memory=createMelodyRound(level);
  assert.deepEqual(createMelodyRound(level),memory);
  const used=hintMelody(memory);
  assert.equal(hintMelody(used),used,'one hint per phrase');
  memory=used;
  for(const note of memory.notes)memory=enterMelodyNote(memory,note);
  assert.equal(memory.status,'won');assert.ok(memory.score>0);
  assert.throws(()=>enterMelodyNote(memory,0),/completed/);
  let failed=createMelodyRound(level);
  for(let i=0;i<3;i++)failed=enterMelodyNote(failed,(failed.notes[0]+1)%4);
  assert.equal(failed.status,'lost');
  let beat=createBeatRound(level);
  assert.deepEqual(createBeatRound(level),beat);
  assert.equal(hintBeat(hintBeat(beat)).hintUsed,true);
  for(let lane=0;lane<4;lane++)for(let step=0;step<8;step++){
   if(beat.target[lane][step])beat=toggleBeat(beat,lane,step);
  }
  assert.deepEqual(beat.draft,beat.target);
  const winning=gradeBeat(beat);
  assert.equal(winning.status,'won');assert.ok(winning.score>0);
  assert.throws(()=>gradeBeat(winning),/finished/);
  let wrong=createBeatRound(level);
  for(let i=0;i<3;i++)wrong=gradeBeat(wrong);
  assert.equal(wrong.status,'lost');
 }
 assert.throws(()=>createMelodyRound(3),/Invalid/);
 assert.throws(()=>createBeatRound(3),/Invalid/);
 assert.throws(()=>toggleBeat(createBeatRound(0),4,0),/Invalid/);
});

test('R10 expedition: all three maps safely solvable and route budgets enforced',()=>{
 for(let level=0;level<EXPEDITION_MAPS.length;level++){
  assert.equal(expeditionHasSolution(level),true);
  const map=EXPEDITION_MAPS[level];
  assert.equal(new Set(map.required).size,map.required.length);
  let run=createExpeditionRun(level);
  assert.equal(moveExpedition(run,999),run);
  for(let node=1;node<map.nodes.length;node++){
   const next=moveExpedition(run,node);
   assert.notEqual(next,run,'authored safe route must be adjacent');
   assert.ok(next.food>=0&&next.water>=0);
   run=next;
  }
  assert.equal(run.status,'won');assert.ok(run.score>0);
  assert.ok(map.required.every(id=>run.visited.includes(id)));
  assert.throws(()=>moveExpedition(run,0),/finished/);
 }
});

test('R10 bridge puzzle: every authored solution connects all islands exactly and no illegal crossings',()=>{
 for(let level=0;level<BRIDGE_LEVELS.length;level++){
  const cfg=BRIDGE_LEVELS[level];
  let run=createBridgeRound(level);
  const ids=new Set(run.edges.map(e=>e.id));
  assert.ok(Object.keys(cfg.solution).every(id=>ids.has(id)));
  assert.ok(run.nodes.every(n=>n.target>=2));
  const saved=run;
  for(const [id,count] of Object.entries(cfg.solution)){
   const after=setBridge(run,id,count);
   assert.notEqual(after,run,'authored bridge must be legal '+id);
   run=after;
  }
  assert.equal(run.status,'won');
  assert.equal(bridgeSolved(run),true);
  assert.equal(bridgeIsConnected(run),true);
  assert.deepEqual(bridgeDegrees(run),run.nodes.map(n=>n.target));
  assert.ok(run.score>0);
  assert.equal(saved.edges.every(e=>e.count===0),true,'original not mutated');
  assert.throws(()=>setBridge(run,run.edges[0].id,0),/finished/);
 }
 let r=createBridgeRound(2);
 assert.ok(r.edges.some(e=>e.id==='1-6'), 'vertical crossing candidate exists');
 r=setBridge(r,'3-4',1);
 assert.equal(setBridge(r,'1-6',1),r,'crossing rejected');
 const a=createBridgeRound(0);
 const b=setBridge(a,'0-1',1);
 assert.deepEqual(undoBridge(b).edges,a.edges);
 assert.notEqual(hintBridge(a),a);
 assert.throws(()=>setBridge(a,'0-1',3),/capacity/);
});

test('R10 tower tactics: finite resources, legal positions, bounded waves, no direct rewards',()=>{
 for(let level=0;level<TOWER_LEVELS.length;level++){
  const initial=createTowerRound(level);
  assert.equal(placeTower(initial,3,1,'cannon'),initial,'road cannot host towers');
  assert.equal(placeTower(initial,7,0,'archer'),initial,'out-of-bounds forbidden');
  const at=level===0?[1,3,5]:level===1?[0,2,4,6]:[0,1,3,5,6];
  let run=initial;
  for(const col of at){
   const next=placeTower(run,2,col,'cannon');
   assert.notEqual(next,run,'chosen defense should be affordable');
   run=next;
  }
  assert.ok(run.credits>=0);
  assert.equal(run.towers.length,at.length);
  assert.equal(placeTower(run,2,at[0],'cannon'),run,'occupied square rejected');
  const start=run;
  for(let i=0;i<55&&run.status==='playing';i++){
   const next=advanceTowerTurn(run);
   assert.equal(next.turn,run.turn+1);
   run=next;
  }
  assert.ok(run.status==='won'||run.status==='lost');
  assert.ok(run.turn<=55);
  assert.equal(initial.towers.length,0);
  assert.throws(()=>advanceTowerTurn(run),/finished/);
  assert.deepEqual(start.towers,run.towers);
 }
});

test('R10 BSD-licensed chess engine enforces castling, en passant, underpromotion, mate and draws',()=>{
 const vendor=read('src/features/games/ace/vendor/chess-js-1.2.0.ts');
 const license=read('src/features/games/ace/vendor/LICENSE');
 const sha=createHash('sha1').update('blob '+Buffer.byteLength(vendor)+'\0').update(vendor).digest('hex');
 assert.equal(sha,'bac8185afa4369f56f7acd2aa5dc293e458cba45','chess engine must match vetted v1.2.0');
 assert.ok(license.includes('Jeff Hlywa'));
 assert.ok(!vendor.includes('import { parse }')&&!vendor.includes('BigInt('));
 const castles=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
 assert.ok(legalChessMoves(castles,'e1').some(m=>m.to==='g1'));
 chessMove(castles,{from:'e1',to:'g1'});
 assert.equal(castles.get('f1').type,'r');
 const ep=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 assert.ok(legalChessMoves(ep,'e5').some(m=>m.to==='d6'));
 chessMove(ep,{from:'e5',to:'d6'});
 assert.equal(ep.get('d5'),undefined);
 assert.equal(ep.get('d6').type,'p');
 const promo=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
 chessMove(promo,{from:'a7',to:'a8',promotion:'n'});
 assert.equal(promo.get('a8').type,'n');
 const fools=new Chess();['f3','e5','g4','Qh4#'].forEach(m=>fools.move(m));
 assert.equal(chessStatus(fools),'black-win');
 const repeat=new Chess();
 for(let i=0;i<2;i++)['Nf3','Nf6','Ng1','Ng8'].forEach(m=>repeat.move(m));
 assert.equal(repeat.isThreefoldRepetition(),true);
 assert.equal(chessStatus(repeat),'draw');
 const fifty=new Chess('4k3/8/8/8/8/8/8/4K2R w K - 100 1');
 assert.equal(fifty.isDrawByFiftyMoves(),true);
 assert.equal(chessStatus(fifty),'draw');
 for(let level=0;level<3;level++){
  const ai=new Chess();ai.move('e4');
  const choice=chooseChessAiMove(ai,level);
  assert.ok(choice);
  assert.ok(legalChessMoves(ai).some(m=>m.from===choice.from&&m.to===choice.to));
  chessMove(ai,choice);
  assert.equal(ai.turn(),'w');
 }
});

test('R10 Kingdom all 39 original/preview games are wired to the existing BUKLOD App stations',()=>{
 const cases=[
  ['phan-enterprise-builder','EnterpriseBuilderGameV1',['phan-trade-master']],
  ['lhen-rhythm-journey','RhythmJourneyGameV1',['lhen-melody-memory','lhen-beat-composer']],
  ['ace-rescue-grid','RescueGridGameV1',['ace-chess-master','ace-tower-tactics']],
  ['niel-mission-trail','MissionTrailGameV1',['niel-expedition-puzzle']],
  ['elesur-village-builder','VillageBuilderGameV1',['elesur-bridge-puzzle']],
 ];
 for(const [id,old,newOnes] of cases){
  const code=read('src/app/games/'+id+'.tsx');
  assert.ok(code.includes(old));assert.ok(code.includes('KingdomInteriorCenter'));
  for(const n of newOnes)assert.ok(code.includes(n),n+' missing from center');
 }
 for(const path of [
  'src/features/games/phan/TradeMasterGameV1.tsx',
  'src/features/games/lhen/MusicCityGameV1.tsx',
  'src/features/games/ace/ChessMasterGameV1.tsx',
  'src/features/games/ace/TowerTacticsGameV1.tsx',
  'src/features/games/niel/ExpeditionPuzzleGameV1.tsx',
  'src/features/games/elesur/BridgePuzzleGameV1.tsx',
 ]){const src=read(path);assert.ok(src.includes('reward:{xp:0,kingdomXp:0}'));assert.ok(!src.includes('.rpc('));}
 const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
 const all=catalog.characters.flatMap(c=>c.games);
 assert.equal(catalog.characters.length,13);assert.equal(all.length,39);
 assert.equal(all.filter(g=>g.status==='existing').length,13);
 assert.equal(all.filter(g=>g.status==='pilot').length,26);
 assert.equal(all.filter(g=>g.status==='planned').length,0);
 const route=read('src/app/games/index.tsx');
 assert.ok(route.includes('BuklodKingdomMapPremium'));
});
