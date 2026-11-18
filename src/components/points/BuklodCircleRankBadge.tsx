/* Season 2 artwork extracted from the owner's approved badge sheets.
 * Sprite cells contain transparent, isolated badge silhouettes; no square backing.
 */
import React from 'react';
import { Image, View } from 'react-native';
import {
  BUKLOD_CIRCLE_RANK_FAMILIES,
  BUKLOD_CIRCLE_RANK_LEVELS,
  getBuklodCircleRankArt,
} from '@/lib/buklodCircleRankArt';

type BadgeProps = {
  rankFamily?: string | null;
  rankLevel?: string | null;
  rankName?: string | null;
  size?: number;
  locked?: boolean;
};

// Keep the legacy recognition/QA contract and exact family color semantics.
const FAMILY_COLORS = {
  starter: '#48DE74', active: '#36BFFF', steady: '#B68CFF',
  builder: '#F4B844', impact: '#22DECF', vanguard: '#EF6B46',
  prime: '#5B9EFF', 'prime elite': '#F2CF63',
};

export function circleRankBadgeParts(rankName?: string | null) {
  const art = getBuklodCircleRankArt(rankName ?? 'Circle Starter V');
  return art
    ? { family: BUKLOD_CIRCLE_RANK_FAMILIES[art.familyIndex], level: BUKLOD_CIRCLE_RANK_LEVELS[art.levelIndex] }
    : { family: 'Circle Starter', level: 'V' };
}

export default function BuklodCircleRankBadge({
  rankFamily, rankLevel, rankName, size = 56, locked = false,
}: BadgeProps) {
  const parsed = circleRankBadgeParts(rankName);
  const resolvedName = rankFamily && rankLevel
    ? rankFamily.trim().replace(/^Circle\s+/i, 'Circle ') + ' ' + rankLevel.trim()
    : rankName ?? parsed.family + ' ' + parsed.level;
  const art = getBuklodCircleRankArt(resolvedName);
  if (!art) return <View style={{ width: size, height: size * 1.12 }} />;

  // PNG/WebP source atlas: 5 columns × 8 rows, 160 × 160px each.
  const cell = size;
  return (
    <View accessible accessibilityRole="image"
      accessibilityLabel={art.name + (locked ? ', locked' : ', badge')}
      style={{ width: cell, height: cell * 1.12, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: cell, height: cell, overflow: 'hidden', opacity: locked ? 0.35 : 1 }}>
        <Image
          source={require('../../../assets/season2/rank-badges/buklod-circle-ranks-atlas.webp')}
          resizeMode="stretch"
          style={{
            position: 'absolute', width: cell * 5, height: cell * 8,
            left: -(art.levelIndex * cell), top: -(art.familyIndex * cell),
          }}
        />
      </View>
    </View>
  );
}
