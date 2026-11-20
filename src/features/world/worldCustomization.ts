/**
 * BUKLOD WORLD PERSONALIZATION — visual scene contract, not a transactional API.
 *
 * Intended renderer: mastered multi-layer 2.5D/3D assets with material masks,
 * occlusion and independent room/farm/house layers. No cheap procedural house
 * substitutes; a scene is viewable only when its approved asset pack is ready.
 *
 * A local edit draft cannot create assets, spend BP or grant ownership.
 * Authoritative server validation must check property owner/collaborator, catalog
 * entitlements, inventory, zoning, occupancy and optimistic scene revision.
 */
export type WorldSceneKind='exterior'|'living-room'|'bedroom'|'kitchen'|'bathroom'|'garden'|'farm'|'compound';
export type WorldMaterialChannel='wall'|'roof'|'trim'|'floor'|'fabric'|'wood'|'metal'|'plant';
export type WorldPaletteColor={
  id:string; hex:string; label:string;
};
export const WORLD_PREVIEW_PALETTE: readonly WorldPaletteColor[]=[
  {id:'cloud',hex:'#E5E8E5',label:'Cloud White'},
  {id:'sage',hex:'#8FAE93',label:'Sage Green'},
  {id:'sand',hex:'#D5BE9E',label:'Sandstone'},
  {id:'slate',hex:'#566A77',label:'Slate'},
  {id:'ocean',hex:'#456F9B',label:'Ocean Blue'},
  {id:'terracotta',hex:'#B36A52',label:'Terracotta'},
  {id:'rose',hex:'#BF91A8',label:'Rose'},
] as const;

export type WorldAssetManifestEntry={
  assetId:string;
  packVersion:string;
  licenseId:string;
  sha256:string;
  pixelWidth:number;
  pixelHeight:number;
  layerKind:'base'|'shadow'|'normal'|'depth'|'mask'|'decor'|'animated';
  supportedScene:WorldSceneKind;
  quality:'premium';
  /** approved CDN path or an app-bundled asset ref resolved by a trusted registry */
  trustedAssetRef:string;
};
export type WorldSlot={
  slotId:string;
  scene:WorldSceneKind;
  allowedCategories:readonly string[];
  /** normalized position relative to current scene bounds */
  x:number;y:number;
  scaleMin:number;scaleMax:number;
  /** if true object must attach to a wall/window, not freely move on floor */
  anchored:boolean;
};
export type WorldPlacement={
  placementId:string;
  catalogSku:string;
  slotId:string;
  x:number;y:number;
  scale:number;
  rotationDegrees:number;
  paletteId?:string;
  visible:boolean;
};
export type WorldSceneDraft={
  schemaVersion:1;
  propertyId:string;
  scene:WorldSceneKind;
  baseBlueprintId:string;
  baseRevision:number;
  /** custom dye channels are cosmetic; server checks material unlocks */
  materialColors:Partial<Record<WorldMaterialChannel,string>>;
  placements:readonly WorldPlacement[];
};
export type WorldSceneEdit=
 | {type:'recolor';channel:WorldMaterialChannel;paletteId:string}
 | {type:'place';placement:WorldPlacement}
 | {type:'move';placementId:string;slotId:string;x:number;y:number}
 | {type:'rotate';placementId:string;degrees:number}
 | {type:'remove';placementId:string};
