import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

export default function BuklodBirthdayGreetingPrivacy(){
  const [loading,setLoading]=useState(true);
  const [share,setShare]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let mounted=true;
    void (async()=>{
      try{
        const {data,error:rpcError}=await (supabase as any).rpc('buklod_my_living_greetings_v1');
        if(rpcError)throw rpcError;
        if(mounted)setShare(data?.share_birthday===true);
      }catch(e:any){
        if(mounted)setError(String(e?.message||'Birthday preference unavailable.'));
      }finally{if(mounted)setLoading(false);}
    })();
    return()=>{mounted=false;};
  },[]);

  const setPreference=async()=>{
    if(busy||loading)return;
    setBusy(true);setError('');setNotice('');
    const next=!share;
    try{
      const {data,error:rpcError}=await (supabase as any).rpc('buklod_set_my_birthday_sharing_v1',{p_allow:next});
      if(rpcError)throw rpcError;
      if(data!==next)throw Error('Could not confirm your birthday sharing setting.');
      setShare(next);
      setNotice(next?'You can now receive birthday greetings from followers and Cluster members.':'Your birthday will no longer be announced to followers and Cluster members.');
    }catch(e:any){setError(String(e?.message||'Preference update failed.'));}
    finally{setBusy(false);}
  };
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Pressable onPress={()=>router.back()} accessibilityRole="button"><Text style={s.back}>‹ Back</Text></Pressable>
    <Text style={s.heading}>BUKLOD Birthday Greetings</Text>
    <Text style={s.info}>BUKLOD will greet you privately on your birthday. Sharing that occasion with followers and members of your Clusters is optional and is off by default. Your full birth date is not displayed in notifications.</Text>
    {loading?<ActivityIndicator color="#135D43"/>:<View style={s.card}>
      <Text style={s.label}>{share?'Share birthday greetings with my community':'Keep birthday greetings private'}</Text>
      <Text style={s.info}>{share?'Followers and fellow active Cluster members can receive a birthday greeting when the day arrives.':'Only you receive your birthday greeting. Your followers and Cluster members are not notified.'}</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{checked:share,disabled:busy}} onPress={()=>void setPreference()} disabled={busy} style={[s.toggle,share&&s.on]}>
        <Text style={s.toggleText}>{busy?'Saving…':share?'Sharing enabled — turn off':'Private — enable sharing'}</Text>
      </Pressable>
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    <Text style={s.info}>Community announcements follow your existing BUKLOD notification preferences. No separate church account is required.</Text>
  </ScrollView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#FFF'},content:{padding:20,paddingBottom:70,gap:16},
 back:{color:'#135D43',fontSize:14,fontWeight:'800'},
 heading:{fontSize:23,fontWeight:'900',color:'#183C31'},
 info:{color:'#506C60',fontSize:13,lineHeight:20},
 card:{padding:16,borderRadius:16,borderWidth:1,borderColor:'#C4E5CF',gap:12},
 label:{fontSize:16,fontWeight:'800',color:'#183C31'},
 toggle:{borderRadius:12,padding:13,backgroundColor:'#667779',alignItems:'center'},
 on:{backgroundColor:'#135D43'},
 toggleText:{color:'white',fontWeight:'800',fontSize:13},
 error:{padding:10,backgroundColor:'#FCE7E7',color:'#991B1B'},
 notice:{padding:10,backgroundColor:'#E6F7ED',color:'#135D43'}
});
