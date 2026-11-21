import {
 WORLD_BP_PURCHASES_WITH_FIAT_ENABLED,WORLD_TRADING_ENABLED,
 WORLD_ITEM_PREVIEWS,WORLD_BLUEPRINT_PREVIEWS,
 quoteWorldItemPurchase,previewRecipeCost,estimatePreviewLandCost,
} from '@/features/world/worldEconomyBlueprint';

describe('BUKLOD World materials / item pricing (preview only)',()=>{
 it('does not sell BP for fiat or enable unverified trades',()=>{
  expect(WORLD_BP_PURCHASES_WITH_FIAT_ENABLED).toBe(false);
  expect(WORLD_TRADING_ENABLED).toBe(false);
 });
 it('has unique per-unit material catalog including room, roofing, farm and pet options',()=>{
  expect(WORLD_ITEM_PREVIEWS.length).toBeGreaterThanOrEqual(65);
  expect(new Set(WORLD_ITEM_PREVIEWS.map(i=>i.sku)).size).toBe(WORLD_ITEM_PREVIEWS.length);
  for(const category of ['structure','roofing','paint','kitchen','bedroom','furniture','decor','farming','pet','community']){
   expect(WORLD_ITEM_PREVIEWS.some(i=>i.category===category)).toBe(true);
  }
  expect(WORLD_ITEM_PREVIEWS.every(x=>x.samplePriceBp>=0&&Number.isSafeInteger(x.samplePriceBp))).toBe(true);
 });
 it('all four house designs have complete valid priced material recipes',()=>{
  expect(WORLD_BLUEPRINT_PREVIEWS.map(x=>x.id)).toEqual([
   'starter-bungalow','family-residence','luxury-villa','grand-mansion',
  ]);
  for(const b of WORLD_BLUEPRINT_PREVIEWS){
   expect(b.recipe.length).toBeGreaterThan(0);
   expect(previewRecipeCost(b.recipe)).toBe(b.sampleBuildingBp);
  }
  expect(WORLD_BLUEPRINT_PREVIEWS[0].sampleBuildingBp).toBe(1750);
  expect(WORLD_BLUEPRINT_PREVIEWS[3].sampleBuildingBp).toBeGreaterThan(WORLD_BLUEPRINT_PREVIEWS[2].sampleBuildingBp);
 });
 it('supports piece, bundle and best-value pricing without hidden changes',()=>{
  const piece=quoteWorldItemPurchase('wood-plank',10,'unit');
  const bundle=quoteWorldItemPurchase('wood-plank',10,'bundle');
  const best=quoteWorldItemPurchase('wood-plank',10,'best_value');
  expect(piece?.sampleCostBp).toBe(60);
  expect(bundle?.sampleCostBp).toBe(55);
  expect(best?.sampleCostBp).toBe(55);
  expect(quoteWorldItemPurchase('wood-plank',5,'best_value')?.sampleCostBp).toBe(30);
 });
 it('allows fractional kg/liter, rejects fractional pieces and inflated quotes',()=>{
  expect(quoteWorldItemPurchase('sand',0.5,'unit')?.sampleCostBp).toBe(1);
  expect(quoteWorldItemPurchase('interior-paint',1.5,'unit')?.sampleCostBp).toBe(30);
  expect(quoteWorldItemPurchase('wood-plank',0.5,'unit')).toBeNull();
  expect(quoteWorldItemPurchase('sand',0,'unit')).toBeNull();
  expect(quoteWorldItemPurchase('sand',-5,'unit')).toBeNull();
  expect(quoteWorldItemPurchase('sand',Number.POSITIVE_INFINITY,'unit')).toBeNull();
  expect(quoteWorldItemPurchase('sand',0.001,'unit')).toBeNull();
  expect(estimatePreviewLandCost(50,12)).toBe(600);
  expect(estimatePreviewLandCost(Number.MAX_VALUE,12)).toBeNull();
 });
});