export type WorldSceneResult={ok:true;draft:WorldSceneDraft}|{ok:false;reason:string};
const HEX=/^#[0-9a-fA-F]{6}$/;
const SHA=/^[0-9a-f]{64}$/i;
const ASSET=/^(?:asset:\/\/|https:\/\/)[^\s]+$/i;
export function isWorldAssetApproved(asset:WorldAssetManifestEntry):boolean {
  return asset.quality==='premium'
    && Boolean(asset.licenseId.trim())
    && SHA.test(asset.sha256)
    && ASSET.test(asset.trustedAssetRef)
    && asset.pixelWidth>=512 && asset.pixelHeight>=512
    && Boolean(asset.packVersion.trim());
}
export function validateWorldSceneDraft(draft:WorldSceneDraft,slots:readonly WorldSlot[],maxPlacements=150):string|null {
  if(draft.schemaVersion!==1||!draft.propertyId.trim()||!draft.baseBlueprintId.trim()
    ||!Number.isSafeInteger(draft.baseRevision)||draft.baseRevision<0)return 'Invalid world scene identity or revision.';
  if(!Number.isSafeInteger(maxPlacements)||maxPlacements<0||draft.placements.length>maxPlacements)return 'Too many scene objects.';
  for(const hex of Object.values(draft.materialColors)){
    if(typeof hex!=='string'||!HEX.test(hex))return 'Invalid material color.';
  }
  const seen=new Set<string>();
  for(const p of draft.placements){
    if(!p.placementId||seen.has(p.placementId))return 'Duplicate or missing placement identifier.';
    seen.add(p.placementId);
    const slot=slots.find(s=>s.slotId===p.slotId&&s.scene===draft.scene);
    if(!slot)return 'Placement does not match any room slot.';
    if(!slot.allowedCategories.some(c=>p.catalogSku.startsWith(c+':')))return 'Item category not permitted in selected slot.';
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)return 'Invalid object position.';
    if(!Number.isFinite(p.scale)||p.scale<slot.scaleMin||p.scale>slot.scaleMax)return 'Object scale outside slot limits.';
    if(!Number.isFinite(p.rotationDegrees)||Math.abs(p.rotationDegrees)>360)return 'Object rotation outside limits.';
    if(p.paletteId && !WORLD_PREVIEW_PALETTE.some(c=>c.id===p.paletteId))return 'Unknown color palette choice.';
    if(typeof p.visible!=='boolean')return 'Invalid item visibility.';
    if(slot.anchored && (Math.abs(p.x-slot.x)>0.04||Math.abs(p.y-slot.y)>0.04))return 'Anchored item cannot leave its assigned fixture.';
  }
  return null;
}
export function applyWorldSceneEdit(draft:WorldSceneDraft,edit:WorldSceneEdit,slots:readonly WorldSlot[]):WorldSceneResult{
  let next:WorldSceneDraft=draft;
  if(edit.type==='recolor'){
    const palette=WORLD_PREVIEW_PALETTE.find(c=>c.id===edit.paletteId);
    if(!palette)return {ok:false,reason:'Unknown color.'};
    next={...draft,materialColors:{...draft.materialColors,[edit.channel]:palette.hex}};
  } else if(edit.type==='place'){
    if(draft.placements.some(p=>p.placementId===edit.placement.placementId))return {ok:false,reason:'Object already placed.'};
    next={...draft,placements:[...draft.placements,edit.placement]};
  } else if(edit.type==='move'){
    next={...draft,placements:draft.placements.map(p=>p.placementId===edit.placementId
      ?{...p,slotId:edit.slotId,x:edit.x,y:edit.y}:p)};
    if(!draft.placements.some(p=>p.placementId===edit.placementId))return {ok:false,reason:'Object not found.'};
  } else if(edit.type==='rotate'){
    if(!draft.placements.some(p=>p.placementId===edit.placementId))return {ok:false,reason:'Object not found.'};
    next={...draft,placements:draft.placements.map(p=>p.placementId===edit.placementId
      ?{...p,rotationDegrees:edit.degrees}:p)};
  } else {
    if(!draft.placements.some(p=>p.placementId===edit.placementId))return {ok:false,reason:'Object not found.'};
    next={...draft,placements:draft.placements.filter(p=>p.placementId!==edit.placementId)};
  }
  const invalid=validateWorldSceneDraft(next,slots);
  return invalid?{ok:false,reason:invalid}:{ok:true,draft:next};
}
