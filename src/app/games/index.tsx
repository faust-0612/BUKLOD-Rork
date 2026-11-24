import React from 'react';
import {View} from 'react-native';
import {Redirect} from 'expo-router';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';
import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';
import GenesisKingdomPortal from '@/features/season2/genesis/GenesisKingdomPortal';
import GenesisNativeWorldEntry from '@/features/season2/genesis/GenesisNativeWorldEntry';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {isGenesisBootstrapEnabled} from '../../../modules/buklod-genesis-godot';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';

export default function BuklodKingdomScreen(){
 const genesisPreview=isGenesisPreviewBuild();
 const {user,loading,profile}=useAuth();
 const {requiresAcceptance,loading:complianceLoading}=useCompliance();
 const {config,loading:runtimeLoading}=useRuntimeConfig();
 if(genesisPreview&&isGenesisBootstrapEnabled()){
  if(loading||complianceLoading||runtimeLoading)return <View style={{flex:1,backgroundColor:'#071523'}}/>;
  if(!user)return <Redirect href="/(auth)/login"/>;
  if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
  if(config?.update_required)return <Redirect href="/system/update-required"/>;
  if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
  if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
  if(!profile)return <Redirect href="/onboarding"/>;
  return <GenesisNativeWorldEntry world="kingdom" fallback={<GenesisKingdomPortal/>}/>;
 }
 return <View style={{flex:1}}>
  {genesisPreview?<GenesisKingdomPortal/>:<BuklodKingdomMap/>}
  {!genesisPreview?<BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner"/>:null}
 </View>;
}
