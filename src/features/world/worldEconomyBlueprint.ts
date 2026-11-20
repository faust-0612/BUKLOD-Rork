/**
 * BUKLOD WORLD — ILLUSTRATIVE ITEM/BUNDLE AND ARCHITECTURAL CATALOG.
 * DEV preview contracts ONLY; no backend store, personal BP debits, QMP mint,
 * user inventory mutations or wallet checkout are exposed here.
 *
 * Price version, SKU authenticity, quantity, ownership and image asset license
 * must be verified by a separately gated, server-authoritative catalog.
 */
export const WORLD_TRADING_ENABLED = false as const;
export const WORLD_BP_PURCHASES_WITH_FIAT_ENABLED = false as const;
export type WorldUnit='pc'|'kg'|'liter'|'bag'|'sheet'|'bundle'|'set'|'m2'|'roll'|'box'|'meter';
export type WorldItemCategory='structure'|'roofing'|'paint'|'flooring'|'plumbing'|'electrical'|
  'furniture'|'kitchen'|'bedroom'|'decor'|'garden'|'farming'|'pet'|'energy'|'commercial'|'community';
export type WorldItemSpec={
  sku:string;name:string;category:WorldItemCategory;unit:WorldUnit;
  samplePriceBp:number;
  bundle?:{size:number;samplePriceBp:number};
};
export const WORLD_ITEM_PREVIEWS:readonly WorldItemSpec[]=[
  {sku:'wood-plank',name:'Wood plank',category:'structure',unit:'pc',samplePriceBp:6,bundle:{size:10,samplePriceBp:55}},
  {sku:'plywood',name:'Plywood board',category:'structure',unit:'sheet',samplePriceBp:40,bundle:{size:10,samplePriceBp:375}},
  {sku:'cement-bag-50kg',name:'Portland cement 50 kg',category:'structure',unit:'bag',samplePriceBp:60,bundle:{size:5,samplePriceBp:280}},
  {sku:'hollow-block',name:'Hollow block',category:'structure',unit:'pc',samplePriceBp:3,bundle:{size:50,samplePriceBp:140}},
  {sku:'sand',name:'Fine construction sand',category:'structure',unit:'kg',samplePriceBp:2,bundle:{size:25,samplePriceBp:45}},
  {sku:'gravel',name:'Construction gravel',category:'structure',unit:'kg',samplePriceBp:2,bundle:{size:25,samplePriceBp:45}},
  {sku:'steel-bar',name:'Steel reinforcement bar',category:'structure',unit:'pc',samplePriceBp:15,bundle:{size:10,samplePriceBp:145}},
  {sku:'nail-bag',name:'Construction nails',category:'structure',unit:'bag',samplePriceBp:18},
  {sku:'metal-frame',name:'Building frame',category:'structure',unit:'set',samplePriceBp:200},
  {sku:'foundation-kit',name:'Foundation materials kit',category:'structure',unit:'set',samplePriceBp:150},
  {sku:'roof-sheet',name:'Corrugated roofing',category:'roofing',unit:'sheet',samplePriceBp:25,bundle:{size:10,samplePriceBp:235}},
  {sku:'roof-tile',name:'Roof tile',category:'roofing',unit:'pc',samplePriceBp:8,bundle:{size:25,samplePriceBp:185}},
  {sku:'roof-frame',name:'Roof truss set',category:'roofing',unit:'set',samplePriceBp:240},
  {sku:'roof-gutter',name:'Roof drainage gutter',category:'roofing',unit:'meter',samplePriceBp:10},
  {sku:'interior-paint',name:'Interior paint',category:'paint',unit:'liter',samplePriceBp:20,bundle:{size:5,samplePriceBp:95}},
  {sku:'exterior-paint',name:'Exterior paint',category:'paint',unit:'liter',samplePriceBp:25,bundle:{size:5,samplePriceBp:115}},
  {sku:'primer',name:'Wall primer',category:'paint',unit:'liter',samplePriceBp:16},
  {sku:'wood-varnish',name:'Wood varnish',category:'paint',unit:'liter',samplePriceBp:18},
  {sku:'tile-box',name:'Ceramic floor tiles',category:'flooring',unit:'box',samplePriceBp:75},
  {sku:'wood-floor',name:'Wood floor panels',category:'flooring',unit:'box',samplePriceBp:95},
  {sku:'carpet',name:'Living room carpet',category:'flooring',unit:'pc',samplePriceBp:60},
  {sku:'door',name:'Residential door',category:'structure',unit:'pc',samplePriceBp:70},
  {sku:'window',name:'Residential window',category:'structure',unit:'pc',samplePriceBp:55},
  {sku:'glass-panel',name:'Architectural glass panel',category:'structure',unit:'pc',samplePriceBp:45},
  {sku:'pipe-kit',name:'Water piping kit',category:'plumbing',unit:'set',samplePriceBp:90},
  {sku:'bathroom-kit',name:'Bathroom fixtures kit',category:'plumbing',unit:'set',samplePriceBp:120},
  {sku:'wash-basin',name:'Wash basin',category:'plumbing',unit:'pc',samplePriceBp:75},
  {sku:'water-tank',name:'Water storage tank',category:'plumbing',unit:'pc',samplePriceBp:175},
  {sku:'wiring-kit',name:'Home wiring kit',category:'electrical',unit:'set',samplePriceBp:80},
  {sku:'solar-panel',name:'Solar power panel',category:'electrical',unit:'pc',samplePriceBp:240},
  {sku:'led-light',name:'LED light fitting',category:'electrical',unit:'pc',samplePriceBp:18},
  {sku:'ceiling-fan',name:'Ceiling fan',category:'electrical',unit:'pc',samplePriceBp:95},
  {sku:'sofa',name:'Living room sofa',category:'furniture',unit:'pc',samplePriceBp:160},
  {sku:'center-table',name:'Center table',category:'furniture',unit:'pc',samplePriceBp:70},
  {sku:'tv-stand',name:'Entertainment shelf',category:'furniture',unit:'pc',samplePriceBp:110},
  {sku:'dining-set',name:'Dining table and chair set',category:'furniture',unit:'set',samplePriceBp:205},
  {sku:'storage-shelf',name:'Storage cabinet',category:'furniture',unit:'pc',samplePriceBp:100},
  {sku:'kitchen-cabinet',name:'Kitchen cabinets',category:'kitchen',unit:'set',samplePriceBp:150},
  {sku:'stove',name:'Cooking stove',category:'kitchen',unit:'pc',samplePriceBp:125},
  {sku:'refrigerator',name:'Refrigerator',category:'kitchen',unit:'pc',samplePriceBp:250},
  {sku:'utensil-set',name:'Kitchen utensils',category:'kitchen',unit:'set',samplePriceBp:35},
  {sku:'dish-set',name:'Dining dishes',category:'kitchen',unit:'set',samplePriceBp:45},
  {sku:'sink',name:'Kitchen sink',category:'kitchen',unit:'pc',samplePriceBp:80},
  {sku:'bed',name:'Comfort bed',category:'bedroom',unit:'pc',samplePriceBp:180},
  {sku:'wardrobe',name:'Bedroom wardrobe',category:'bedroom',unit:'pc',samplePriceBp:135},
  {sku:'curtain-pair',name:'Window curtains',category:'bedroom',unit:'set',samplePriceBp:35},
  {sku:'bedside-lamp',name:'Bedside lamp',category:'bedroom',unit:'pc',samplePriceBp:35},
  {sku:'mirror',name:'Interior mirror',category:'decor',unit:'pc',samplePriceBp:45},
  {sku:'painting',name:'Wall painting',category:'decor',unit:'pc',samplePriceBp:25},
  {sku:'ornamental-plant',name:'Decorative potted plant',category:'decor',unit:'pc',samplePriceBp:22},
  {sku:'curtain-fabric',name:'Curtain fabric',category:'decor',unit:'meter',samplePriceBp:15},
  {sku:'garden-planter',name:'Garden planter',category:'garden',unit:'pc',samplePriceBp:25},
  {sku:'fence-meter',name:'Garden fence',category:'garden',unit:'meter',samplePriceBp:14},
  {sku:'landscaping-kit',name:'Landscaping set',category:'garden',unit:'set',samplePriceBp:155},
  {sku:'tree-sapling',name:'Tree sapling',category:'garden',unit:'pc',samplePriceBp:25},
  {sku:'seed-bundle',name:'Crop seed pack',category:'farming',unit:'bundle',samplePriceBp:20},
  {sku:'fertile-soil',name:'Fertile planting soil',category:'farming',unit:'kg',samplePriceBp:2},
  {sku:'fertilizer',name:'Fertilizer',category:'farming',unit:'kg',samplePriceBp:5},
  {sku:'irrigation-kit',name:'Irrigation kit',category:'farming',unit:'set',samplePriceBp:120},
  {sku:'farm-tools',name:'Basic agricultural tools',category:'farming',unit:'set',samplePriceBp:85},
  {sku:'greenhouse',name:'Greenhouse structure',category:'farming',unit:'set',samplePriceBp:550},
  {sku:'animal-feed',name:'Farm animal feed',category:'farming',unit:'kg',samplePriceBp:10},
  {sku:'pet-food',name:'Pet food',category:'pet',unit:'kg',samplePriceBp:12},
  {sku:'pet-bed',name:'Pet bed',category:'pet',unit:'pc',samplePriceBp:55},
  {sku:'pet-toy',name:'Pet toy',category:'pet',unit:'pc',samplePriceBp:15},
  {sku:'fuel',name:'Fuel pack',category:'energy',unit:'liter',samplePriceBp:30},
  {sku:'energy-pack',name:'Energy supply pack',category:'energy',unit:'set',samplePriceBp:40},
  {sku:'workshop-kit',name:'Workshop station',category:'commercial',unit:'set',samplePriceBp:650},
  {sku:'market-stall',name:'Market stall structure',category:'commercial',unit:'set',samplePriceBp:430},
  {sku:'community-hall-kit',name:'Community hall structural set',category:'community',unit:'set',samplePriceBp:1400},
  {sku:'road-meter',name:'Community road materials',category:'community',unit:'meter',samplePriceBp:65},
  {sku:'park-bench',name:'Public park bench',category:'community',unit:'pc',samplePriceBp:120},
] as const;

