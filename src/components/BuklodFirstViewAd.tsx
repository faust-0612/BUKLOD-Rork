import React from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

type Props = {
  placement: BuklodAdPlacement;
  placementId: string;
  compact?: boolean;
};

/**
 * BUKLOD_FIRST_VIEW_MONETIZATION_R1
 *
 * One policy-safe, above-the-fold ad opportunity for high-traffic surfaces.
 * The slot requests only after the shared viewport gate confirms it is visible;
 * only the ad SDK can report a real impression. Keep this away from navigation/destructive
 * controls and never couple it to rewards.
 */
export default function BuklodFirstViewAd({
  placement,
  placementId,
  compact = true,
}: Props) {
  return (
    <View style={styles.shell}>
      <BuklodAdMobBanner
        placement={placement}
        placementId={placementId}
        compact={compact}
        format="adaptive"
        showLabel
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    alignSelf: 'stretch',
    marginVertical: 8,
  },
});
