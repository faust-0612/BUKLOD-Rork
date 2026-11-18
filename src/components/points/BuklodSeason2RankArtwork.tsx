/** Exact, independently isolated user-approved BUKLOD badge artwork (not a square icon).
 * All 40 transparent badges live in one bundled offline WebP atlas; cells cannot
 * paint neighboring ranks. Visual-only: no points/rules/rewards writes.
 */
import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { resolveCircleRankArtwork } from '@/lib/buklodCircleRankArtwork';

const ART_ATLAS = require('../../../assets/season2/circle-rank-atlas.webp');
export const CIRCLE_RANK_ATLAS_COLUMNS = 5;
export const CIRCLE_RANK_ATLAS_ROWS = 8;

type Props = {
  rankName?: string | null;
  size?: number;
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function BuklodSeason2RankArtwork({
  rankName, size = 56, locked = false, style,
}: Props) {
  const badge = resolveCircleRankArtwork(rankName);
  if (!badge) return null;
  const cell = Math.max(16, Math.round(size));
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={badge.rankName + (locked ? ', locked' : ', Circle Rank badge')}
      style={[{ width: cell, height: cell, overflow: 'hidden', opacity: locked ? 0.34 : 1 }, style]}
    >
      <Image
        source={ART_ATLAS}
        resizeMode="stretch"
        fadeDuration={0}
        style={{
          position: 'absolute',
          width: cell * CIRCLE_RANK_ATLAS_COLUMNS,
          height: cell * CIRCLE_RANK_ATLAS_ROWS,
          left: -badge.column * cell,
          top: -badge.row * cell,
        }}
      />
    </View>
  );
}
