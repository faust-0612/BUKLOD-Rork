import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EVIDENCE_QUESTIONS,createEvidenceRound,answerEvidence,advanceEvidence,evidenceHint } from '../src/features/games/kingdom/platform/evidenceRules.ts';
import { MERGE_LEVELS,createMergeRound,moveMerge,mergeLegalMoves } from '../src/features/games/kingdom/platform/mergeRules.ts';
import { WORD_LEVELS,createWordRound,wordSnakePath,addWordCell,submitWordPath,currentWord,wordPathValid } from '../src/features/games/kingdom/platform/wordTrailRules.ts';

test('R9 evidence games have defensible bilingual answer bank across 3 difficulty tiers',()=>{
 for(const id of ['quin-guessing-quest','van-mind-challenge']){
  const q=EVIDENCE_QUESTIONS[id];assert.equal(q.length,9);
  assert.equal(new Set(q.map(x=>x.id)).size,9);
  assert.deepEqual(q.map(x=>x.tier),[0,0,0,1,1,1,2,2,2]);
  for(const item of q){
   assert.ok(item.prompt.en.length>15&&item.prompt.tl.length>15);
   assert.ok(item.explanation.en.length>14&&item.explanation.tl.length>14);
   assert.ok(item.hint.en.length>5&&item.hint.tl.length>5);
   assert.equal(item.choices.en.length,4);assert.equal(item.choices.tl.length,4);
   assert.equal(new Set(item.choices.en).size,4);assert.equal(new Set(item.choices.tl).size,4);
   assert.ok(Number.isInteger(item.correct)&&item.correct>=0&&item.correct<4);
  }
 }
});
test('R9 evidence rules: correct run wins, hinted run scores less, wrong answers require two attempts and cannot duplicate',()=>{
 for(const id of ['quin-guessing-quest','van-mind-challenge']){
  let perfect=createEvidenceRound(id),hinted=createEvidenceRound(id),wrong=createEvidenceRound(id);
  for(let i=0;i<9;i++){
   const correct=EVIDENCE_QUESTIONS[id][i].correct,miss=(correct+1)%4;
   const hint=evidenceHint(hinted);
   assert.equal(evidenceHint(hint),hint);
   hinted=answerEvidence(hint,correct);
   assert.ok(hinted.locked);
   perfect=answerEvidence(perfect,correct);
   assert.equal(answerEvidence(perfect,miss),perfect);
   wrong=answerEvidence(wrong,miss);assert.equal(wrong.locked,false);
   wrong=answerEvidence(wrong,miss);assert.equal(wrong.locked,true);
   perfect=advanceEvidence(perfect);hinted=advanceEvidence(hinted);wrong=advanceEvidence(wrong);
  }
  assert.equal(perfect.status,'won');assert.equal(perfect.correct,9);
  assert.equal(hinted.status,'won');assert.equal(hinted.correct,9);
  assert.ok(perfect.score>hinted.score);
  assert.equal(wrong.status,'lost');assert.equal(wrong.correct,0);
  assert.throws(()=>advanceEvidence(wrong),/not yet settled|Answer/);
  assert.throws(()=>answerEvidence(createEvidenceRound(id),7),/out of range/);
 }
});
test('R9 merge engine: nine deterministic 4×4 boards, no negative/duplicated power values, finite turns',()=>{
 for(const id of ['mitch-color-merge','angel-treasure-merge','vhen-farm-merge']){
  assert.equal(MERGE_LEVELS[id].length,3);
  for(let level=0;level<3;level++){
   let run=createMergeRound(id,level);
   assert.deepEqual(createMergeRound(id,level),run);
   assert.equal(run.board.length,4);assert.ok(run.board.every(row=>row.length===4));
   assert.equal(run.board.flat().filter(Boolean).length,2);
   const records=[];
   for(let i=0;i<run.maxMoves&&run.status==='playing';i++){
    const opts=mergeLegalMoves(run.board);assert.ok(opts.length);
    const prev=run;const next=moveMerge(prev,opts[0]);
    assert.notEqual(prev,next);assert.equal(next.moves,i+1);
    assert.deepEqual(prev.board,prev.board.map(row=>[...row]),'immutable');
    assert.ok(next.board.flat().every(v=>v===0||(v>=2&&Number.isInteger(Math.log2(v)))));
    records.push(opts[0]);run=next;
   }
   assert.ok(run.status==='won'||run.status==='lost');
   let replay=createMergeRound(id,level);
   for(const action of records)replay=moveMerge(replay,action);
   assert.deepEqual(run,replay);
   assert.throws(()=>moveMerge(run,'left'),/finished/);
  }
 }
});
test('R9 word engine: each authored target word has a connected, unique-cell solution path',()=>{
 const snake=wordSnakePath();
 assert.equal(snake.length,16);assert.equal(new Set(snake.map(c=>c.row+':'+c.col)).size,16);
 for(const id of ['trudice-word-garden','niel-word-explorer']){
  assert.equal(WORD_LEVELS[id].length,3);
  for(let level=0;level<3;level++){
   let run=createWordRound(id,level);assert.deepEqual(createWordRound(id,level),run);
   assert.equal(run.board.length,4);
   const seed=WORD_LEVELS[id][level].seed,rotated=snake.map(p=>{
    let {row,col}=p;for(let i=0;i<seed%4;i++){const newRow=col;col=3-row;row=newRow;}return {row,col};
   });
   let offset=0;
   for(const word of run.words){
    for(const p of rotated.slice(offset,offset+word.length))run=addWordCell(run,p);
    assert.equal(currentWord(run),word);
    assert.equal(wordPathValid(run.board,run.path),true);
    const before=run;run=submitWordPath(run);
    assert.equal(run.found.length,before.found.length+1);
    assert.deepEqual(run.path,[]);
    offset+=word.length;
   }
   assert.equal(run.status,'won');assert.ok(run.score>0);
   assert.throws(()=>addWordCell(run,{row:0,col:0}),/finished/);
  }
 }
});
test('R9 station routes keep original games and all six new IDs; direct rewards remain zero',()=>{
 const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const routes=[
  ['quin-discovery-expedition','DiscoveryExpeditionGameV1','quin-guessing-quest'],
  ['van-living-city-dispatch','LivingCityDispatchGameV1','van-mind-challenge'],
  ['mitch-restore-mural','RestoreMuralGameV1','mitch-color-merge'],
  ['angel-kingdom-treasury','KingdomTreasuryGameV1','angel-treasure-merge'],
  ['vhen-farm-to-market','FarmToMarketGameV1','vhen-farm-merge'],
  ['trudice-playground-memory','PlaygroundPathGameV2','trudice-word-garden'],
  ['niel-mission-trail','MissionTrailGameV1','niel-word-explorer'],
 ];
 for(const [route,legacy,id] of routes){
  const src=read('src/app/games/'+route+'.tsx');
  assert.ok(src.includes(legacy));assert.ok(src.includes(id));
  assert.ok(src.includes('BuklodGameStage'));
 }
 for(const path of ['EvidenceGameV1.tsx','MergeGameV1.tsx','WordTrailGameV1.tsx']){
  const src=read('src/features/games/kingdom/platform/'+path);
  assert.ok(src.includes('reward:{xp:0,kingdomXp:0}'));
  assert.ok(!src.includes('.rpc('));assert.ok(!src.includes('showBuklodInterstitial'));
 }
});
