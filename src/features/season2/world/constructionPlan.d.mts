export type ConstructionTrack='lot'|'house'|'cluster';
export type CosmeticFinish='stone'|'timber'|'garden'|'slate'|'clay'|'light';
export type CosmeticRoof='gable'|'hip'|'terrace';
export type CosmeticGround='grass'|'flower'|'stone';
export const STAGE_NAMES: readonly ['Materials','Foundation','Framework','Structure','Finishing'];
export const TRACKS:readonly ConstructionTrack[];
export const FINISHES:readonly CosmeticFinish[];
export const ROOFS:readonly CosmeticRoof[];
export const GROUNDS:readonly CosmeticGround[];
export function majorLevel(value:unknown):number;
export function constructionStage(value:unknown):number;
export function constructionPlan(track:ConstructionTrack,level:number,stage:number):Readonly<{
 track:ConstructionTrack;level:number;stage:number;stageName:string;
 estimatedDevelopmentXp:number;estimatedTimber:number;estimatedStone:number;
 estimatedMetal:number;estimatedBuildMinutes:number;needsVerifiedContribution:boolean;
 isEstimate:true;cannotCommitClientSide:true;
}>;
export function nextMilestone(level:number,stage:number,mastery?:number):{level:number;stage:number;mastery:number};
export function safeCosmetics(value:unknown):{finish:CosmeticFinish;roof:CosmeticRoof;ground:CosmeticGround};
