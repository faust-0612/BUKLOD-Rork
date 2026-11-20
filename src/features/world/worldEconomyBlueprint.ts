/**
 * PREVIEW-ONLY WORLD ECONOMY CONTRACT (no purchase/transfer endpoints).
 * World prices are illustrative and are NOT connected to BP/QMP or Finance.
 * Canonical BP, QMP and Cash histories remain solely in their existing authorities.
 */
export const WORLD_TRADING_ENABLED = false as const;
export type WorldUnit='pc'|'kg'|'liter'|'bag'|'sheet'|'bundle'|'set'|'m2';
export type WorldItemCategory='structure'|'roofing'|'paint'|'furniture'|'kitchen'|'decor'|'farming'|'pet'|'energy';
export type WorldItemSpec={sku:string;name:string;category:WorldItemCategory;unit:WorldUnit;samplePriceBp:number;bundle?:{size:number;samplePriceBp:number}};
export const WORLD_ITEM_PREVIEWS:readonly WorldItemSpec[]=[
 {sku:'wood-plank',name:'Wood plank',category:'structure',unit:'pc',samplePriceBp:6,bundle:{size:10,samplePriceBp:55}},
 {sku:'cement-bag-50kg',name:'Cement 50kg',category:'structure',unit:'bag',samplePriceBp:60},
 {sku:'hollow-block',name:'Hollow block',category:'structure',unit:'pc',samplePriceBp:3},
 {sku:'steel-bar',name:'Steel bar',category:'structure',unit:'pc',samplePriceBp:15},
 {sku:'roof-sheet',name:'Corrugated roofing',category:'roofing',unit:'sheet',samplePriceBp:25},
 {sku:'interior-paint',name:'Interior paint',category:'paint',unit:'liter',samplePriceBp:20},
 {sku:'window',name:'Window',category:'structure',unit:'pc',samplePriceBp:55},
 {sku:'door',name:'Door',category:'structure',unit:'pc',samplePriceBp:70},
 {sku:'sofa',name:'Sofa',category:'furniture',unit:'pc',samplePriceBp:160},
 {sku:'bed',name:'Bed',category:'furniture',unit:'pc',samplePriceBp:180},
 {sku:'utensil-set',name:'Kitchen utensil set',category:'kitchen',unit:'set',samplePriceBp:35},
 {sku:'garden-planter',name:'Garden planter',category:'decor',unit:'pc',samplePriceBp:25},
 {sku:'seed-bundle',name:'Crop seeds',category:'farming',unit:'bundle',samplePriceBp:20},
 {sku:'pet-food',name:'Pet food',category:'pet',unit:'kg',samplePriceBp:12},
 {sku:'fuel',name:'Fuel pack',category:'energy',unit:'liter',samplePriceBp:30},
] as const;
export type WorldRecipeLine={sku:string;quantity:number};
export type WorldBlueprint={id:string;name:string;minimumLandM2:number;sampleBuildingBp:number;recipe:readonly WorldRecipeLine[]};
export const WORLD_BLUEPRINT_PREVIEWS:readonly WorldBlueprint[]=[
 {id:'starter-bungalow',name:'Starter Bungalow',minimumLandM2:50,sampleBuildingBp:1750,recipe:[
 {sku:'wood-plank',quantity:30},{sku:'cement-bag-50kg',quantity:10},{sku:'hollow-block',quantity:80},
 {sku:'steel-bar',quantity:10},{sku:'roof-sheet',quantity:12},{sku:'interior-paint',quantity:5},
 {sku:'door',quantity:1},{sku:'window',quantity:2}]},
 {id:'family-residence',name:'Family Residence',minimumLandM2:90,sampleBuildingBp:4500,recipe:[]},
 {id:'luxury-villa',name:'Luxury Villa',minimumLandM2:150,sampleBuildingBp:10000,recipe:[]},
 {id:'grand-mansion',name:'Grand Mansion',minimumLandM2:350,sampleBuildingBp:30000,recipe:[]},
] as const;
export function estimatePreviewLandCost(areaM2:number, pricePerM2:number):number|null {
 if(!Number.isFinite(areaM2)||!Number.isFinite(pricePerM2)||areaM2<=0||pricePerM2<0)return null;
 return Math.round(areaM2*pricePerM2*100)/100;
}
export function previewRecipeCost(recipe:readonly WorldRecipeLine[]):number|null {
 let total=0;
 for(const line of recipe){
  const item=WORLD_ITEM_PREVIEWS.find(x=>x.sku===line.sku);
  if(!item||!Number.isSafeInteger(line.quantity)||line.quantity<=0)return null;
  total+=line.quantity*item.samplePriceBp;
 }
 return total;
}
