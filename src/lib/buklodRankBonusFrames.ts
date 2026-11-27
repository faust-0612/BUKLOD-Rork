import { BUKLOD_CIRCLE_RANK_FAMILIES, BUKLOD_CIRCLE_RANK_LEVELS, getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';

/** Actual non-cash optional reward: a distinct signature frame at every rank. */
export type RankBonusFrame = { key:string; title:string; order:number; familyIndex:number; levelIndex:number; color:string };
export const RANK_BONUS_FRAMES: readonly RankBonusFrame[] = BUKLOD_CIRCLE_RANK_FAMILIES.flatMap((family,fi)=>
  BUKLOD_CIRCLE_RANK_LEVELS.map((level,li)=>{
    const order=fi*5+li+1;
    const rank=getBuklodCircleRankArt(family+' '+level)!;
    return {key:'rank-frame-'+String(order).padStart(2,'0'),title:family+' '+level+' Signature Frame',
      order,familyIndex:fi,levelIndex:li,color:rank.borderColor};
  })
);
export function rankBonusFrameForViewer(key:unknown):RankBonusFrame|null {
  return typeof key==='string'?RANK_BONUS_FRAMES.find(frame=>frame.key===key)??null:null;
}
export function canUseRankBonusFrame(key:unknown,redeemedKeys:readonly string[]):boolean {
  return key===null || (!!rankBonusFrameForViewer(key)&&redeemedKeys.includes(String(key)));
}
