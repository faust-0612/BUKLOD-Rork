import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';

import { supabase } from '@/lib/supabase';
import { acquireBuklodAdSafetyLock } from '@/lib/buklodGlobalAdController';
import { registerPushToken } from '@/lib/pushNotifications';
import { emitBuklodEmergencySignal, isBuklodEmergencyId } from '@/lib/buklodEmergencySignal';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

type HelpKind = 'HELP' | 'EMERGENCY';
type HelpCategory = 'GENERAL'|'MEDICAL'|'FIRE'|'ACCIDENT'|'SAFETY'|'DISASTER'|'MISSING_PERSON'|'OTHER';
type HelpResponse = 'CAN_HELP'|'ON_MY_WAY'|'CONFIRM_INCIDENT'|'CANNOT_HELP'|'FALSE_ALERT';
type NearbyHelp = {
  id:string; creator_id:string; kind:HelpKind; category:HelpCategory; message:string;
  status:string; distance_km:number|null; created_at:string; expires_at:string;
  can_help_count:number; on_my_way_count:number; confirm_count:number; my_response:HelpResponse|null;
};

type CategoryOption = {
  key:HelpCategory;
  label:string;
  icon:keyof typeof MaterialCommunityIcons.glyphMap;
};

const EMERGENCY_CATEGORIES:CategoryOption[]=[
  {key:'MEDICAL',label:'Medical',icon:'medical-bag'},
  {key:'FIRE',label:'Fire',icon:'fire'},
  {key:'ACCIDENT',label:'Accident',icon:'car-emergency'},
  {key:'SAFETY',label:'Safety',icon:'shield-alert-outline'},
  {key:'DISASTER',label:'Disaster',icon:'weather-hurricane'},
  {key:'MISSING_PERSON',label:'Missing',icon:'account-search-outline'},
  {key:'OTHER',label:'Other',icon:'alert-circle-outline'},
];
const HELP_CATEGORIES:CategoryOption[]=[
  {key:'GENERAL',label:'General',icon:'hand-heart-outline'},
  ...EMERGENCY_CATEGORIES,
];

function categoryLabel(value:HelpCategory){
  return HELP_CATEGORIES.find(item=>item.key===value)?.label??'Help';
}
function relativeAge(iso:string){
  const minutes=Math.floor(Math.max(0,Date.now()-new Date(iso).getTime())/60000);
  if(minutes<1)return 'now';
  if(minutes<60)return `${minutes}m`;
  const hours=Math.floor(minutes/60);
  return hours<24?`${hours}h`:`${Math.floor(hours/24)}d`;
}

