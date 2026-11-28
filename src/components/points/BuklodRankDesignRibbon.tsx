import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { availableWallPostDesigns } from '@/lib/buklodWallPostDesigns';
import { WallPostDesignArt } from '@/components/BuklodWallPostDesignPicker';
import { getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';
import { rankVisualMilestone } from '@/lib/buklodRankVisualMilestones';

/** Personal presentation only. Never use a viewer's rank for another author's content. */
export default function BuklodRankDesignRibbon({ rankName }: { rankName?: string | null }) {
  const rank = getBuklodCircleRankArt(rankName);
  if (!rank) return null;
  const available = availableWallPostDesigns(rankName);
  const design = available[available.length - 1];
  const milestone = rankVisualMilestone(rank.order);
  if (!design || !milestone) return null;
  return <View style={[styles.ribbon, { backgroundColor: design.start }]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <WallPostDesignArt design={design} />
    </View>
    <Text style={[styles.label, { color: design.ink }]}>DESIGN COLLECTION · {design.name}</Text>
    <Text style={[styles.detail, { color: design.ink }]}>{rankName}</Text>
  </View>;
}
const styles = StyleSheet.create({
  ribbon: { overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.45 },
  detail: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
