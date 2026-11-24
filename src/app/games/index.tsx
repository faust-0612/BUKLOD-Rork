import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import GenesisNativeWorldEntry, {isGenesis206NativeWorldEntry} from '@/features/season2/genesis/GenesisNativeWorldEntry';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';
import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';
import GenesisKingdomPortal from '@/features/season2/genesis/GenesisKingdomPortal';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

function GuardedGenesisKingdom206(){
  const {session,loading,profile}=useAuth();
  const {requiresAcceptance}=useCompliance();
  const {config}=useRuntimeConfig();
  if(loading&&!session)return <View style={{flex:1,backgroundColor:'#071523'}}/>;
  if(!session)return <Redirect href="/(auth)/login"/>;
  if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
  if(config?.update_required)return <Redirect href="/system/update-required"/>;
  if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
  if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
  if(!profile)return <Redirect href="/onboarding"/>;
  return <GenesisNativeWorldEntry world="kingdom" fallback={<GenesisKingdomPortal/>}/>;
}

/** Production keeps the existing 13-station map. Genesis portal is non-prod-only. */
export default function BuklodKingdomScreen() {
  const genesisPreview = isGenesisPreviewBuild();
  if(genesisPreview && isGenesis206NativeWorldEntry()) return <GuardedGenesisKingdom206/>;
  return (
    <View style={{ flex: 1 }}>
      {genesisPreview ? <GenesisKingdomPortal /> : <BuklodKingdomMap />}
      {!genesisPreview ? <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" /> : null}
    </View>
  );
}
