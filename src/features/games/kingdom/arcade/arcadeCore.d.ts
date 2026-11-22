export type ArcadeMode = 'catch'|'lane'|'runner'|'rhythm'|'defend'|'tap'|'search'|'stack';
export type ArcadeStatus = 'playing'|'clear'|'lost';
export type ArcadeEntity = {id:number;lane:number;y:number;good:boolean;variant:number};
export type ArcadeState = {
  mode: ArcadeMode; seed:number; stage:number; score:number; stageHits:number; goal:number;
  lives:number; combo:number; lane:number; jumpUntil:number; jumpCooldownUntil:number; lastActionTick:number; ticks:number; remaining:number;
  entities:ArcadeEntity[]; entitySeq:number; marker:number; markerDirection:number;target:number;
  cell:number;flashUntil:number;deadline:number;eventSeq:number;outcome:'move'|'collect'|'impact';
  status: ArcadeStatus;
};
export const MODES: readonly ArcadeMode[];
export function startArcade(mode:ArcadeMode,seed:number,stage?:number,total?:number,lives?:number):ArcadeState;
export function tickArcade(state:ArcadeState):ArcadeState;
export function actArcade(state:ArcadeState,action:'left'|'right'|'jump'|'cell'|'drop'|'lane',value?:number):ArcadeState;
export function nextArcadeStage(state:ArcadeState):ArcadeState;
