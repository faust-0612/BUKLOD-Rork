'use strict';
/** No wallet or server rewards here: local arcade mastery achievements only. */
const {arcadeStagePoints,MAX_STAGE}=require('./arcadeCore.js');
const MAX_RECEIPTS=48;
function blankArcadeProgress(gameId){
  return {version:1,gameId,unlockedStage:1,lifetimeArcadePoints:0,
    bestRunScore:0,clearCount:0,lastStageClearAt:'',recentReceipts:[]};
}
function normalizeArcadeProgress(gameId,source){
  const fallback=blankArcadeProgress(gameId);
  if(!source||source.version!==1||source.gameId!==gameId)return fallback;
  const number=(v,defaultValue,min,max)=>
    Number.isSafeInteger(v)&&v>=min&&v<=max?v:defaultValue;
  return {
    ...fallback,unlockedStage:number(source.unlockedStage,1,1,MAX_STAGE),
    lifetimeArcadePoints:number(source.lifetimeArcadePoints,0,0,50000000000000),
    bestRunScore:number(source.bestRunScore,0,0,100000000),
    clearCount:number(source.clearCount,0,0,MAX_STAGE),
    lastStageClearAt:typeof source.lastStageClearAt==='string'?source.lastStageClearAt.slice(0,40):'',
    recentReceipts:Array.isArray(source.recentReceipts)
      ? source.recentReceipts.filter(v=>typeof v==='string'&&/^[a-z0-9.:-]{8,128}$/i.test(v)).slice(-MAX_RECEIPTS)
      :[],
  };
}
function clearArcadeStage(record,gameId,stage,score,receipt,now) {
  const old=normalizeArcadeProgress(gameId,record);
  if(!Number.isSafeInteger(stage)||stage<1||stage>MAX_STAGE) throw Error('Invalid arcade stage.');
  if(!Number.isSafeInteger(score)||score<0||score>100000000)throw Error('Invalid arcade score.');
  if(typeof receipt!=='string'||!/^[a-z0-9.:-]{8,128}$/i.test(receipt))throw Error('Invalid arcade receipt.');
  // The client can resume only a previously unlocked stage. Local state can
  // NEVER authorize real BP, money or rankings. Replaying never farms points.
  if(stage>old.unlockedStage) throw Error('Stage must be unlocked.');
  if(old.recentReceipts.includes(receipt))return old;
  if(stage<old.unlockedStage)return {
    ...old,bestRunScore:Math.max(old.bestRunScore,score),
    recentReceipts:[...old.recentReceipts,receipt].slice(-MAX_RECEIPTS),
  };
  const awarded=arcadeStagePoints(stage);
  return {
    ...old,unlockedStage:Math.min(MAX_STAGE,stage+1),
    lifetimeArcadePoints:old.lifetimeArcadePoints+awarded,
    bestRunScore:Math.max(old.bestRunScore,score),
    clearCount:old.clearCount+1,
    lastStageClearAt:typeof now==='string'?now.slice(0,40):'',
    recentReceipts:[...old.recentReceipts,receipt].slice(-MAX_RECEIPTS),
  };
}
module.exports={blankArcadeProgress,normalizeArcadeProgress,clearArcadeStage};