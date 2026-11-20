import {
  WORLD_BLUEPRINT_PREVIEWS, WORLD_ITEM_PREVIEWS,
  type WorldItemSpec, type WorldBlueprint, type WorldRecipeLine,
} from './worldEconomyBlueprint';

/**
 * Preview-only land / house quote. One-click purchasing must NOT invoke this
 * as an authority: real server must verify land titles, zoning, inventory lots,
 * current price versions, permissions and concurrent reserve/settle.
 */
export type WorldPlotQuoteInput={
  plotId:string;
  areaM2:number;
  zone:'residential'|'agricultural'|'community'|'commercial';
  ownership:'owned'|'community_permitted'|'not_acquired';
  sideAMeters:number;
  sideBMeters:number;
  samplePricePerM2Bp:number;
};
export type WorldInventoryQuantity={
  sku:string;
  quantity:number;
};
export type WorldBuildNeed={
  sku:string;
  name:string;
  required:number;
  owned:number;
  shortage:number;
  unit:string;
  /** Preview catalog rate per unit; not a live quote. */
  sampleUnitBp:number;
  sampleShortfallBp:number;
};
export type WorldBuildPlan={
  blueprintId:string;
  blueprintName:string;
  phase:'preview_only';
  landBp:number;
  materialsBp:number;
  sampleTotalBp:number;
  requirements:readonly WorldBuildNeed[];
  missingRequirements:readonly WorldBuildNeed[];
  canPlaceOnPlot:boolean;
  canBuildUsingInventory:boolean;
  reasons:readonly string[];
};
const whole=(n:number):boolean=>Number.isSafeInteger(n)&&n>=0;
const positive=(n:number):boolean=>whole(n)&&n>0;
const safeAdd=(x:number,y:number):number|null=>{
  const z=x+y; return Number.isSafeInteger(z)?z:null;
};
function recipePrice(recipe:readonly WorldRecipeLine[],catalog:readonly WorldItemSpec[]):{
  requirements:WorldBuildNeed[];error:string|null;
}{
  const res:WorldBuildNeed[]=[];
  const seen=new Set<string>();
  for(const row of recipe){
    if(!row.sku || seen.has(row.sku)||!positive(row.quantity))
      return {requirements:[],error:'Invalid or repeated construction item.'};
    seen.add(row.sku);
    const item=catalog.find(x=>x.sku===row.sku);
    if(!item||!whole(item.samplePriceBp))
      return {requirements:[],error:'Unknown or unpriced construction material.'};
    const cost=row.quantity*item.samplePriceBp;
    if(!Number.isSafeInteger(cost))return {requirements:[],error:'Price arithmetic overflow.'};
    res.push({sku:row.sku,name:item.name,required:row.quantity,
      owned:0,shortage:row.quantity,unit:item.unit,
      sampleUnitBp:item.samplePriceBp,sampleShortfallBp:cost});
  }
  return {requirements:res,error:null};
}

/** Costs calculated in integer BP; no unwarranted promise of live price. */
export function planWorldBuilding(
  plot:WorldPlotQuoteInput,
  blueprint:WorldBlueprint,
  inventory:readonly WorldInventoryQuantity[],
  catalog:readonly WorldItemSpec[]=WORLD_ITEM_PREVIEWS,
):WorldBuildPlan {
  const reasons:string[]=[];
  if(!plot?.plotId?.trim()||!Number.isFinite(plot.areaM2)||plot.areaM2<=0||
     !Number.isFinite(plot.sideAMeters)||!Number.isFinite(plot.sideBMeters)||
     plot.sideAMeters<=0||plot.sideBMeters<=0||
     !whole(plot.samplePricePerM2Bp))
    reasons.push('Missing land or invalid virtual plot dimension/price.');
  const actualArea=plot?.sideAMeters*plot?.sideBMeters;
  if(!Number.isFinite(actualArea)||actualArea<=0||Math.abs(actualArea-plot.areaM2)>0.001)
    reasons.push('Lot dimensions and area do not match.');
  if(!['residential','agricultural','community','commercial'].includes(plot?.zone))
    reasons.push('Invalid zoning class.');
  if(plot?.zone!=='residential' && plot?.zone!=='community')
    reasons.push('This home blueprint needs residential/community zoning.');
  if(plot?.ownership!=='owned' && plot?.ownership!=='community_permitted')
    reasons.push('Land ownership or community permission is required.');
  if(!blueprint?.id?.trim()||!blueprint?.name?.trim()||
      !Number.isFinite(blueprint.minimumLandM2)||blueprint.minimumLandM2<=0)
    reasons.push('Invalid house blueprint.');
  if(plot?.areaM2<blueprint?.minimumLandM2)
    reasons.push('Not enough virtual land for the selected house and setbacks.');
  if(!Array.isArray(blueprint?.recipe)||blueprint.recipe.length===0)
    reasons.push('The blueprint has no approved material recipe yet.');
  if(!Array.isArray(inventory)||inventory.length>1000||
     inventory.some(x=>!x.sku||!whole(x.quantity)))
    reasons.push('Invalid inventory quantities.');
  const {requirements:baseReq,error}=recipePrice(blueprint?.recipe??[],catalog);
  if(error)reasons.push(error);
  const itemMap=new Map<string,number>();
  for(const item of inventory||[]){
    const next=(itemMap.get(item.sku)||0)+item.quantity;
    if(!Number.isSafeInteger(next)){reasons.push('Inventory quantity overflow.');break;}
    itemMap.set(item.sku,next);
  }
  const requirements=baseReq.map(line=>{
    const owned=Math.min(line.required,itemMap.get(line.sku)||0);
    const shortage=line.required-owned;
    const shortfall=shortage*line.sampleUnitBp;
    if(!Number.isSafeInteger(shortfall))reasons.push('Material price overflow.');
    return {...line,owned,shortage,sampleShortfallBp:shortfall};
  });
  const materialsBp=requirements.reduce((sum,line)=>sum+line.sampleShortfallBp,0);
  if(!Number.isSafeInteger(materialsBp))reasons.push('Total material price overflow.');
  const landBp=plot?.ownership==='not_acquired'
    ?Math.ceil(plot.areaM2*plot.samplePricePerM2Bp):0;
  if(!Number.isSafeInteger(landBp))reasons.push('Virtual plot price overflow.');
  const sampleTotalBp=safeAdd(landBp,materialsBp);
  if(sampleTotalBp===null)reasons.push('Combined estimate overflow.');
  const canPlaceOnPlot=!reasons.some(r=>/land|zoning|plot|area|dimension|ownership|permission/i.test(r));
  return {
    blueprintId:blueprint?.id||'',blueprintName:blueprint?.name||'',
    phase:'preview_only',landBp:Number.isSafeInteger(landBp)?landBp:0,
    materialsBp:Number.isSafeInteger(materialsBp)?materialsBp:0,
    sampleTotalBp:sampleTotalBp??0,
    requirements,missingRequirements:requirements.filter(x=>x.shortage>0),
    canPlaceOnPlot:canPlaceOnPlot&&reasons.length===0,
    canBuildUsingInventory:reasons.length===0&&requirements.every(x=>x.shortage===0),
    reasons,
  };
}
export function starterWorldBuildingPlan(plot:WorldPlotQuoteInput,inventory:readonly WorldInventoryQuantity[]){
  const starter=WORLD_BLUEPRINT_PREVIEWS.find(x=>x.id==='starter-bungalow');
  return starter?planWorldBuilding(plot,starter,inventory):null;
}