export type WorldRecipeLine={sku:string;quantity:number};
export type WorldBlueprint={id:string;name:string;minimumLandM2:number;sampleBuildingBp:number;recipe:readonly WorldRecipeLine[]};

export function previewRecipeCost(recipe:readonly WorldRecipeLine[]):number|null {
 let total=0;
 for(const line of recipe){
  const item=WORLD_ITEM_PREVIEWS.find(x=>x.sku===line.sku);
  if(!item||!Number.isSafeInteger(line.quantity)||line.quantity<=0)return null;
  const step=line.quantity*item.samplePriceBp;
  if(!Number.isSafeInteger(step)||!Number.isSafeInteger(total+step))return null;
  total+=step;
 }
 return total;
}
function blueprint(id:string,name:string,minimumLandM2:number,recipe:readonly WorldRecipeLine[]):WorldBlueprint{
 const total=previewRecipeCost(recipe);
 if(total===null||total===0)throw new Error('Invalid preview blueprint material recipe '+id);
 return {id,name,minimumLandM2,sampleBuildingBp:total,recipe};
}
/** Full, purchasable-design *previews*: all house tiers have real material needs.
 * These sample building sets are simplified game resources, not structural engineering plans.
 * No tile or house asset may actually be built until the item catalog and art pack are approved. */
