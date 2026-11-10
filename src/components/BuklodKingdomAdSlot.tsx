import React from 'react';
import { Platform, View } from 'react-native';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';

type Props = { placementId: string; kind: 'native' | 'banner' };

/**
 * Non-blocking Android media inventory. Existing AdMob controls still own
 * consent, network, viewport, no-fill retry and remote kill switches.
 */
export default function BuklodKingdomAdSlot({ placementId, kind }: Props) {
  if (Platform.OS !== 'android') return null;
  return (
    <View style={{ width: '100%', paddingVertical: 14, paddingHorizontal: 8 }}>
      {kind === 'native'
        ? <BuklodNativeSponsoredCard surface="home" slotId={placementId} />
        : <BuklodAdMobBanner placement="content" placementId={placementId} compact format="adaptive" />}
    </View>
  );
}
