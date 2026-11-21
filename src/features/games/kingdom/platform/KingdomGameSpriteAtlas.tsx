/**
 * Locally bundled image-generated 39-scene Kingdom atlas (6 columns × 7 rows).
 * The final 3 cells are intentionally unused. Match exact reviewed catalog
 * order so every existing/pilot game has a DISTINCT, non-streamed bitmap.
 *
 * Generator input is not needed on members' devices. The single optimized
 * 180,638-byte WebP decodes locally; fallback vector illustration remains
 * visible if decoding is unavailable. No download, permission, network or
 * service is required for these graphics.
 */
import React,{memo,useEffect,useState} from 'react';
import {StyleSheet,View,type StyleProp,type ViewStyle} from 'react-native';
import {Image} from 'expo-image';

export const KINGDOM_ATLAS_ORDER = [
  "phan-enterprise-builder",
  "phan-trade-master",
  "phan-market-match",
  "quin-discovery-expedition",
  "quin-guessing-quest",
  "quin-code-breaker",
  "van-living-city-dispatch",
  "van-sudoku-master",
  "van-mind-challenge",
  "christian-civic-leadership",
  "christian-bible-crown",
  "christian-scripture-word-search",
  "lhen-rhythm-journey",
  "lhen-melody-memory",
  "lhen-beat-composer",
  "jawo-forest-trail",
  "jawo-trail-maze",
  "jawo-nature-match",
  "trudice-playground-memory",
  "trudice-picture-pairs",
  "trudice-word-garden",
  "ace-rescue-grid",
  "ace-chess-master",
  "ace-tower-tactics",
  "mitch-restore-mural",
  "mitch-block-forge",
  "mitch-color-merge",
  "niel-mission-trail",
  "niel-expedition-puzzle",
  "niel-word-explorer",
  "angel-kingdom-treasury",
  "angel-number-vault",
  "angel-treasure-merge",
  "vhen-farm-to-market",
  "vhen-harvest-match",
  "vhen-farm-merge",
  "elesur-village-builder",
  "elesur-domino-village",
  "elesur-bridge-puzzle"
] as const;
const ATLAS_IMAGE = require('../../../../../assets/season2/genesis/kingdom/kingdom-39-game-illustration-atlas.webp');
const COLS=6,ROWS=7,WIDTH=840,HEIGHT=815;
export function getKingdomAtlasTile(gameId:string){
 const index=(KINGDOM_ATLAS_ORDER as readonly string[]).indexOf(gameId);
 if(index<0)return null;
 return {index,column:index%COLS,row:Math.floor(index/COLS)};
}
type Props={gameId:string;height?:number;style?:StyleProp<ViewStyle>};
function KingdomGameSpriteAtlas({gameId,height=105,style}:Props){
 const tile=getKingdomAtlasTile(gameId);
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[gameId]);
 if(!tile||failed)return null;
 const factor=Math.max(.25,Math.min(2,height/(HEIGHT/ROWS)));
 const tileW=WIDTH/COLS*factor;
 const tileH=HEIGHT/ROWS*factor;
 return <View accessible={false} pointerEvents="none" style={[
   styles.crop,{width:tileW,height:Math.min(height,tileH)},style,
 ]}>
   <Image
     source={ATLAS_IMAGE}
     contentFit="fill"
     transition={0}
     onError={()=>setFailed(true)}
     style={[styles.sheet,{
       width:WIDTH*factor,height:HEIGHT*factor,
       left:-tile.column*tileW,top:-tile.row*tileH,
     }]}
   />
 </View>;
}
const styles=StyleSheet.create({
 crop:{overflow:'hidden',borderRadius:11,borderWidth:1,
   borderColor:'rgba(250,232,175,.45)',backgroundColor:'#243c3a'},
 sheet:{position:'absolute'},
});
export default memo(KingdomGameSpriteAtlas);