export default function BuklodCommunityHelp(){
  const {user}=useAuth();
  const {colors}=useBuklodPresentation();
  const s=useMemo(()=>styles(colors),[colors]);
  const mounted=useRef(true);
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [nearby,setNearby]=useState<NearbyHelp[]>([]);
  const [open,setOpen]=useState(false);
  const [kind,setKind]=useState<HelpKind>('HELP');
  const [category,setCategory]=useState<HelpCategory>('GENERAL');
  const [message,setMessage]=useState('');

  useEffect(()=>()=>{mounted.current=false},[]);

  useEffect(()=>{
    if(!open)return;
    return acquireBuklodAdSafetyLock(
      kind==='EMERGENCY'?'transaction':'form'
    );
  },[kind,open]);


  const refresh=useCallback(async()=>{
    if(!user?.id)return;
    setLoading(true);
    try{
      const {data,error}=await supabase.rpc('buklod_help_list_nearby',{p_limit:12});
      if(error)throw error;
      if(mounted.current)setNearby((data??[]) as NearbyHelp[]);
    }catch{
      if(mounted.current)setNearby([]);
    }finally{
      if(mounted.current)setLoading(false);
    }
  },[user?.id]);

  const ensurePresence=useCallback(async(showErrors=true)=>{
    if(!user?.id)return null;
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){
        if(showErrors)Alert.alert('Location needed','Nearby Help and SOS need location permission to match you with BUKLOD users nearby.');
        return null;
      }
      const loc=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const coords={latitude:loc.coords.latitude,longitude:loc.coords.longitude};
      const {error}=await supabase.rpc('buklod_help_update_presence',{
        p_latitude:coords.latitude,p_longitude:coords.longitude,p_enabled:true,
      });
      if(error)throw error;
      if(mounted.current)setEnabled(true);
      void registerPushToken(user.id).catch(()=>undefined);
      return coords;
    }catch(error:any){
      if(showErrors)Alert.alert('Nearby alerts unavailable',String(error?.message??'Please try again.'));
      return null;
    }
  },[user?.id]);

  const disablePresence=useCallback(()=>{
    Alert.alert(
      'Turn off nearby safety alerts?',
      'Your stored nearby-presence location will be deleted. Existing help or SOS requests you already sent remain active until you resolve or cancel them.',
      [
        {text:'Keep on',style:'cancel'},
        {text:'Turn off',style:'destructive',onPress:async()=>{
          const {error}=await supabase.rpc('buklod_help_disable_presence');
          if(error){Alert.alert('Could not turn off alerts',error.message);return}
          if(mounted.current){setEnabled(false);setNearby([])}
        }},
      ],
    );
  },[]);

  useEffect(()=>{
    if(!user?.id)return;
    void (async()=>{
      try{
        const {data}=await supabase.from('buklod_help_presence')
          .select('safety_alerts_enabled,updated_at').eq('user_id',user.id).maybeSingle();
        const fresh=Boolean(data?.updated_at)&&Date.now()-new Date(data!.updated_at).getTime()<60*60*1000;
        if(data?.safety_alerts_enabled&&fresh&&mounted.current)setEnabled(true);
      }catch{}
    })();
  },[user?.id]);

  useEffect(()=>{
    if(!enabled)return;
    void refresh();
    const feed=setInterval(()=>void refresh(),20000);
    const presence=setInterval(()=>void ensurePresence(false),5*60*1000);
    return()=>{clearInterval(feed);clearInterval(presence)};
  },[enabled,ensurePresence,refresh]);

  const begin=(next:HelpKind)=>{
    if(!user?.id){Alert.alert('Sign in required','Please sign in before requesting help.');return}
    setKind(next);
    setCategory(next==='EMERGENCY'?'MEDICAL':'GENERAL');
    setMessage('');
    setOpen(true);
  };

  const submit=useCallback(async()=>{
    if(busy)return;
    setBusy(true);
    try{
      if(kind==='EMERGENCY'){
        /* BUKLOD_SOS_LOCAL_AUTH_R2
         * Deliberate SOS send requires local device confirmation before GPS
         * capture and server fan-out. Device PIN remains the fallback.
         */
        const authLevel=await LocalAuthentication
          .getEnrolledLevelAsync()
          .catch(()=>LocalAuthentication.SecurityLevel.NONE);

        if(authLevel!==LocalAuthentication.SecurityLevel.NONE){
          const verified=await LocalAuthentication.authenticateAsync({
            promptMessage:'Confirm Emergency SOS',
            promptSubtitle:'Send an urgent nearby BUKLOD alert',
            promptDescription:'Confirm with fingerprint, Face ID, or device PIN.',
            cancelLabel:'Cancel',
            fallbackLabel:'Use device PIN',
            disableDeviceFallback:false,
            requireConfirmation:true,
          });
          if(!verified.success){
            Alert.alert('SOS cancelled','Emergency SOS was not sent.');
            return;
          }
        }
      }

      const coords=await ensurePresence(true);
      if(!coords)return;
      const {data,error}=await supabase.rpc('buklod_help_create_request',{
        p_kind:kind,p_category:category,p_message:message.trim(),
        p_latitude:coords.latitude,p_longitude:coords.longitude,
      });
      if(error)throw error;
      const requestId=String(data??'');
      setOpen(false);setMessage('');
      // The authenticated request exists. Surface the global dashboard now,
      // not after a feed refresh or potentially slow push fan-out.
      if(kind==='EMERGENCY'&&isBuklodEmergencyId(requestId)){
        emitBuklodEmergencySignal({ incidentId: requestId, origin: 'sender' });
      }
      void refresh();
      if(kind==='EMERGENCY'&&isBuklodEmergencyId(requestId)){
        const result=await supabase.functions.invoke('buklod-help-alert',{body:{request_id:requestId}});
        // Do not cover the new emergency screen with another success Alert.
        // Failed dispatch is NOT failed emergency creation: keep SOS active.
        if(result.error){
          Alert.alert('SOS active · delivery unconfirmed',
            'Your SOS is active on BUKLOD, but nearby push delivery could not be confirmed. Contact official emergency services too.');
        }
      }
    }catch(error:any){
      const raw=String(error?.message??'Please try again.');
      const friendly=raw.includes('ACTIVE_EMERGENCY_EXISTS')
        ? 'You already have an active emergency. Resolve it before sending another.'
        : raw.includes('PLEASE_WAIT_BEFORE_SENDING_AGAIN')
          ? 'Please wait a few seconds before sending another request.'
          : raw;
      Alert.alert(kind==='EMERGENCY'?'SOS not sent':'Help request not sent',friendly);
    }finally{if(mounted.current)setBusy(false)}
  },[busy,category,ensurePresence,kind,message,refresh]);

  const respond=useCallback(async(id:string,response:HelpResponse)=>{
    const {error}=await supabase.rpc('buklod_help_respond',{p_request_id:id,p_response_type:response});
    if(error)Alert.alert('Response not saved',error.message);else await refresh();
  },[refresh]);

  const flagFalseAlert=useCallback((id:string)=>{
    Alert.alert('Flag possible false alert?','This records your safety signal for review. Do not use it just because you cannot personally verify the incident.',[
      {text:'Cancel',style:'cancel'},
      {text:'Flag',style:'destructive',onPress:()=>void respond(id,'FALSE_ALERT')},
    ]);
  },[respond]);

  const resolve=(id:string)=>Alert.alert('End this alert?','Use this when you are safe or no longer need help.',[
    {text:'Keep active',style:'cancel'},
    {text:"I'm safe / Resolve",onPress:async()=>{
      const {error}=await supabase.rpc('buklod_help_resolve',{p_request_id:id,p_status:'RESOLVED'});
      if(error)Alert.alert('Could not resolve alert',error.message);else await refresh();
    }},
  ]);

  const options=kind==='EMERGENCY'?EMERGENCY_CATEGORIES:HELP_CATEGORIES;

  return <View style={s.wrap}>
    <View style={s.bar}>
      <View style={s.brand}>
        <MaterialCommunityIcons name="head-heart-outline" size={17} color={colors.greenDark}/>
        <View style={{flex:1}}><Text style={s.title}>BUKLOD HELP</Text><Text style={s.sub}>Ask nearby. Respond nearby.</Text></View>
      </View>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Request help from nearby BUKLOD users" onPress={()=>begin('HELP')} style={({pressed})=>[s.help,pressed&&s.pressed]}>
          <MaterialCommunityIcons name="hand-heart-outline" size={15} color={colors.greenDark}/><Text style={s.helpText}>Need Help</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open emergency SOS" onPress={()=>begin('EMERGENCY')} style={({pressed})=>[s.sos,pressed&&s.pressed]}>
          <MaterialCommunityIcons name="alarm-light-outline" size={15} color="#FFF"/><Text style={s.sosText}>SOS</Text>
        </Pressable>
      </View>
    </View>

    {!enabled?<Pressable onPress={()=>void ensurePresence(true)} style={s.enable}>
      <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color={colors.greenDark}/>
      <Text style={s.enableText}>Enable nearby safety alerts</Text>
      <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted}/>
    </Pressable>:<View style={s.enable}>
      <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.greenDark}/>
      <Text style={s.enableText}>Nearby safety alerts on</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Turn off nearby safety alerts" onPress={disablePresence}><Text style={s.turnOff}>Turn off</Text></Pressable>
    </View>}

    {enabled&&(loading||nearby.length>0)?<View style={s.nearby}>
      <View style={s.nearbyHead}><Text style={s.nearbyTitle}>NEARBY NOW</Text>{loading?<ActivityIndicator size="small" color={colors.green}/>:null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cards}>
        {nearby.map(item=>{
          const mine=item.creator_id===user?.id;
          const emergency=item.kind==='EMERGENCY';
          return <View key={item.id} style={[s.card,emergency&&s.emergencyCard]}>
            <View style={s.cardHead}>
              <MaterialCommunityIcons name={emergency?'alarm-light':'hand-heart-outline'} size={15} color={emergency?'#B42318':colors.greenDark}/>
              <Text style={[s.cardKind,emergency&&s.red]}>{emergency?'EMERGENCY':'NEED HELP'} · {categoryLabel(item.category)}</Text>
            </View>
            <Text numberOfLines={2} style={s.cardBody}>{item.message||(emergency?'Emergency assistance requested.':'A nearby BUKLOD member needs help.')}</Text>
            <Text style={s.meta}>{mine?'Your alert':`${Number(item.distance_km??0).toFixed(1)} km away`} · {relativeAge(item.created_at)}</Text>
            <Text style={s.meta}>{Number(item.on_my_way_count??0)} going · {Number(item.confirm_count??0)} confirmed</Text>
            {mine?<Pressable onPress={()=>resolve(item.id)} style={s.resolve}><Text style={s.resolveText}>I'M SAFE / RESOLVE</Text></Pressable>:
              <View style={s.responseRow}>
                <Pressable onPress={()=>void respond(item.id,'CAN_HELP')} style={[s.response,item.my_response==='CAN_HELP'&&s.responseOn]}><Text style={[s.responseText,item.my_response==='CAN_HELP'&&s.responseTextOn]}>CAN HELP</Text></Pressable>
                <Pressable onPress={()=>void respond(item.id,'ON_MY_WAY')} style={[s.response,item.my_response==='ON_MY_WAY'&&s.responseOn]}><Text style={[s.responseText,item.my_response==='ON_MY_WAY'&&s.responseTextOn]}>ON MY WAY</Text></Pressable>
                {emergency?<Pressable accessibilityLabel="Confirm incident" onPress={()=>void respond(item.id,'CONFIRM_INCIDENT')} style={s.confirm}><MaterialCommunityIcons name="check-decagram-outline" size={15} color={colors.greenDark}/></Pressable>:null}
                <Pressable accessibilityLabel="Flag possible false alert" onPress={()=>flagFalseAlert(item.id)} style={s.confirm}><MaterialCommunityIcons name="flag-outline" size={15} color={colors.muted}/></Pressable>
              </View>}
          </View>;
        })}
      </ScrollView>
    </View>:null}

    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>!busy&&setOpen(false)}>
      <View style={s.backdrop}><View style={s.sheet}>
        <View style={s.sheetHead}>
          <View style={{flex:1}}><Text style={[s.sheetTitle,kind==='EMERGENCY'&&s.red]}>{kind==='EMERGENCY'?'Emergency SOS':'Need Help'}</Text>
          <Text style={s.sheetHint}>{kind==='EMERGENCY'?'BUKLOD community alert — not a replacement for official emergency services.':'Nearby BUKLOD users can see and respond to your request.'}</Text></View>
          <Pressable disabled={busy} onPress={()=>setOpen(false)} style={s.close}><MaterialCommunityIcons name="close" size={20} color={colors.text}/></Pressable>
        </View>
        <Text style={s.label}>TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
          {options.map(item=>{const on=item.key===category;return <Pressable key={item.key} onPress={()=>setCategory(item.key)} style={[s.category,on&&s.categoryOn]}>
            <MaterialCommunityIcons name={item.icon} size={14} color={on?'#FFF':colors.greenDark}/><Text style={[s.categoryText,on&&s.categoryTextOn]}>{item.label}</Text>
          </Pressable>})}
        </ScrollView>
        <Text style={s.label}>DETAILS {kind==='EMERGENCY'?'(OPTIONAL)':''}</Text>
        <TextInput value={message} onChangeText={v=>setMessage(v.slice(0,500))} editable={!busy} multiline
          placeholder={kind==='EMERGENCY'?'Short detail if you can type safely…':'What kind of help do you need?'} placeholderTextColor={colors.muted} style={s.input}/>
        {kind==='EMERGENCY'?<>
          <Text style={s.privacy}>Exact location is used only for proximity matching. Nearby users receive approximate distance, not raw coordinates.</Text>
          <Pressable disabled={busy} delayLongPress={1800} onLongPress={()=>void submit()} style={({pressed})=>[s.hold,pressed&&s.pressed,busy&&{opacity:.55}]}>
            {busy?<ActivityIndicator color="#FFF"/>:<MaterialCommunityIcons name="gesture-tap-hold" size={20} color="#FFF"/>}<Text style={s.holdText}>{busy?'SENDING…':'HOLD TO SEND SOS'}</Text>
          </Pressable><Text style={s.holdHint}>Hold for about 2 seconds to prevent accidental emergency alerts.</Text>
        </>:<Pressable disabled={busy} onPress={()=>void submit()} style={[s.submit,busy&&{opacity:.55}]}>
          {busy?<ActivityIndicator color="#FFF"/>:<MaterialCommunityIcons name="send" size={17} color="#FFF"/>}<Text style={s.submitText}>{busy?'POSTING…':'ASK NEARBY'}</Text>
        </Pressable>}
      </View></View>
    </Modal>
  </View>;
}

