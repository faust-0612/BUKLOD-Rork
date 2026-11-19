import React from 'react';
import { View } from 'react-native';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';
import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';
import GenesisKingdomPortal from '@/features/season2/genesis/GenesisKingdomPortal';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

/** Production keeps the existing 13-station map. Genesis portal is non-prod-only. */
export default function BuklodKingdomScreen() {
  const genesisPreview = isGenesisPreviewBuild();
  return (
    <View style={{ flex: 1 }}>
      {genesisPreview ? <GenesisKingdomPortal /> : <BuklodKingdomMap />}
      <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" />
    </View>
  );
}
