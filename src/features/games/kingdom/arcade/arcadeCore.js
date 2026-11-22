'use strict';
/**
 * Deterministic, bounded, offline gameplay. These are GAME-ONLY scores.
 * No caller may interpret local state as BP, Character XP, cash or inventory.
 */
const MODES = Object.freeze(['catch','lane','runner','rhythm','defend','tap','search','stack']);
const CHALLENGES = Object.freeze([
  'discovery','precision','rush','rescue','combo','storm','treasure','endurance',
]);
const MAX_SCORE = 100000000; // Complies with the existing preview record validator.
const MAX_STAGE = 1000000; // Prevent numeric overflow and impossible allocations.
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
function rand(s,max) {
  // Xorshift avoids the strong low-bit correlations of LCG lane selection.
  let x=s.seed || 0x6d2b79f5;
  x^=x<<13; x^=x>>>17; x^=x<<5;
  s.seed=x>>>0;
  return s.seed%max;
}
function stageConfig(mode,stage) {
  const level=clamp(Math.trunc(stage)||1,1,MAX_STAGE);
  // Goal and speed have playability caps; mastery/score and modifier keep growing.
  const challenge=CHALLENGES[(level-1+MODES.indexOf(mode))%CHALLENGES.length];
  return {
    goal: Math.min(30,7+Math.floor(level*0.9)),
    duration: clamp(310-Math.floor(level/2),260,310),
    spawnInterval:clamp(9-Math.floor(level/3),3,9),
    speed: Math.min(0.82,0.23+level*0.024),
    multiplier: 1+Math.floor((level-1)/4),
    challenge,
    hazardRate:challenge==='storm'?3:challenge==='rescue'?7:5,
  };
}
function startArcade(mode,seed,stage=1,total=0,lives=3) {
  if (!MODES.includes(mode)) throw new Error('Unknown arcade mode');
  if (!Number.isSafeInteger(stage)||stage<1||stage>MAX_STAGE) throw new Error('Invalid arcade stage');
  const config=stageConfig(mode,stage);
  const s={
    mode, seed:(seed>>>0)||0x6d2b79f5,stage,
    score:clamp(Number(total)||0,0,MAX_SCORE),
    stagePoints:0,stageHits:0,goal:config.goal,challenge:config.challenge,
    multiplier:config.multiplier,stageBonus:0,perfects:0,bestCombo:0,
    lives:clamp(lives,1,4),combo:0,lane:1,
    jumpUntil:0,jumpCooldownUntil:0,lastActionTick:-20,
    ticks:0,remaining:config.duration,
    entities:[],entitySeq:0,lastPatterns:[],
    marker:0,markerDirection:1,target:2,cell:0,
    recentCells:[],flashUntil:4,deadline:13,
    eventSeq:0,outcome:'move',status:'playing',
  };
  // Mix stage into the PRNG state so every stage has a distinct deterministic layout.
  s.seed = (s.seed ^ Math.imul(stage,0x9e3779b1) ^ (MODES.indexOf(mode)+1)*0x45d9f3b)>>>0;
  s.cell=rand(s,9);
  s.target=rand(s,5);
  s.recentCells=[s.cell];
  s.deadline=clamp(13-Math.floor(stage/15),8,13);
  return s;
}
function award(s,perfect=false) {
  s.combo=Math.min(30,s.combo+1);
  s.bestCombo=Math.max(s.bestCombo,s.combo);
  if(perfect)s.perfects++;
  const multiplier=Math.min(1000,s.multiplier);
  const points=(perfect?17:12)*multiplier + Math.min(55,s.combo*3);
  s.stagePoints=clamp(s.stagePoints+points,0,MAX_SCORE);
  s.score=clamp(s.score+points,0,MAX_SCORE);
  s.stageHits++;
  s.outcome=(s.combo%6===0?'unlock':'collect');
  s.eventSeq++;
}
function hurt(s) {
  s.lives=Math.max(0,s.lives-1);
  s.combo=0;
  s.outcome='impact';
  s.eventSeq++;
}
function check(s) {
  if(s.stageHits>=s.goal) {
    if(s.status!=='clear') {
      const bonus=Math.min(250000,80+s.stage*18+Math.min(2500,s.bestCombo*12));
      s.stageBonus=bonus;
      s.stagePoints=clamp(s.stagePoints+bonus,0,MAX_SCORE);
      s.score=clamp(s.score+bonus,0,MAX_SCORE);
    }
    s.status='clear';
  } else if(s.lives<=0||s.remaining<=0) s.status='lost';
  return s;
}
function nextCell(s) {
  const possible=[0,1,2,3,4,5,6,7,8].filter(v=>!s.recentCells.includes(v));
  const next=possible[rand(s,possible.length)];
  s.cell=next;
  s.recentCells=[...s.recentCells.slice(-3),next];
  s.flashUntil=s.ticks+clamp(5-Math.floor(s.stage/14),3,5);
  s.deadline=s.ticks+clamp(14-Math.floor(s.stage/6),8,14);
}
function spawn(s) {
  const config=stageConfig(s.mode,s.stage);
  // No identical nearby combinations; within one stage the procedural
  // seed, modifier and recent-pattern window ensure local variety.
  const good=s.mode==='rhythm'?true:s.mode==='defend'?false:rand(s,config.hazardRate)!==0;
  let lane=rand(s,3),variant=rand(s,3);
  let signature='';
  for(let n=0;n<9;n++) {
    signature=lane+':'+(good?'1':'0')+':'+variant;
    if(!s.lastPatterns.includes(signature))break;
    lane=(lane+1)%3;
    if(lane===0)variant=(variant+1)%3;
  }
  s.lastPatterns=[...s.lastPatterns.slice(-5),signature];
  s.entities.push({id:++s.entitySeq,lane,y:0,good,variant});
}
function tickArcade(previous) {
  if(previous.status!=='playing')return previous;
  const s={...previous,ticks:previous.ticks+1,remaining:previous.remaining-1,
    entities:previous.entities.map(e=>({...e})),
    recentCells:[...previous.recentCells],lastPatterns:[...previous.lastPatterns]};
  if(s.mode==='tap'||s.mode==='search') {
    if(s.ticks>=s.deadline) {hurt(s);nextCell(s);}
  } else if(s.mode==='stack') {
    const interval=clamp(5-Math.floor(s.stage/4),2,5);
    if(s.ticks%interval===0){
      let next=s.marker+s.markerDirection;
      if(next<0||next>4){s.markerDirection*=-1;next=s.marker+s.markerDirection;}
      s.marker=next;
    }
  } else {
    const config=stageConfig(s.mode,s.stage);
    if(s.ticks%config.spawnInterval===0&&s.entities.length<9)spawn(s);
    const kept=[];
    for(const e of s.entities){
      e.y+=config.speed;
      if((s.mode==='rhythm'||s.mode==='defend')&&e.y>=6){hurt(s);continue;}
      if(e.y>=5.3){
        if(e.lane===s.lane){
          if(e.good)award(s);
          else if(!(s.mode==='runner'&&s.jumpUntil>=s.ticks))hurt(s);
        }
        continue;
      }
      kept.push(e);
    }
    s.entities=kept;
  }
  return check(s);
}
function actArcade(previous,action,value) {
  if(previous.status!=='playing')return previous;
  const s={...previous,entities:previous.entities.map(e=>({...e})),
    recentCells:[...previous.recentCells],lastPatterns:[...previous.lastPatterns]};
  if(action==='left'&&['catch','lane','runner'].includes(s.mode)){
    s.lane=Math.max(0,s.lane-1);s.outcome='move';s.eventSeq++;return s;
  }
  if(action==='right'&&['catch','lane','runner'].includes(s.mode)){
    s.lane=Math.min(2,s.lane+1);s.outcome='move';s.eventSeq++;return s;
  }
  if(action==='jump'&&s.mode==='runner'){
    if(s.ticks<s.jumpCooldownUntil)return previous;
    s.jumpUntil=s.ticks+5;s.jumpCooldownUntil=s.ticks+13;
    s.outcome='move';s.eventSeq++;return s;
  }
  if((s.mode==='tap'||s.mode==='search')&&action==='cell'){
    if(!Number.isInteger(value)||value<0||value>8||s.ticks-s.lastActionTick<3)return previous;
    if(s.mode==='search'&&s.ticks<s.flashUntil)return previous;
    s.lastActionTick=s.ticks;
    if(value===s.cell)award(s,true);else hurt(s);
    nextCell(s);
    return check(s);
  }
  if(s.mode==='stack'&&action==='drop'){
    if(s.ticks-s.lastActionTick<3)return previous;
    s.lastActionTick=s.ticks;
    const distance=Math.abs(s.marker-s.target);
    if(distance<=1)award(s,distance===0);else hurt(s);
    const candidates=[0,1,2,3,4].filter(v=>v!==s.target);
    s.target=candidates[rand(s,candidates.length)];
    return check(s);
  }
  if((s.mode==='rhythm'||s.mode==='defend')&&action==='lane'){
    if(!Number.isInteger(value)||value<0||value>2)return previous;
    const eligible=s.entities.filter(e=>e.lane===value&&e.y>=(s.mode==='rhythm'?3.5:1.5)&&e.y<=5.9)
      .sort((a,b)=>b.y-a.y);
    if(eligible.length){
      s.entities=s.entities.filter(e=>e.id!==eligible[0].id);
      award(s,s.mode==='rhythm'&&eligible[0].y>4.4&&eligible[0].y<5.3);
    }else if(s.mode==='rhythm'){
      s.combo=0;s.outcome='move';s.eventSeq++;
    }
    return check(s);
  }
  return previous;
}
function nextArcadeStage(previous){
  if(previous.status!=='clear')return previous;
  if(previous.stage>=MAX_STAGE)return {...previous,status:'complete'};
  return startArcade(previous.mode,previous.seed,previous.stage+1,
    previous.score,Math.min(4,previous.lives+1));
}
function arcadeStagePoints(stage){
  const n=clamp(Math.trunc(stage)||1,1,MAX_STAGE);
  return 100+n*25; // One-time local mastery points per first cleared stage.
}
module.exports={MODES,CHALLENGES,MAX_STAGE,stageConfig,arcadeStagePoints,startArcade,
  tickArcade,actArcade,nextArcadeStage};
