import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import {getGenesisLaunchStatus,openBundledBuklodWorld,type BuklodGodotWorld} from '../../../../modules/buklod-genesis-godot';
const TITLES:Record<BuklodGodotWorld,string>={kingdom:'LIVING KINGDOM',house:'MY HOUSE',community:'MY COMMUNITY'};
const LEGACY_LABEL:Record<BuklodGodotWorld,string>={kingdom:'CHARACTER STATIONS & COLLECTION',house:'HOUSE & PROPERTY TOOLS',community:'COMMUNITY & PROPERTY TOOLS'};

export default function GenesisNativeWorldEntry({world,fallback}:{world:BuklodGodotWorld;fallback:React.ReactNode}){
 const pendingKey='@buklod/genesis-godot-v207/'+world+'-pending';
 const [message,setMessage]=useState('Binubuksan ang '+TITLES[world]+'…');
 const [busy,setBusy]=useState(false);
 const [legacy,setLegacy]=useState(false);
 const launching=useRef(false),alive=useRef(true);
 const previousToken=useRef<string|undefined>(undefined);
 const attemptStarted=useRef(false);
 const launch=useCallback(async(explicitRetry=false)=>{
  if(launching.current)return;
  launching.current=true;setBusy(true);
  try{
   const pending=await AsyncStorage.getItem(pendingKey);
   if(!explicitRetry&&pending==='pending'){
    if(alive.current)setMessage('Previous engine launch was not confirmed. Tap Enter to retry.');
    return;
   }
   previousToken.current=(await getGenesisLaunchStatus()).token;
   attemptStarted.current=true;
   await AsyncStorage.setItem(pendingKey,'pending');
   if(alive.current)setMessage('Loading verified native world…');
   const started=await openBundledBuklodWorld(world);
   if(!started)await AsyncStorage.removeItem(pendingKey);
   if(alive.current)setMessage(started?'Native launch requested. Waiting for engine receipt.':'Hindi nabuksan ang native world.');
  }catch{if(alive.current)setMessage('Hindi nabuksan ang world. Retry is available.');}
  finally{launching.current=false;if(alive.current)setBusy(false);}
 },[pendingKey,world]);
 useEffect(()=>{
  alive.current=true;
  const subscription=AppState.addEventListener('change',state=>{
   if(state!=='active'||!attemptStarted.current)return;
   void getGenesisLaunchStatus().then(receipt=>{
    if(!alive.current||!receipt.token||receipt.token===previousToken.current||receipt.world!==world)return;
    if(receipt.state==='ready')void AsyncStorage.removeItem(pendingKey);
    setMessage(receipt.state==='ready'?'World rendered • '+(receipt.pack==='embedded'?'APK content':receipt.pack?.slice(0,12)):'Engine: '+receipt.state+(receipt.reason?' • '+receipt.reason:''));
   });
  });
  void launch();
  return()=>{alive.current=false;subscription.remove();};
 },[launch,pendingKey,world]);
 if(legacy)return <>{fallback}</>;
 return <View style={{flex:1,backgroundColor:'#071523',justifyContent:'center',padding:24,gap:16}}>
  <Text style={{color:'#FFE4AA',fontSize:24,fontWeight:'900'}}>BUKLOD {TITLES[world]}</Text>
  <Text style={{color:'#DCECE9'}}>{message}</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void launch(true)} style={{padding:14,backgroundColor:'#37795F',borderRadius:10,opacity:busy?0.6:1}}><Text style={{color:'#fff',textAlign:'center'}}>{busy?'OPENING…':'ENTER '+TITLES[world]}</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setLegacy(true)} style={{padding:14}}><Text style={{color:'#E4DAB9',textAlign:'center'}}>{LEGACY_LABEL[world]}</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>router.back()} style={{padding:14}}><Text style={{color:'#DCECE9',textAlign:'center'}}>BACK TO BUKLOD</Text></Pressable>
 </View>;
}
