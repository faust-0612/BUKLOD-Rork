import React from 'react';
import { View } from 'react-native';
import BuklodEconomyDashboard from '@/components/points/BuklodEconomyDashboard';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';

// Keep the existing trusted finance read view and its transaction boundaries.
export default function BuklodEconomyWithAds() {
  return (
    <View style={{ flex: 1 }}>
      <BuklodEconomyDashboard />
      <BuklodKingdomAdSlot placementId="points_economy_footer" kind="banner" />
    </View>
  );
}