export const WORLD_BLUEPRINT_PREVIEWS:readonly WorldBlueprint[]=[
 blueprint('starter-bungalow','Starter Bungalow',50,[
  {sku:'wood-plank',quantity:30},{sku:'cement-bag-50kg',quantity:10},{sku:'hollow-block',quantity:80},
  {sku:'steel-bar',quantity:10},{sku:'roof-sheet',quantity:12},{sku:'interior-paint',quantity:5},
  {sku:'door',quantity:1},{sku:'window',quantity:2},
 ]),
 blueprint('family-residence','Family Residence',90,[
  {sku:'wood-plank',quantity:70},{sku:'cement-bag-50kg',quantity:20},{sku:'hollow-block',quantity:180},
  {sku:'steel-bar',quantity:25},{sku:'roof-sheet',quantity:25},{sku:'interior-paint',quantity:12},
  {sku:'exterior-paint',quantity:9},{sku:'door',quantity:3},{sku:'window',quantity:6},
  {sku:'tile-box',quantity:10},{sku:'pipe-kit',quantity:2},{sku:'wiring-kit',quantity:2},
  {sku:'kitchen-cabinet',quantity:1},{sku:'bed',quantity:2},{sku:'curtain-pair',quantity:4},
 ]),
 blueprint('luxury-villa','Luxury Villa',150,[
  {sku:'cement-bag-50kg',quantity:45},{sku:'hollow-block',quantity:300},{sku:'steel-bar',quantity:70},
  {sku:'roof-sheet',quantity:45},{sku:'roof-frame',quantity:3},{sku:'wood-plank',quantity:130},
  {sku:'glass-panel',quantity:20},{sku:'door',quantity:7},{sku:'window',quantity:16},
  {sku:'exterior-paint',quantity:25},{sku:'interior-paint',quantity:28},
  {sku:'tile-box',quantity:30},{sku:'pipe-kit',quantity:4},{sku:'bathroom-kit',quantity:4},
  {sku:'wiring-kit',quantity:4},{sku:'solar-panel',quantity:3},
  {sku:'kitchen-cabinet',quantity:2},{sku:'bed',quantity:4},{sku:'sofa',quantity:2},
  {sku:'curtain-pair',quantity:12},{sku:'landscaping-kit',quantity:2},
 ]),
 blueprint('grand-mansion','Grand Mansion',350,[
  {sku:'cement-bag-50kg',quantity:150},{sku:'hollow-block',quantity:800},{sku:'steel-bar',quantity:190},
  {sku:'roof-sheet',quantity:110},{sku:'roof-frame',quantity:8},{sku:'wood-plank',quantity:400},
  {sku:'glass-panel',quantity:70},{sku:'door',quantity:18},{sku:'window',quantity:40},
  {sku:'exterior-paint',quantity:90},{sku:'interior-paint',quantity:80},
  {sku:'tile-box',quantity:95},{sku:'wood-floor',quantity:25},
  {sku:'pipe-kit',quantity:12},{sku:'bathroom-kit',quantity:9},
  {sku:'wiring-kit',quantity:12},{sku:'solar-panel',quantity:10},{sku:'water-tank',quantity:4},
  {sku:'kitchen-cabinet',quantity:5},{sku:'dining-set',quantity:3},{sku:'bed',quantity:12},
  {sku:'sofa',quantity:6},{sku:'wardrobe',quantity:12},{sku:'curtain-pair',quantity:30},
  {sku:'landscaping-kit',quantity:8},{sku:'tree-sapling',quantity:20},
 ]),
] as const;

