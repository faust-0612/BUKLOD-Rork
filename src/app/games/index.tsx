import React from 'react';
import { View } from 'react-native';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';

import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';

export default function BuklodKingdomScreen() {
  return (
    <View style={{ flex: 1 }}>
      <BuklodKingdomMap />
      <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" />
    </View>
  );
}
