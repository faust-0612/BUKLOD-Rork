export type ArcadeMode = 'catch'|'lane'|'runner'|'rhythm'|'defend'|'tap'|'search'|'stack';
export type ArcadeStatus = 'playing'|'clear'|'lost'|'complete';
export type ArcadeEntity = {id:number;lane:number;y:number;good:boolean;variant:number};
export type ArcadeChallenge = 'discovery'|'precision'|'rush'|'rescue'|'combo'|'storm'|'treasure'|'endurance';
export type ArcadeState = {
  mode:ArcadeMode; seed:number; stage:number; score:number; stagePoints:number;
  stageHits:number;goal:number; challenge:ArcadeChallenge; multiplier:number;
  stageBonus:number;perfects:number;bestCombo:number;rescueGranted:boolean;
  lives:number; combo:number; lane:number; jumpUntil:number; jumpCooldownUntil:number;
  lastActionTick:number;ticks:number;remaining:number;
  entities:ArcadeEntity[];entitySeq:number;lastPatterns:string[];
  marker:number;markerDirection:number;target:number;
  cell:number; recentCells:number[];flashUntil:number;deadline:number;
  eventSeq:number;outcome:'move'|'collect'|'impact'|'unlock';status:ArcadeStatus;
};
export const MODES:readonly ArcadeMode[];
export const CHALLENGES:readonly ArcadeChallenge[];
export const MAX_STAGE:number;
export function stageConfig(mode:ArcadeMode,stage:number):{
  goal:number;duration:number;spawnInterval:number;speed:number;multiplier:number;
  challenge:ArcadeChallenge;hazardRate:number;
};
export function arcadeStagePoints(stage:number):number;
export function startArcade(mode:ArcadeMode,seed:number,stage?:number,total?:number,lives?:number):ArcadeState;
export function tickArcade(state:ArcadeState):ArcadeState;
export function actArcade(state:ArcadeState,action:'left'|'right'|'jump'|'cell'|'drop'|'lane',value?:number):ArcadeState;
export function nextArcadeStage(state:ArcadeState):ArcadeState;
