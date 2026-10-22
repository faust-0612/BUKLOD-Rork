import React from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';

type CommunityAdInventory = 'public' | 'org' | 'cluster';

export default function BuklodCommunityInlineAd({
  slotId,
  active = true,
  inventory = 'public',
}: {
  slotId?: string;
  active?: boolean;
  inventory?: CommunityAdInventory;
}) {
  if (!active) {
    return null;
  }

  const placement =
    inventory === 'org'
      ? 'org_community'
      : inventory === 'cluster'
        ? 'cluster_community'
        : 'community';

  const placementId =
    inventory === 'org'
      ? 'org_wall_feed'
      : inventory === 'cluster'
        ? 'cluster_wall_feed'
        : 'public_wall_feed';

  return (
    <View style={styles.wrap}>
      <View style={styles.adWrap}>
        <BuklodWebAdSlot
          placement={placement}
          placementId={placementId}
          requestKey={slotId}
          compact
          format="inline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 10,
  },
  adWrap: {
    width: '100%',
    alignItems: 'center',
  },
});
