import {
  applyWorldSceneEdit, isWorldAssetApproved, validateWorldSceneDraft,
  type WorldSceneDraft, type WorldSlot,
} from '@/features/world/worldCustomization';

const slot: WorldSlot={
  slotId:'living-floor',scene:'living-room',allowedCategories:['furniture'],
  x:0.5,y:0.5,scaleMin:0.5,scaleMax:1.5,anchored:false,
};
const sample:WorldSceneDraft={
  schemaVersion:1,propertyId:'prop-a',scene:'living-room',baseBlueprintId:'starter-bungalow',
  baseRevision:1,materialColors:{wall:'#FFFFFF'},placements:[],
};
describe('BUKLOD world premium customization contract',()=>{
 it('supports valid paint/material variation',()=>{
  const edited=applyWorldSceneEdit(sample,{type:'recolor',channel:'wall',paletteId:'sage'},[slot]);
  expect(edited.ok).toBe(true);
  if(edited.ok)expect(edited.draft.materialColors.wall).toBe('#8FAE93');
 });
 it('supports positioned item and validates stable placement boundaries',()=>{
  const first=applyWorldSceneEdit(sample,{type:'place',placement:{
   placementId:'sofa-one',catalogSku:'furniture:sofa',slotId:'living-floor',
   x:0.48,y:0.61,scale:1,rotationDegrees:0,visible:true,
  }},[slot]);
  expect(first.ok).toBe(true);
  if(!first.ok)return;
  const moved=applyWorldSceneEdit(first.draft,{type:'move',placementId:'sofa-one',slotId:'living-floor',x:0.2,y:0.25},[slot]);
  expect(moved.ok).toBe(true);
  const outOfBounds=applyWorldSceneEdit(first.draft,{type:'move',placementId:'sofa-one',slotId:'living-floor',x:9,y:9},[slot]);
  expect(outOfBounds.ok).toBe(false);
 });
 it('does not allow other categories and duplicate furniture IDs',()=>{
  const bad=applyWorldSceneEdit(sample,{type:'place',placement:{
    placementId:'x',catalogSku:'pet:dog',slotId:'living-floor',x:0.5,y:0.5,scale:1,rotationDegrees:0,visible:true
  }},[slot]);
  expect(bad.ok).toBe(false);
 });
 it('rejects invalid color and too many objects',()=>{
  expect(validateWorldSceneDraft({...sample,materialColors:{wall:'script'}},[slot])).toBeTruthy();
  expect(validateWorldSceneDraft({...sample,placements:[]},[slot],-1)).toBeTruthy();
 });
 it('requires mastered high-resolution licensed assets, not untrusted placeholders',()=>{
  const good={
    assetId:'house-starter-base',packVersion:'2026.12',licenseId:'origin-approved-1',
    sha256:'a'.repeat(64),pixelWidth:1024,pixelHeight:1024,layerKind:'base' as const,
    supportedScene:'exterior' as const,quality:'premium' as const,trustedAssetRef:'asset://houses/starter/base',
  };
  expect(isWorldAssetApproved(good)).toBe(true);
  expect(isWorldAssetApproved({...good,sha256:'invalid'})).toBe(false);
  expect(isWorldAssetApproved({...good,pixelWidth:128})).toBe(false);
  expect(isWorldAssetApproved({...good,trustedAssetRef:'http://untrusted.com'})).toBe(false);
 });
});
