/* User-approved BUKLOD Circle Rank visual: 40 original non-square transparent emblems. */
import React from 'react';
import { View, Image } from 'react-native';
import {
  RANK_ART_SOURCE, RANK_ATLAS_COLUMNS, RANK_ATLAS_ROWS,
  resolveCircleRankArt, FAMILY_COLORS,
} from '@/lib/buklodSeason2RankArt';
export { FAMILY_COLORS };
export { resolveCircleRankArt };
type BadgeProps = {
  rankFamily?: string | null;
  rankLevel?: string | null;
  rankName?: string | null;
  size?: number;
  locked?: boolean;
};
const LEVELS = new Set(['V','IV','III','II','I']);
export function circleRankBadgeParts(rankName?: string | null) {
  const raw = String(rankName ?? 'Circle Starter V').trim();
  const level = (raw.match(/\b(V|IV|III|II|I)$/i)?.[1] ?? 'V').toUpperCase();
  const family = raw.replace(/^(?:Circle|Buklod)\s+/i,'')
    .replace(/\s+(V|IV|III|II|I)$/i,'').trim().replace(/^Buklod\s+/i,'');
  return {family:family || 'Starter',level};
}
export default function BuklodCircleRankBadge({
  rankFamily,rankLevel,rankName,size=56,locked=false,
}: BadgeProps) {
  const parsed=circleRankBadgeParts(rankName);
  const family=String(rankFamily || parsed.family).replace(/^(?:Circle|Buklod)\s+/i,'');
  const level=String(rankLevel || parsed.level).toUpperCase();
  const roman=LEVELS.has(level)?level:parsed.level;
  const art=resolveCircleRankArt(family+' '+roman);
  if (!art) return null; // Never award a fictional rank on corrupt/missing identity.
  const column=art.index%RANK_ATLAS_COLUMNS;
  const row=Math.floor(art.index/RANK_ATLAS_COLUMNS);
  const spriteSize=Math.max(12,Math.round(size));
  return (
    <View accessible accessibilityRole="image"
      accessibilityLabel={`${rankName || `Circle ${family} ${roman}`}${locked?', locked':', badge'}`}
      style={{width:spriteSize,height:spriteSize,overflow:'hidden',opacity:locked?0.32:1}}
      pointerEvents="none">
      <Image source={RANK_ART_SOURCE} resizeMode="stretch"
        style={{position:'absolute',left:-column*spriteSize,top:-row*spriteSize,
          width:spriteSize*RANK_ATLAS_COLUMNS,height:spriteSize*RANK_ATLAS_ROWS}}/>
    </View>
  );
}