function styles(colors:ReturnType<typeof useBuklodPresentation>['colors']){
  return StyleSheet.create({
    wrap:{marginTop:5,marginBottom:10},
    bar:{minHeight:52,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:colors.white,borderRadius:16,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
    brand:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},title:{color:colors.greenDark,fontSize:10,fontWeight:'900',letterSpacing:.7},sub:{color:colors.muted,fontSize:8.5,fontWeight:'700',marginTop:1},
    actions:{flexDirection:'row',alignItems:'center',gap:6},help:{height:34,paddingHorizontal:10,borderRadius:17,backgroundColor:`${colors.green}12`,flexDirection:'row',alignItems:'center',gap:5},helpText:{color:colors.greenDark,fontSize:9.5,fontWeight:'900'},
    sos:{height:34,minWidth:62,paddingHorizontal:10,borderRadius:17,backgroundColor:'#B42318',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},sosText:{color:'#FFF',fontSize:10,fontWeight:'900'},pressed:{opacity:.72,transform:[{scale:.98}]},
    enable:{marginTop:6,minHeight:32,paddingHorizontal:9,borderRadius:10,backgroundColor:`${colors.green}0C`,flexDirection:'row',alignItems:'center',gap:6},enableText:{flex:1,color:colors.greenDark,fontSize:9,fontWeight:'800'},turnOff:{color:colors.muted,fontSize:8.5,fontWeight:'800',textDecorationLine:'underline'},
    nearby:{marginTop:8},nearbyHead:{minHeight:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},nearbyTitle:{color:colors.muted,fontSize:8.5,fontWeight:'900',letterSpacing:.6},cards:{gap:8,paddingRight:10},
    card:{width:264,minHeight:142,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:colors.white,padding:10},emergencyCard:{borderColor:'#F2B8B5',backgroundColor:'#FFF9F8'},cardHead:{flexDirection:'row',alignItems:'center',gap:5},cardKind:{flex:1,color:colors.greenDark,fontSize:8.5,fontWeight:'900'},red:{color:'#B42318'},
    cardBody:{color:colors.text,fontSize:11,lineHeight:15,fontWeight:'700',marginTop:7,minHeight:30},meta:{color:colors.muted,fontSize:8.5,fontWeight:'700',marginTop:3},responseRow:{flexDirection:'row',gap:5,marginTop:9},response:{minHeight:28,paddingHorizontal:8,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,alignItems:'center',justifyContent:'center'},responseOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},responseText:{color:colors.greenDark,fontSize:7.5,fontWeight:'900'},responseTextOn:{color:'#FFF'},confirm:{width:30,height:28,borderRadius:14,backgroundColor:`${colors.green}12`,alignItems:'center',justifyContent:'center'},resolve:{marginTop:9,minHeight:29,borderRadius:15,backgroundColor:colors.greenDark,alignItems:'center',justifyContent:'center'},resolveText:{color:'#FFF',fontSize:8,fontWeight:'900'},
    backdrop:{flex:1,backgroundColor:'rgba(7,15,10,.55)',justifyContent:'flex-end'},sheet:{maxHeight:'86%',borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.white,paddingHorizontal:16,paddingTop:15,paddingBottom:22},sheetHead:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},sheetTitle:{color:colors.text,fontSize:17,fontWeight:'900'},sheetHint:{maxWidth:310,color:colors.muted,fontSize:9.5,lineHeight:13,fontWeight:'700',marginTop:3},close:{width:34,height:34,borderRadius:17,backgroundColor:`${colors.text}08`,alignItems:'center',justifyContent:'center'},
    label:{color:colors.muted,fontSize:8.5,fontWeight:'900',letterSpacing:.7,marginBottom:6,marginTop:3},categoryRow:{gap:7,paddingBottom:12},category:{minHeight:34,paddingHorizontal:10,borderRadius:17,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:5},categoryOn:{backgroundColor:colors.greenDark,borderColor:colors.greenDark},categoryText:{color:colors.greenDark,fontSize:9,fontWeight:'800'},categoryTextOn:{color:'#FFF'},
    input:{minHeight:92,maxHeight:150,borderWidth:1,borderColor:colors.line,borderRadius:13,paddingHorizontal:11,paddingVertical:10,color:colors.text,fontSize:12,lineHeight:17,textAlignVertical:'top',marginBottom:12},privacy:{color:colors.muted,fontSize:9,lineHeight:13,fontWeight:'700',marginBottom:11},hold:{minHeight:50,borderRadius:16,backgroundColor:'#B42318',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},holdText:{color:'#FFF',fontSize:11,fontWeight:'900',letterSpacing:.5},holdHint:{color:colors.muted,fontSize:8.5,textAlign:'center',fontWeight:'700',marginTop:6},submit:{minHeight:48,borderRadius:16,backgroundColor:colors.greenDark,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},submitText:{color:'#FFF',fontSize:10.5,fontWeight:'900'},
  });
}
