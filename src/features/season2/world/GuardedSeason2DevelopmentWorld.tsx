/** Genesis world portals remain read-only and reuse BUKLOD login, consent and update guards. */
import React from 'react';
import {View} from 'react-native';
import {Redirect} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import Season2DevelopmentMap from './Season2DevelopmentMap';
import GenesisNativeWorldEntry from '@/features/season2/genesis/GenesisNativeWorldEntry';
import {isGenesisBootstrapEnabled} from '../../../../modules/buklod-genesis-godot';

export default function GuardedSeason2DevelopmentWorld({world}:{world:'home'|'village'}) {
  const {session,loading,profile}=useAuth();
  const {requiresAcceptance,loading:complianceLoading}=useCompliance();
  const {config,loading:runtimeLoading}=useRuntimeConfig();
  if (!isGenesisPreviewBuild()) return <Redirect href="/(tabs)/buklod"/>;
  if (isGenesisBootstrapEnabled()&&(loading||complianceLoading||runtimeLoading)) return <View style={{flex:1,backgroundColor:'#071E29'}}/>;
  if (loading && !session) return <View style={{flex:1,backgroundColor:'#071E29'}}/>;
  if (!session) return <Redirect href="/(auth)/login"/>;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance"/>;
  if (config?.update_required) return <Redirect href="/system/update-required"/>;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access"/>;
  if (requiresAcceptance) return <Redirect href="/privacy/consent"/>;
  if (!profile) return <Redirect href="/onboarding"/>;
  if (isGenesisBootstrapEnabled()) return <GenesisNativeWorldEntry world={world==='home'?'house':'community'} fallback={<Season2DevelopmentMap world={world}/>}/>;
  return <Season2DevelopmentMap world={world}/>;
}
