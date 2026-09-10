import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
import { trackIgpatEvent } from '@/lib/igpat/igpatRuntime';

export default function IgpatAdSlot({ active, slotId }: { active: boolean; slotId: string }) {
  useEffect(() => {
    if (active) {
      void trackIgpatEvent({ event: 'ad_impression', meta: { slot_id: slotId, placement: 'igpat_feed' } });
    }
  }, [active, slotId]);

  if (!active) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <BuklodCommunityInlineAd active slotId={`igpat:${slotId}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 86,
    bottom: 18,
    maxHeight: 118,
    overflow: 'hidden',
  },
});
