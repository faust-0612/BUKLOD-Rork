/** Read-only collection guide based on the canonical 20-class, 120-item owner poster.
 * NO live inventory: official Character V2, BP, Shards, QMP and ads stay untouched.
 */
import data from '../../content/kingdom-item-atlas-core-v2.json';

export type CoreAtlasTrade = 'bound'|'materials'|'duplicate_cosmetic';
export type CoreAtlasClass = Readonly<{
 id:string;title:string;displayName:string;mechanic:string;
 baseRequirement:string;use:string;tradePolicy:CoreAtlasTrade;
 sourceArtId:string;artSha256:string;items:readonly string[];
}>;
export type CoreAtlasItem = Readonly<{id:string;classId:string;name:string;index:number;
  requirement:string;usage:string;trade:'DISABLED';status:'ART_PREVIEW'}>;
export const KINGDOM_CORE_CLASSES:readonly CoreAtlasClass[]=data.classes as CoreAtlasClass[];
export const KINGDOM_CORE_ITEM_COUNT=120;
export function coreAtlasItem(classId:string,index:number):CoreAtlasItem {
 const group=KINGDOM_CORE_CLASSES.find(c=>c.id===classId);
 if(!group||!Number.isInteger(index)||index<0||index>=group.items.length)throw Error('Unknown Kingdom item');
 // Requirements are design targets until authenticated server rules authorize them.
 return {
   id:group.id+'-'+String(index+1).padStart(2,'0'), classId:group.id, name:group.items[index] as string,index,
   requirement:group.baseRequirement,
   usage:group.use,
   trade:'DISABLED',status:'ART_PREVIEW',
 };
}
export function validateKingdomCoreAtlas(){
 const names=new Set<string>();const ids=new Set<string>();
 if(KINGDOM_CORE_CLASSES.length!==20)return false;
 for(const c of KINGDOM_CORE_CLASSES){
   if(ids.has(c.id)||c.items.length!==6||!c.baseRequirement||!c.use)return false;
   ids.add(c.id);
   for(let i=0;i<6;i++){
     const item=coreAtlasItem(c.id,i);if(names.has(item.id)||!item.name||item.trade!=='DISABLED')return false;
     names.add(item.id);
   }
 }
 return names.size===KINGDOM_CORE_ITEM_COUNT;
}
