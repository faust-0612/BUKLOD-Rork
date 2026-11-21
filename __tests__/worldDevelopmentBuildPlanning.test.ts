import {
 WORLD_DEVELOPMENT_ENABLED,worldTier,nextWorldAdvance,applyPreviewWorldAdvance,
 type WorldDevelopmentTrack,type WorldDevelopmentState,
} from '@/features/world/worldDevelopmentCatalog';
import {starterWorldBuildingPlan,planWorldBuilding} from '@/features/world/worldBuildPlanning';
import {WORLD_BLUEPRINT_PREVIEWS} from '@/features/world/worldEconomyBlueprint';

describe('BUKLOD World permanent property development',()=>{
 it('is preview-only; none of ten levels purchases live BP',()=>{
   expect(WORLD_DEVELOPMENT_ENABLED).toBe(false);
   const tracks:WorldDevelopmentTrack[]=['personal_lot','house','farm','cluster','organization'];
   for(const track of tracks){
     for(let level=1;level<=10;level++){
       const tier=worldTier(track,level);
       expect(tier?.level).toBe(level);
       expect(tier?.stages).toHaveLength(3);
       if(level>1){
         expect(tier!.minimumLandM2).toBeGreaterThan(worldTier(track,level-1)!.minimumLandM2);
         expect(tier!.sampleBpForFullTier).toBeGreaterThan(worldTier(track,level-1)!.sampleBpForFullTier);
       }
     }
   }
 });
 it('moves sequentially through 3 visible construction steps then commits a level',()=>{
   let state:WorldDevelopmentState={track:'house',level:0,stage:0,revision:0};
   for(let stage=1;stage<=3;stage++){
     const step=nextWorldAdvance(state);
     expect(step?.nextLevel).toBe(1);
     expect(step?.nextStage).toBe(stage);
     const out=applyPreviewWorldAdvance(state,{
       worldId:'house-1',approvedArtId:step!.sampleArtStageId,level:1,
       stage,revision:state.revision+1,serverVerified:true,
     },1000);
     expect(out.ok).toBe(true);
     if(out.ok)state=out.next;
   }
   expect(state).toEqual({track:'house',level:1,stage:0,revision:3});
   expect(nextWorldAdvance(state)?.nextLevel).toBe(2);
 });
 it('rejects premature, unverified, insufficient-land or replayed upgrades',()=>{
   const state:WorldDevelopmentState={track:'house',level:0,stage:0,revision:0};
   const next=nextWorldAdvance(state)!;
   const receipt={worldId:'home-1',approvedArtId:next.sampleArtStageId,
     level:1,stage:1,revision:1,serverVerified:true};
   expect(applyPreviewWorldAdvance(state,{...receipt,serverVerified:false},100).ok).toBe(false);
   expect(applyPreviewWorldAdvance(state,{...receipt,revision:0},100).ok).toBe(false);
   expect(applyPreviewWorldAdvance(state,{...receipt,stage:3},100).ok).toBe(false);
   expect(applyPreviewWorldAdvance(state,receipt,15).ok).toBe(false);
 });
 it('blocks building plans without owned land, suitable zoning or recipe',()=>{
   const plot={plotId:'lot-a',areaM2:60,sideAMeters:6,sideBMeters:10,
     zone:'residential' as const,ownership:'owned' as const,samplePricePerM2Bp:12};
   const quote=starterWorldBuildingPlan(plot,[]);
   expect(quote?.canPlaceOnPlot).toBe(true);
   expect(quote?.canBuildUsingInventory).toBe(false);
   expect(quote?.materialsBp).toBe(1750);
   expect(quote?.missingRequirements.length).toBe(8);
   expect(starterWorldBuildingPlan({...plot,ownership:'not_acquired'},[])?.canPlaceOnPlot).toBe(false);
   expect(starterWorldBuildingPlan({...plot,zone:'agricultural'},[])?.canPlaceOnPlot).toBe(false);
   expect(starterWorldBuildingPlan({...plot,areaM2:6},[])?.canPlaceOnPlot).toBe(false);
   const other=WORLD_BLUEPRINT_PREVIEWS.find(x=>x.id==='family-residence')!;
   expect(planWorldBuilding({...plot,areaM2:100,sideAMeters:10,sideBMeters:10},other,[]).canBuildUsingInventory).toBe(false);
 });
 it('tracks each exact material deficit and does not double count owned inventory',()=>{
   const plot={plotId:'lot-b',areaM2:100,sideAMeters:10,sideBMeters:10,
     zone:'residential' as const,ownership:'owned' as const,samplePricePerM2Bp:12};
   const quote=starterWorldBuildingPlan(plot,[
     {sku:'wood-plank',quantity:30},{sku:'cement-bag-50kg',quantity:10},
     {sku:'hollow-block',quantity:80},{sku:'steel-bar',quantity:10},
     {sku:'roof-sheet',quantity:12},{sku:'interior-paint',quantity:5},
     {sku:'door',quantity:1},{sku:'window',quantity:2},
   ]);
   expect(quote?.materialsBp).toBe(0);
   expect(quote?.canBuildUsingInventory).toBe(true);
   expect(quote?.requirements.every(x=>x.shortage===0)).toBe(true);
 });
});
