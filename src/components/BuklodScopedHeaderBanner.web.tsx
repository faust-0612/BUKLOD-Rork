import React from 'react';
import { StyleSheet, View } from 'react-native';
import BuklodPaidHeaderAd from '@/components/BuklodPaidHeaderAd';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

type Placement = 'home' | 'messages' | 'community';

function admobPlacement(placement: Placement) {
  return placement === 'community' ? 'community' : placement === 'messages' ? 'messages' : 'home';
}

/**
 * Restored managed Organization/Sub-organization/Cluster header inventory.
 * Paid local campaigns retain priority; AdMob/AdSense is the safe fallback.
 * Connect conversation surfaces deliberately do not mount this component.
 */
export default function BuklodScopedHeaderBanner({ placement }: { placement: Placement }) {
  return (
    <View style={styles.shell}>
      <BuklodPaidHeaderAd
        placement={placement}
        fallback={
          <BuklodAdMobBanner
            placement={admobPlacement(placement)}
            compact
            format="adaptive"
            requireViewport
            showLabel
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
