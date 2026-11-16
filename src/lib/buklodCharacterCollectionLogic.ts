/* Server-authoritative bridge between Character tasks, items and Kingdom visuals.
 * The canonical catalogue is NOT an inventory or a reward ledger.
 */
import {
 BUKLOD_CHARACTER_WORLD_IDS, BUKLOD_CHARACTER_COLLECTIBLE_ITEMS,
 BUKLOD_CHARACTER_STAGES, BUKLOD_CHARACTER_BADGES, BUKLOD_COLLECTIBLE_SLOT_LABELS,
 buklodStageMasteryBadge, type BuklodCharacterWorldId,
} from './buklodCharacterWorldCatalog';

export type OwnedStoryItem = {
 characterId:string; level:number; itemIndex:number; collectibleId:string; redeemedAt:string|null;
};
export type TaskBadge = {
 collectible_id:string; level_no:number; badge_name:string; earned:boolean;
 earned_at?:string|null; requirement?:unknown; secret?:boolean;
};

export function storyItemKey(id:BuklodCharacterWorldId,level:number,index:number):string {
 if (!BUKLOD_CHARACTER_WORLD_IDS.includes(id) || !Number.isInteger(level) || level<1 || level>20 ||
     !Number.isInteger(index) || index<1 || index>5) throw new Error('Invalid Character story item');
 return id+':L'+String(level).padStart(2,'0')+':I'+String(index).padStart(2,'0');
}
export function storyItemAssetPath(id:BuklodCharacterWorldId,level:number,index:number):string {
 storyItemKey(id,level,index);
 return 'character-collectibles/'+id+'/l'+String(level).padStart(2,'0')+'-i'+String(index).padStart(2,'0')+'.webp';
}
export function storyStageItems(id:BuklodCharacterWorldId,level:number) {
 if (!BUKLOD_CHARACTER_WORLD_IDS.includes(id) || !Number.isInteger(level) || level<1 || level>20)
  throw new Error('Invalid Character stage');
 return BUKLOD_CHARACTER_COLLECTIBLE_ITEMS[id][level-1].map((name,index)=>({
  key:storyItemKey(id,level,index+1), name, level, index:index+1,
  slot:BUKLOD_COLLECTIBLE_SLOT_LABELS[index],
  assetPath:storyItemAssetPath(id,level,index+1),
 }));
}
/* Only redeemed items with an actual server collectible ID count. */
export function verifiedStoryKeys(items:readonly OwnedStoryItem[],id:BuklodCharacterWorldId):Set<string> {
 const keys=new Set<string>();
 for(const item of items) {
  if(item.characterId!==id || !item.collectibleId || !item.redeemedAt ||
    !Number.isInteger(item.level) || !Number.isInteger(item.itemIndex) ||
    item.level<1 || item.level>20 || item.itemIndex<1 || item.itemIndex>5) continue;
  keys.add(storyItemKey(id,item.level,item.itemIndex));
 }
 return keys;
}
export function storyStageProgress(id:BuklodCharacterWorldId,level:number,owned:ReadonlySet<string>) {
 const count=storyStageItems(id,level).filter(item=>owned.has(item.key)).length;
 return {owned:count,total:5,mastered:count===5};
}
export function savedCharacterLevel(
 levels:Partial<Record<BuklodCharacterWorldId,number>>|undefined,
 id:BuklodCharacterWorldId,active:BuklodCharacterWorldId,activeLevel:number,
):number {
 const value=id===active?activeLevel:levels?.[id];
 const n=Number(value);
 return Number.isFinite(n)&&n>=1?Math.min(20,Math.floor(n)):1;
}
export function characterStageLabels(id:BuklodCharacterWorldId,level:number) {
 return {title:BUKLOD_CHARACTER_STAGES[id][level-1],
  signature:BUKLOD_CHARACTER_BADGES[id].signature,
  badge:buklodStageMasteryBadge(id,level)};
}
const METRICS:Record<string,string>={
 character_public_actions:'eligible meaningful public Wall activities',
 character_public_post:'meaningful public Wall posts',
 character_public_comment:'eligible public Wall comments',
 character_public_reaction:'eligible public Wall reactions',
 character_public_share:'eligible public Wall shares',
 character_public_active_weeks:'active weeks',
 reading_completed:'verified Bible readings',
 lesson_completed:'verified lessons', devotion_completed:'verified devotions',
 event_attended:'verified event attendance', report_submitted:'accepted reports',
};
export function describeCharacterTaskRequirement(value:unknown,secret=false):string {
 if(secret)return 'Hidden task — complete real BUKLOD activities to discover it.';
 if(!value||typeof value!=='object'||Array.isArray(value))return 'Awaiting verified task requirements.';
 const root=value as Record<string,unknown>, sections:string[]=[];
 for(const mode of ['all','any'] as const){
  const rows=root[mode];if(!Array.isArray(rows))continue;
  const terms=rows.flatMap((row:unknown)=>{
   if(!row||typeof row!=='object')return [];
   const record=row as Record<string,unknown>, key=typeof record.metric==='string'?record.metric:'';
   const goal=Number(record.gte??record.count);
   if(!key||!Number.isSafeInteger(goal)||goal<=0)return [];
   return [String(goal)+' '+(METRICS[key]??key.replace(/_/g,' '))];
  });
  if(terms.length) sections.push((mode==='all'?'Complete: ':'Any: ')+terms.join(mode==='all'?' + ':' OR '));
 }
 return sections.join(' | ')||'Awaiting verified task requirements.';
}
export const STORY_COLLECTION_TOTAL=1300;
