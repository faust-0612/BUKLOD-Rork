/**
 * Deterministic Season 2 construction PLANNING model.
 * Neither calculated requirements nor a client preview is a server-side unlock,
 * BP ledger, inventory debit, identity proof, or property ownership record.
 */
export const STAGE_NAMES=Object.freeze(['Materials','Foundation','Framework','Structure','Finishing']);
export const TRACKS=Object.freeze(['lot','house','cluster']);
export const FINISHES=Object.freeze(['stone','timber','garden','slate','clay','light']);
export const ROOFS=Object.freeze(['gable','hip','terrace']);
export const GROUNDS=Object.freeze(['grass','flower','stone']);
export const FENCES=Object.freeze(['wood','iron','hedge']);
export const WINDOWS=Object.freeze(['classic','panorama','arched']);
export const LIGHTS=Object.freeze(['warm','starlight','garden']);
export function majorLevel(value) {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(1,Math.min(10,Math.trunc(n))):1;
}
export function constructionStage(value) {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(4,Math.trunc(n))):0;
}
export function constructionPlan(track,level,stage) {
  if(!TRACKS.includes(track))throw new Error('Unknown construction track');
  const l=majorLevel(level), s=constructionStage(stage);
  const factor={lot:1,house:1.45,cluster:2.5}[track];
  const effort=Math.ceil((18+6*l*l+9*s*(l+1))*factor);
  return Object.freeze({
    track,level:l,stage:s,stageName:STAGE_NAMES[s],
    estimatedDevelopmentXp:effort,
    estimatedTimber:Math.ceil((3+l*2+s*2)*factor),
    estimatedStone:Math.ceil((2+l*l+s*2)*factor),
    estimatedMetal:Math.ceil((l+s+1)*factor/2),
    estimatedBuildMinutes:Math.ceil((5+l*l*3+s*l*2)*factor),
    needsVerifiedContribution:track==='cluster',
    isEstimate:true,
    cannotCommitClientSide:true,
  });
}
export function nextMilestone(level,stage,mastery=0) {
  const l=majorLevel(level),s=constructionStage(stage);
  if(s<4)return {level:l,stage:s+1,mastery:0};
  if(l<10)return {level:l+1,stage:0,mastery:0};
  const m=Number.isFinite(Number(mastery))?Math.max(0,Math.trunc(Number(mastery))):0;
  return {level:10,stage:0,mastery:Math.min(Number.MAX_SAFE_INTEGER,m+1)};
}
export function safeCosmetics(value) {
  const v=value && typeof value==='object'&&!Array.isArray(value)?value:{};
  return {
    finish:FINISHES.includes(v.finish)?v.finish:'stone',
    roof:ROOFS.includes(v.roof)?v.roof:'gable',
    ground:GROUNDS.includes(v.ground)?v.ground:'grass',
    fence:FENCES.includes(v.fence)?v.fence:'wood',
    windows:WINDOWS.includes(v.windows)?v.windows:'classic',
    lights:LIGHTS.includes(v.lights)?v.lights:'warm',
  };
}

/** Each selected level carries one unique, cumulative visible development feature.
 * The stage 0-3 blueprint only shows previous-tier amenities; stage 4 adds the
 * new tier. This is deliberately a DRAWING, never a claim about earned inventory.
 */
export function visualDevelopmentFeatures(track,level,stage) {
 if(!TRACKS.includes(track))throw new Error('Unknown construction track');
 const count=Math.max(0,majorLevel(level)-(constructionStage(stage)===4?0:1));
 return Object.freeze(Array.from({length:count},(_,i)=>track+'-amenity-'+String(i+1).padStart(2,'0')));
}

/** Mastery changes only reusable cosmetic combinations, not PvP power, BP or ownership. */
export function safeMastery(value) {
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>0?n:0;
}
export function masteryMotifCount(value) {return Math.min(8,safeMastery(value));}
