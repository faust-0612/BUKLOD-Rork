import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Pressable, Text, View} from 'react-native';
import {router} from 'expo-router';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';
import BuklodKingdomMap from '@/features/games/kingdom/BuklodKingdomMapPremium';
import GenesisKingdomPortal from '@/features/season2/genesis/GenesisKingdomPortal';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {getGenesisLaunchStatus,isGenesisBootstrapEnabled,openBundledBuklodWorld} from '../../../modules/buklod-genesis-godot';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';

function NativeKingdomEntry() {
  const [message,setMessage]=useState('Binubuksan ang Living Kingdom…');
  const [requested,setRequested]=useState(false);
  const [legacy,setLegacy]=useState(false);
  const busy=useRef(false);
  const alive=useRef(true);
  const launch=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;
    setRequested(true);
    setMessage('Binubuksan ang verified Godot world…');
    try {
      const started=await openBundledBuklodWorld('kingdom');
      if(alive.current)setMessage(started?'Native launch requested — waiting for engine receipt.':'Hindi nabuksan ang native world.');
    } finally {busy.current=false;}
  },[]);
  useEffect(()=>{
    alive.current=true;
    void launch();
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')void getGenesisLaunchStatus().then(result=>{
        if(alive.current)setMessage(result.state==='ready'?'Kingdom rendered • '+(result.pack==='embedded'?'APK content':result.pack?.slice(0,12)):'Kingdom status: '+result.state+(result.reason?' • '+result.reason:''));
      });
    });
    return()=>{alive.current=false;subscription.remove();};
  },[launch]);
  if(legacy)return <GenesisKingdomPortal/>;
  return <View style={{flex:1,backgroundColor:'#071523',justifyContent:'center',padding:24,gap:16}}>
    <Text style={{color:'#FFE4AA',fontSize:24,fontWeight:'900'}}>BUKLOD LIVING KINGDOM</Text>
    <Text style={{color:'#DCECE9'}}>{message}</Text>
    {requested?<Pressable accessibilityRole="button" onPress={()=>void launch()} style={{padding:14,backgroundColor:'#37795F',borderRadius:10}}><Text style={{color:'#fff',textAlign:'center'}}>ENTER KINGDOM</Text></Pressable>:null}
    <Pressable accessibilityRole="button" onPress={()=>setLegacy(true)} style={{padding:14}}><Text style={{color:'#E4DAB9',textAlign:'center'}}>CHARACTER STATIONS &amp; COLLECTION</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={()=>router.back()} style={{padding:14}}><Text style={{color:'#DCECE9',textAlign:'center'}}>BACK TO BUKLOD</Text></Pressable>
  </View>;
}
export default function BuklodKingdomScreen() {
  const genesisPreview=isGenesisPreviewBuild();
  const {user,loading,profile}=useAuth();
  const {requiresAcceptance}=useCompliance();
  const {config}=useRuntimeConfig();
  const nativeAllowed=genesisPreview&&isGenesisBootstrapEnabled()&&!loading&&!!user&&!!profile&&!requiresAcceptance&&!config?.maintenance_mode&&!config?.update_required&&(!config?.pilot_access_required||config?.pilot_access_granted);
  return <View style={{flex:1}}>
    {nativeAllowed?<NativeKingdomEntry/>:genesisPreview?<GenesisKingdomPortal/>:<BuklodKingdomMap/>}
    {!genesisPreview?<BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner"/>:null}
  </View>;
}
