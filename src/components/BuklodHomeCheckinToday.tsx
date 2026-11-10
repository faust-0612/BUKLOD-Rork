import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {showBuklodAdOpportunity,warmBuklodAdOpportunity} from '@/lib/buklodAdOpportunities';
type LiveEvent={event_id:string;title:string;location:string;scope_name:string;starts_at:string;ends_at:string;
 checkin_id?:string;checkin_status?:'pending'|'approved'|'rejected';checked_in_at?:string};
export default function BuklodHomeCheckinToday({scopeId}:{scopeId?:string}={}){
 const[events,setEvents]=useState<LiveEvent[]>([]);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState<string|null>(null);
 const[message,setMessage]=useState('');
 const {session}=useAuth();
 const context=`${session?.user?.id??''}:${scopeId??'all'}`;
 const contextRef=useRef(context);
 const lastSuccessRef=useRef({context:'',at:0});
 const inFlightRef=useRef(false);
 if(contextRef.current!==context){
  contextRef.current=context;
  lastSuccessRef.current={context:'',at:0};
 }
 const load=useCallback(async()=>{
  if(!session?.user?.id||inFlightRef.current)return;
  inFlightRef.current=true;
  const requestedContext=context;
  // Only the first uncached request shows a full loading state.
  if(lastSuccessRef.current.context!==context)setLoading(true);
  try{
   const{data,error}=await(supabase as any).rpc('get_my_buklod_home_checkin_today_r3');
   if(error)throw error;
   if(contextRef.current!==requestedContext)return;
   const rows=Array.isArray(data)?data:[];
   setEvents(scopeId?rows.filter((item:any)=>String(item.scope_id)===scopeId):rows);
   lastSuccessRef.current={context,at:Date.now()};
   setMessage('');
  }catch{
   if(contextRef.current===requestedContext){
    setMessage('Unable to refresh check-in status. Previously loaded events remain visible.');
   }
  }
  finally{inFlightRef.current=false;if(contextRef.current===requestedContext)setLoading(false)}
 },[scopeId,session?.user?.id,context]);
 useEffect(()=>{warmBuklodAdOpportunity('points_submission_success')},[]);
 useFocusEffect(useCallback(()=>{
   const cached=lastSuccessRef.current;
   if(cached.context!==context||Date.now()-cached.at>=60_000)void load();
   // Server check-ins stay authoritative; no refetch merely from tab switching.
   const tick=setInterval(()=>{void load()},60000);
   return ()=>clearInterval(tick);
 },[load,context]));
 const submit=async(item:LiveEvent)=>{
  if(busy||item.checkin_status)return;
  setBusy(item.event_id);setMessage('');
  try{
   const{data,error}=await(supabase as any).rpc('submit_my_buklod_home_checkin_r3',{p_event_id:item.event_id});
   if(error)throw error;
   setMessage(`Check-in received for ${data.event}. Awaiting Admin verification for +10 BP.`);
   await load();showBuklodAdOpportunity('points_submission_success');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not check in. Try again.');}
  finally{setBusy(null)}
 };
 if(!loading&&events.length===0&&!message)return null;
 return <View style={styles.container}>
  <View style={styles.heading}>
   <MaterialCommunityIcons name="calendar-check" color="#1B7843" size={22}/>
   <View style={{flex:1}}>
    <Text style={styles.title}>Check In Today</Text>
    <Text style={styles.caption}>Only during a live Cluster event · +10 BP after Admin verification</Text>
   </View>
  </View>
  {loading&&<ActivityIndicator color="#167944"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
  {events.map(item=><View key={item.event_id} style={styles.event}>
   <Text style={styles.eventTitle}>{item.title} · {item.scope_name}</Text>
   <Text style={styles.details}>Venue: {item.location}</Text>
   <Text style={styles.details}>When: {new Date(item.starts_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})}</Text>
   <Text style={styles.details}>After check-in, the Admin sees the recorded time and event location. One reward per event, no separate attendance app.</Text>
   <Pressable accessibilityRole="button" disabled={busy!==null||!!item.checkin_status}
    onPress={()=>void submit(item)} style={[styles.button,(!!item.checkin_status||!!busy)&&styles.disabled]}>
    <Text style={styles.buttonText}>{item.checkin_status==='approved'?'Verified · Points recorded':
     item.checkin_status==='pending'?'Pending Admin verification':
     item.checkin_status==='rejected'?'Not approved':busy===item.event_id?'Checking in...':'Check In Today · +10 BP'}</Text>
   </Pressable>
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 container:{marginHorizontal:12,marginVertical:8,padding:14,borderRadius:17,
  backgroundColor:'#FFFFFF',borderColor:'#CFE5D1',borderWidth:1,gap:12},
 heading:{flexDirection:'row',gap:10,alignItems:'center'},
 title:{color:'#174E30',fontWeight:'900',fontSize:16},
 caption:{color:'#62816B',fontSize:11,lineHeight:16},
 event:{padding:12,backgroundColor:'#F3FAF4',borderRadius:13,gap:6},
 eventTitle:{fontSize:13,fontWeight:'900',color:'#265437'},
 details:{fontSize:11,color:'#54715B',lineHeight:16},
 button:{padding:12,borderRadius:10,backgroundColor:'#107840',alignItems:'center',marginTop:4},
 disabled:{opacity:0.62},buttonText:{color:'white',fontSize:12,fontWeight:'900'},
 message:{padding:9,borderRadius:9,backgroundColor:'#FFF5DF',color:'#735219',fontSize:11}
});
