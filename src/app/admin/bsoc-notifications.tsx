import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';
type Note={id:string;title:string;body:string;kind:string;created_at:string;read_at:string|null;data:any};
export default function BsocNotifications(){
 const [allowed,setAllowed]=useState<boolean|null>(null),[items,setItems]=useState<Note[]>([]);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const check=useCallback(async()=>{
  const {data,error}=await supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.read'});
  setAllowed(!error&&data===true);
 },[]);
 const refresh=useCallback(async()=>{
  setBusy(true);
  const {data,error}=await supabase.from('notifications').select('id,title,body,kind,created_at,read_at,data')
    .eq('kind','bsoc_support').order('created_at',{ascending:false}).limit(80);
  if(error)setError(error.message);else{setItems((data||[]) as Note[]);setError('');}
  setBusy(false);
 },[]);
 useEffect(()=>{void check();},[check]);
 useEffect(()=>{
  if(!allowed)return;
  void refresh();
  const ch=supabase.channel('bsoc-my-notifications').on('postgres_changes',{
   event:'INSERT',schema:'public',table:'notifications'
  },()=>void refresh()).subscribe();
  return ()=>{void supabase.removeChannel(ch);};
 },[allowed,refresh]);
 const open=async(item:Note)=>{
  if(!item.read_at)await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id).is('read_at',null);
  // The destination still checks authorization server-side.
  router.push('/admin/bsoc-conversations' as any);
 };
 return <ScrollView contentContainerStyle={styles.content} style={styles.page}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BSOC</Text></Pressable>
  <Text style={styles.title}>BSOC Notifications</Text>
  <Text style={styles.muted}>For authorized support personnel. Member concerns are private and never displayed to unauthorized operators.</Text>
  {allowed===null?<ActivityIndicator color={colors.green}/>:!allowed?
    <Text style={styles.error}>Your BUKLOD account does not currently have BSOC support-read access.</Text>:
    <>
     <View style={styles.bar}>
      <Text style={styles.bold}>Unread: {items.filter(x=>!x.read_at).length}</Text>
      <Pressable onPress={()=>void refresh()}><Text style={styles.link}>{busy?'Refreshing…':'Refresh'}</Text></Pressable>
     </View>
     {!!error&&<Text style={styles.error}>{error}</Text>}
     {!items.length&&<Text style={styles.muted}>No support notifications yet.</Text>}
     {items.map(item=><Pressable key={item.id} onPress={()=>void open(item)} style={[styles.card,!item.read_at&&styles.unread]}>
       <Text style={styles.bold}>{item.title}</Text><Text style={styles.body}>{item.body}</Text>
       <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}{item.read_at?' · Read':' · Unread'}</Text>
     </Pressable>)}
    </>
  }
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{gap:12,padding:18,paddingBottom:85},
 title:{fontSize:24,fontWeight:'800',color:colors.text},bold:{fontWeight:'800',color:colors.text},
 body:{color:colors.text,fontSize:14},muted:{color:'#64748b',fontSize:12,lineHeight:19},
 link:{color:colors.green,fontWeight:'800'},error:{color:'#991b1b',backgroundColor:'#fee2e2',padding:12},
 card:{padding:14,borderColor:'#d7e5e0',borderWidth:1,borderRadius:12,gap:7},
 unread:{backgroundColor:'#e9f8f0',borderColor:colors.green},
 bar:{flexDirection:'row',justifyContent:'space-between',padding:10}
});