export function estimatePreviewLandCost(areaM2:number,pricePerM2:number):number|null{
 if(!Number.isFinite(areaM2)||!Number.isFinite(pricePerM2)||areaM2<=0||pricePerM2<0)return null;
 const cost=Math.ceil(areaM2*pricePerM2);
 return Number.isSafeInteger(cost)?cost:null;
}

export type WorldPurchaseMode='unit'|'bundle'|'best_value';
export type WorldItemPurchaseQuote={
 sku:string; unit:WorldUnit;requestedQuantity:number;deliveredQuantity:number;
 mode:WorldPurchaseMode;bundleCount:number;individualUnits:number;
 sampleCostBp:number;previewOnly:true;
};
export function quoteWorldItemPurchase(
 sku:string,quantity:number,mode:WorldPurchaseMode='best_value',
):WorldItemPurchaseQuote|null{
 const item=WORLD_ITEM_PREVIEWS.find(x=>x.sku===sku);
 if(!item||!Number.isFinite(quantity)||quantity<=0||!['unit','bundle','best_value'].includes(mode))return null;
 const fractional=['kg','liter','m2','meter'].includes(item.unit);
 const scaled=Math.round(quantity*100);
 if(!Number.isSafeInteger(scaled)||scaled<=0||Math.abs(quantity-scaled/100)>0.000001)return null;
 if(!fractional && scaled%100!==0)return null;
 const bundle=item.bundle;
 if(mode==='bundle'&&!bundle)return null;
 if(bundle && (!Number.isSafeInteger(bundle.size)||bundle.size<=0||!Number.isSafeInteger(bundle.samplePriceBp)||bundle.samplePriceBp<0))return null;
 // Constant-time bundle optimization: an honest bundle discount creates a
 // linear cost curve, so only zero, floor, and ceil pack counts can win.
 // Avoid iterating over unbounded quantities on low-memory mobile devices.
 if(quantity>100000)return null;
 const maxBundles=bundle?Math.ceil(quantity/bundle.size):0;
 const floorBundles=bundle?Math.floor(quantity/bundle.size):0;
 const candidates=mode==='unit'?[0]:mode==='bundle'?[maxBundles]:[0,floorBundles,maxBundles];
 let best:{bundleCount:number;individualUnits:number;deliveredQuantity:number;cost:number}|null=null;
 for(const i of new Set(candidates)){
  if(mode==='bundle'&&i===0)continue;
  const extra=Math.max(0,quantity-i*(bundle?.size??0));
  const individualUnits=mode==='bundle'?0:extra;
  if(mode==='bundle'&&extra>0)continue;
  const deliveredQuantity=individualUnits+i*(bundle?.size??0);
  const cost=Math.ceil(individualUnits*item.samplePriceBp+i*(bundle?.samplePriceBp??0));
  if(!Number.isSafeInteger(cost))return null;
  if(mode==='best_value'||mode==='unit'||mode==='bundle'){
    if(!best||cost<best.cost||(cost===best.cost&&deliveredQuantity<best.deliveredQuantity))
      best={bundleCount:i,individualUnits,deliveredQuantity,cost};
  }
 }
 if(!best)return null;
 return {sku,unit:item.unit,requestedQuantity:quantity,deliveredQuantity:best.deliveredQuantity,
   mode,bundleCount:best.bundleCount,individualUnits:best.individualUnits,
   sampleCostBp:best.cost,previewOnly:true};
}
