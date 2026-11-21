/**
 * BUKLOD V2 source catalog: buklod_assets_catalog.json.
 * These are planned visual IDs/path keys, NOT require() references or unlocked
 * server assets. Files must be independently staged before dynamic use.
 */
export type DevelopmentTrack = 'lot'|'house'|'cluster';
const NAMES:Readonly<Record<DevelopmentTrack,readonly string[]>>={
  lot:[
    'Entry Lot (Markers)','Boundary Posts','Simple Fence','Full Fence','With Gate',
    'With Utilities','Paved Path','Garden / Work Area','Expanded Lot','Estate Lot',
  ],
  house:[
    'Poste / Markers','Floor & Posts','Balangkas','Basic Shell','Complete House',
    'Improved House','With Extension (Ongoing)','Larger Finished','Premium Expansion','Full Estate Residence',
  ],
  cluster:[
    'Open Land (Cluster Start)','Initial Setup','Basic Meeting Shed','Arranged Lots',
    'Cluster Center (Basic)','With Utilities','Organized Infrastructure',
    'Community Facilities','Service Hub','Integrated Community',
  ],
};
const PREFIX:Readonly<Record<DevelopmentTrack,string>>={lot:'LOT',house:'HOU',cluster:'COM'};
const ART_PREFIX:Readonly<Record<DevelopmentTrack,string>>={lot:'lot',house:'hou',cluster:'com'};
export const CONSTRUCTION_STAGES=Object.freeze([
  'Materials','Posts / Foundation','Framework','Structure','Finishing',
] as const);
export type DevelopmentAssetRecord=Readonly<{
  assetId:string;track:DevelopmentTrack;level:number;title:string;catalogPath:string;
  stagingStatus:'catalog-only';
}>;
export const DEVELOPMENT_ASSET_CATALOG:readonly DevelopmentAssetRecord[]=Object.freeze(
  (['lot','house','cluster'] as const).flatMap(track=>
    NAMES[track].map((title,index)=>{
      const level=index+1;
      const suffix=String(level).padStart(2,'0');
      return Object.freeze({
        assetId:`${PREFIX[track]}_L${suffix}`,
        track,level,title,
        catalogPath:`buklod_assets/png/${ART_PREFIX[track]}_l${suffix}.png`,
        stagingStatus:'catalog-only' as const,
      });
    }),
  ),
);
export function getDevelopmentAsset(track:DevelopmentTrack,level:number){
  const n=Math.max(1,Math.min(10,Math.floor(Number.isFinite(level)?level:1)));
  return DEVELOPMENT_ASSET_CATALOG.find(asset=>asset.track===track&&asset.level===n)!;
}
export function mustUseAuthoritativeProgression():true {return true;}
