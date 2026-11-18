/* BUKLOD Season 2: original user-approved 40 transparent rank emblems.
 * Keep the historical component API for Points/Character/progression callers.
 */
import React from 'react';
import { View } from 'react-native';
import BuklodSeason2RankArtwork from '@/components/points/BuklodSeason2RankArtwork';
import { resolveCircleRankArtwork } from '@/lib/buklodCircleRankArtwork';

// A single family color is used for borders, not as replacement badge artwork.
export const FAMILY_COLORS: Record<string, string> = {
  starter: '#57DC47',
  active: '#49AEFF',
  steady: '#AF77F8',
  builder: '#FFAD3C',
  impact: '#24CFC5',
  vanguard: '#D74748',
  prime: '#488FFF',
  'prime elite': '#B858F5',
};
type BadgeProps = {
  rankFamily?: string | null;
  rankLevel?: string | null;
  rankName?: string | null;
  size?: number;
  locked?: boolean;
};

export function circleRankBadgeParts(rankName?: string | null) {
  const name = String(rankName ?? 'Circle Starter V').trim();
  const level = (name.match(/\b(V|IV|III|II|I)$/i)?.[1] ?? 'V').toUpperCase();
  const family = name.replace(/^(Circle|BUKLOD)\s+/i, '')
    .replace(/\s+(V|IV|III|II|I)$/i, '').trim();
  return { family: family || 'Starter', level };
}

export default function BuklodCircleRankBadge({
  rankFamily, rankLevel, rankName, size = 56, locked = false,
}: BadgeProps) {
  const parsed = circleRankBadgeParts(rankName);
  const family = String(rankFamily || parsed.family).replace(/^(Circle|BUKLOD)\s+/i, '').trim();
  const level = String(rankLevel || parsed.level).trim().toUpperCase();
  const canonical = resolveCircleRankArtwork((family.toLowerCase().startsWith('prime') ? 'BUKLOD ' : 'Circle ') + family + ' ' + level);
  if (!canonical) return null;
  // Keep the fallback palette used by legacy progression recognition callers.
  const borderColor = FAMILY_COLORS[family.toLowerCase()] ?? canonical.borderColor;
  return (
    <View style={{ width: size, height: size * 1.12, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={canonical.rankName + (locked ? ', locked' : ', badge')}
      accessible
    >
      <BuklodSeason2RankArtwork rankName={canonical.rankName} size={size}
        locked={locked} style={{ borderColor: borderColor }} />
    </View>
  );
}
