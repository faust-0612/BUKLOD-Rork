import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import * as Updates from 'expo-updates';
import {GENESIS_GODOT_OTA_PACK} from './godotPackManifest.generated';
/** Passive staging-only identity; no new network requests or reloads. */
export default function GenesisReleaseDiagnostics(){
 const [expanded,setExpanded]=useState(false);
 const status=Updates.useUpdates();
 const active=status.currentlyRunning;
 const progress=typeof status.downloadProgress==='number'?Math.round(Math.max(0,Math.min(1,status.downloadProgress))*100):null;
 const label=!Updates.isEnabled?'OTA disabled':active.isEmergencyLaunch?'Recovery bundle':status.isDownloading?'Downloading'+(progress===null?'':' '+progress+'%'):status.isUpdatePending?'Downloaded • next launch':status.isChecking?'Checking update':status.downloadError||status.checkError?'Update check/download failed':active.isEmbeddedLaunch?'APK bundle active':'OTA bundle active';
 return <View style={{paddingHorizontal:8,paddingVertical:4}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Show staging release diagnostics" onPress={()=>setExpanded(v=>!v)}>
   <Text style={{fontSize:11,color:'#A6C7BB'}}>GENESIS STAGING • {label}</Text>
  </Pressable>
  {expanded?<View style={{paddingTop:5,gap:3}}>
   <Text selectable style={{fontSize:11,color:'#DAEAE9'}}>Runtime: {active.runtimeVersion??'Unknown'} · {active.channel??'No channel'}</Text>
   <Text selectable style={{fontSize:11,color:'#DAEAE9'}}>Active update: {active.updateId??'Unavailable'}</Text>
   <Text selectable style={{fontSize:11,color:'#DAEAE9'}}>Downloaded update: {status.downloadedUpdate?.updateId??'None reported'}</Text>
   <Text selectable style={{fontSize:11,color:'#DAEAE9'}}>Expected Godot SHA: {GENESIS_GODOT_OTA_PACK.sha256}</Text>
  </View>:null}
 </View>;
}
