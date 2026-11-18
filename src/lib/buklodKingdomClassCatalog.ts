/** Proposed Kingdom 20-class visual collection. This is deliberately NOT an entitlement catalog. */
import manifest from '../../content/kingdom-item-classes-v1.json';
export type ClassAssetStatus = 'art_supplied'|'new_design_concept'|'unverified_eighth_concept';
export type ClassTradePolicy = 'bound'|'craft_material'|'duplicate_cosmetic';
export type KingdomClassItem = Readonly<{
  id:string;classId:string;name:string;index:number;requirement:string;
  usage:string;tradePolicy:ClassTradePolicy;source:string;asset:string|null;implemented:boolean;
}>;
export type KingdomVisualClass = Readonly<{
  id:string;title:string;subtitle:string;status:ClassAssetStatus;poster:string|null;reference:string|null;items:readonly string[];
}>;
export const VISUAL_CLASSES:readonly KingdomVisualClass[] = manifest.groups as KingdomVisualClass[];
export const VISUAL_ITEMS:readonly KingdomClassItem[] = manifest.items as KingdomClassItem[];
export function getVisualClassItems(classId:string):readonly KingdomClassItem[] {
  return VISUAL_ITEMS.filter(item=>item.classId===classId);
}
/** Do not confuse planned trade rules with a live exchange capability. */
export function tradeReadiness(item:KingdomClassItem):'DISABLED' {
  void item;
  return 'DISABLED';
}
export function validateVisualClasses():boolean {
  if(VISUAL_CLASSES.length!==20||VISUAL_ITEMS.length!==120)return false;
  const classes=new Set(VISUAL_CLASSES.map(c=>c.id));
  const ids=new Set(VISUAL_ITEMS.map(i=>i.id));
  return classes.size===20&&ids.size===120&&VISUAL_CLASSES.every(c=>c.items.length===6)&&
    VISUAL_ITEMS.every(i=>classes.has(i.classId)&&i.index>=1&&i.index<=6&&!i.implemented);
}
