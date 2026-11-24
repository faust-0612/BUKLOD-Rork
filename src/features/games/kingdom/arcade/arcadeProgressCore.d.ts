export type ArcadeProgressRecord={
  version:1;gameId:string;unlockedStage:number;lifetimeArcadePoints:number;
  bestRunScore:number;clearCount:number;lastStageClearAt:string;recentReceipts:string[];
};
export function blankArcadeProgress(gameId:string):ArcadeProgressRecord;
export function normalizeArcadeProgress(gameId:string,source:unknown):ArcadeProgressRecord;
export function clearArcadeStage(record:ArcadeProgressRecord,gameId:string,stage:number,
  score:number,receipt:string,now:string):ArcadeProgressRecord;
