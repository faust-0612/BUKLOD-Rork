/** Genesis 206 staging entry only: expose real OTA state, never equate Activity dispatch with engine readiness. */
import React, {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import {isGenesisPreviewBuild} from './genesisContract';
import {GENESIS_GODOT_OTA_PACK} from './godotPackManifest.generated';
import {launchGenesisOtaWorld, type GodotWorld, type GenesisOtaLaunchStage} from '../../../../modules/buklod-genesis-godot';

const RUNTIME='2.0.6-genesis-godot-ota';
const CHANNEL='season2-genesis-library-206-preview';
type Stage=GenesisOtaLaunchStage|'checking'|'recovery'|'returned'|'wrong_runtime'|'embedded_update'|'storage_error';
const LABELS: Record<Stage,string>={
  checking:'Sinusuri ang bagong game pack…',
  disabled:'Hindi enabled ang Genesis native preview.',
  native_missing:'Walang compatible native Godot module sa APK.',
  invalid_manifest:'Walang valid game-pack manifest sa active update.',
  incompatible_native:'Hindi tugma ang engine o native pack capability.',
  asset_unavailable:'Hindi mabasa ang approved OTA game pack.',
  cancelled:'Kinansela ang launch; bumalik muna sa world map.',
  native_rejected:'Hindi tinanggap ng native bridge ang game pack.',
  dispatched:'Naipasa ang approved pack sa Android engine. Hindi pa kumpirmado ang engine readiness.',
  returned:'Bumalik mula sa native Activity. Hindi nito kinukumpirma ang matagumpay na gameplay.',
  recovery:'Natigil ang nakaraang launch ng pack na ito. Manual retry lamang para maiwasan ang crash loop.',
  wrong_runtime:'Hindi tugma ang APK runtime o staging channel.',
  embedded_update:'Embedded APK bundle pa ang aktibo, hindi ang downloaded staging OTA.',
  storage_error:'Hindi masiguro ang crash-loop protection; hindi muna bubuksan ang engine.',
};
const NAMES:Record<GodotWorld,string>={arena:'ARENA',kingdom:'KINGDOM',house:'HOUSE',community:'COMMUNITY'};
export function isGenesis206NativeWorldEntry():boolean {
  return Platform.OS==='android' && isGenesisPreviewBuild() &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206==='true' &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED==='true';
}
export default function GenesisNativeWorldEntry({world,fallback}:{world:GodotWorld;fallback:ReactNode}) {
  const [stage,setStage]=useState<Stage>('checking');
  const [showFallback,setShowFallback]=useState(false);
  const {isChecking,isDownloading,isUpdatePending,downloadProgress}=Updates.useUpdates();
  const focused=useRef(false);
  const attempted=useRef(false);
  const inFlight=useRef(false);
  const dispatched=useRef(false);
  const leftApp=useRef(false);
  // Versioned by world and pack, not a stale pending bit from a prior runtime.
  const key='@buklod/genesis206/launch/'+world+'/'+(GENESIS_GODOT_OTA_PACK.sha256||'unprepared');
  const launch=useCallback(async(explicitRetry=false)=>{
    if(inFlight.current||!focused.current||AppState.currentState!=='active')return;
    inFlight.current=true;
    dispatched.current=false;
    leftApp.current=false;
    const show=(value:Stage)=>{if(focused.current)setStage(value);};
    show('checking');
    let marked=false;
    try{
      if(!Updates.isEnabled||Updates.runtimeVersion!==RUNTIME||Updates.channel!==CHANNEL){
        show('wrong_runtime');return;
      }
      // Do not misrepresent the bundled APK as newly delivered OTA content.
      if(Updates.isEmbeddedLaunch||Updates.isEmergencyLaunch){show('embedded_update');return;}
      if((await AsyncStorage.getItem(key))==='pending'&&!explicitRetry){show('recovery');return;}
      await AsyncStorage.setItem(key,'pending');
      marked=true;
      const result=await launchGenesisOtaWorld(world,()=>focused.current&&AppState.currentState==='active');
      if(result.stage==='dispatched'){
        dispatched.current=true;
        show('dispatched');
        // Background/return may occur while the native Promise is resolving.
        if(leftApp.current&&AppState.currentState==='active'){
          dispatched.current=false;leftApp.current=false;
          await AsyncStorage.removeItem(key);
          show('returned');
        }
      }else{
        await AsyncStorage.removeItem(key);
        show(result.stage);
      }
    }catch{
      if(marked&&!dispatched.current)await AsyncStorage.removeItem(key).catch(()=>{});
      show('storage_error');
    }finally{inFlight.current=false;}
  },[key,world]);
  useFocusEffect(useCallback(()=>{
    focused.current=true;
    if(!attempted.current){attempted.current=true;void launch();}
    return()=>{focused.current=false;};
  },[launch]));
  useEffect(()=>{
    const sub=AppState.addEventListener('change',state=>{
      if(state!=='active'){
        if(inFlight.current||dispatched.current)leftApp.current=true;
        return;
      }
      if(leftApp.current&&dispatched.current){
        leftApp.current=false;dispatched.current=false;
        void AsyncStorage.removeItem(key).catch(()=>{});
        if(focused.current)setStage('returned');
      }
    });
    return()=>sub.remove();
  },[key]);
  if(showFallback)return <>{fallback}</>;
  const busy=stage==='checking'||stage==='dispatched';
  const otaStatus=isDownloading?'Downloading '+Math.round((downloadProgress??0)*100)+'%':
    isChecking?'Checking for update':isUpdatePending?'Downloaded • next cold launch':
      Updates.isEmergencyLaunch?'Emergency fallback':Updates.isEmbeddedLaunch?'Embedded APK':'Downloaded OTA active';
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text style={styles.title}>BUKLOD GENESIS · {NAMES[world]}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.message}>{LABELS[stage]}</Text>
    <View style={styles.panel}>
      <Text style={styles.detail}>OTA: {otaStatus}</Text>
      <Text selectable style={styles.detail}>Runtime: {Updates.runtimeVersion||'unavailable'}</Text>
      <Text selectable style={styles.detail}>Channel: {Updates.channel||'unavailable'}</Text>
      <Text selectable style={styles.detail}>Active update: {Updates.updateId||'unavailable'}</Text>
      <Text selectable style={styles.detail}>Expected pack SHA-256: {GENESIS_GODOT_OTA_PACK.sha256||'unprepared'}</Text>
      <Text style={styles.detail}>Game pack: {(GENESIS_GODOT_OTA_PACK.bytes/1000000).toFixed(1)} MB · engine 4.7.2</Text>
      <Text style={styles.detail}>Engine-ready: not verified by this APK bridge</Text>
    </View>
    {!busy&&stage!=='wrong_runtime'&&stage!=='embedded_update'?
      <Pressable accessibilityRole="button" onPress={()=>void launch(true)} style={styles.primary}>
        <Text style={styles.buttonText}>RETRY APPROVED GAME PACK</Text>
      </Pressable>:null}
    {!busy?<Pressable accessibilityRole="button" onPress={()=>setShowFallback(true)} style={styles.secondary}>
      <Text style={styles.buttonText}>OPEN EXISTING {NAMES[world]} (FALLBACK)</Text>
    </Pressable>:null}
    {stage!=='dispatched'?<Pressable accessibilityRole="button" onPress={()=>router.canGoBack()?router.back():router.replace('/buklod-map' as any)} style={styles.secondary}>
      <Text style={styles.buttonText}>BACK TO WORLD MAP</Text>
    </Pressable>:null}
    {stage==='embedded_update'?<Text style={styles.message}>Kapag downloaded na ang update, i-force stop at buksan muli ang staging app. Huwag mag-clear ng app data.</Text>:null}
  </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#071523'},
 content:{flexGrow:1,justifyContent:'center',padding:20,gap:14},
 title:{fontSize:22,fontWeight:'900',color:'#FFE4AA'},
 message:{color:'#CDE7E4',fontSize:15,lineHeight:22},
 panel:{backgroundColor:'#152D39',borderRadius:12,padding:14,gap:8},
 detail:{color:'#D9ECEC',fontSize:12,lineHeight:18},
 primary:{padding:14,borderRadius:11,backgroundColor:'#37795F'},
 secondary:{padding:14,borderRadius:11,backgroundColor:'#233F50'},
 buttonText:{color:'#F4F7EC',fontWeight:'900',textAlign:'center'},
});
