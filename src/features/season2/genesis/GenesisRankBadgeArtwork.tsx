/** Approved Season 2 40-badge artwork: transparent 5 x 8 atlas cut into exact cells.
 * Visual-only. Rank remains server-owned, and no art is shown for unknown ranks. */
import React from 'react';
import { Image, View } from 'react-native';
import { getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';

type Props = { rankName: string | null | undefined; size?: number; locked?: boolean };
const SHEET = require('../../../../assets/season2/rank-badges/buklod-circle-ranks-atlas.webp');

export function normalizeGenesisRankName(input: string | null | undefined): string {
  const value = String(input ?? '').trim().replace(/\s+/g,' ');
  if (/^(?:Prime Elite|Prime)\s+(?:V|IV|III|II|I)$/i.test(value)) return 'BUKLOD '+value;
  if (/^(?:Starter|Active|Steady|Builder|Impact|Vanguard)\s+(?:V|IV|III|II|I)$/i.test(value)) return 'Circle '+value;
  if (/^Circle Prime(?: Elite)?\s+/i.test(value)) return value.replace(/^Circle /i,'BUKLOD ');
  return value;
}

export default function GenesisRankBadgeArtwork({rankName,size=56,locked=false}:Props) {
  const art=getBuklodCircleRankArt(normalizeGenesisRankName(rankName));
  if (!art) return <View style={{width:size,height:size*1.12}}/>;
  return <View accessible accessibilityRole="image" accessibilityLabel={art.name+(locked?', locked':', badge')}
    style={{width:size,height:size*1.12,alignItems:'center',justifyContent:'center'}}>
    <View style={{width:size,height:size,overflow:'hidden',opacity:locked?.35:1}}>
      <Image source={SHEET} resizeMode="stretch" fadeDuration={0} style={{
        position:'absolute',width:size*5,height:size*8,
        left:-art.levelIndex*size,top:-art.familyIndex*size,
      }}/>
    </View>
  </View>;
}
