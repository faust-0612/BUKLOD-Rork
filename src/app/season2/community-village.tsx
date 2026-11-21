import React from 'react';
import {View} from 'react-native';
import {Redirect} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import Season2DevelopmentMap from '@/features/season2/world/Season2DevelopmentMap';

export default function GenesisCommunityStudio(){
 const {session,loading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 if(!isGenesisPreviewBuild())return <Redirect href="/clusters"/>;
 if(loading&&!session)return <View style={{flex:1,backgroundColor:'#071C23'}}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 return <Season2DevelopmentMap world="village"/>;
}
