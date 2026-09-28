import React from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodCommunityIgpatPreview from '@/components/BuklodCommunityIgpatPreview.web';
import BuklodWebAdSlot from '@/components/BuklodWebAdSlot.web';

export default function BuklodCommunityInlineAd({
  slotId,
  active = true,
}: {
  slotId?: string;
  active?: boolean;
}) {
  if (!active) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <BuklodCommunityIgpatPreview
        slotId={slotId}
        active={active}
      />

      <View style={styles.adWrap}>
        <BuklodWebAdSlot
          placement="community"
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
