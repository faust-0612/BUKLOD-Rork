import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';

export default function BsocPersonnelAccess(){
 const [loggedIn,setLoggedIn]=useState<boolean|null>(null);
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 const [access,setAccess]=useState<any>(null);
 useEffect(()=>{
  let mounted=true;
  void supabase.auth.getUser().then(({data})=>{
   if(mounted)setLoggedIn(!!data.user);
  }).catch(()=>{if(mounted)setLoggedIn(false);});
  return ()=>{mounted=false;};
 },[]);
 const refresh=async()=>{
  const {data,error}=await supabase.rpc('buklod_bsoc_my_access_v1');
  if(error)setError(error.message);else setAccess(data);
 };
 useEffect(()=>{if(loggedIn)void refresh();},[loggedIn]);
 const redeem=async()=>{
  if(busy||!loggedIn||code.trim().length<10)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const {data,error}=await supabase.rpc('buklod_bsoc_redeem_personnel_code_v1',{p_code:code.trim()});
   if(error)throw error;
   if(!data?.ok)throw Error(
     data?.error==='too_many_attempts'?'Too many attempts. Try again later.':
     'Code is invalid, expired, already used, or belongs to another BUKLOD account.'
   );
   setCode('');
   setSuccess('Authorization activated: '+String(data.role_key)+'. Complete required operator training before privileged production work.');
   await refresh();
  }catch(e:any){setError(String(e?.message||'Code redemption failed'));}
  finally{setBusy(false);}
 };
 return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable>
  <Text style={styles.title}>BUKLOD BSOC · Personnel Access</Text>
  <Text style={styles.hint}>Use the one-time code issued by the System Administrator for your own BUKLOD account. Your regular BUKLOD password is still required for sign-in. Codes cannot be transferred to another account.</Text>
  {loggedIn===null?<ActivityIndicator color={colors.green}/>:!loggedIn?
   <View style={styles.card}><Text style={styles.hint}>Sign in to the BUKLOD account selected by the System Administrator first.</Text>
    <Pressable style={styles.button} onPress={()=>router.push('/(auth)/login' as any)}>
     <Text style={styles.buttonText}>Open BUKLOD Login</Text>
    </Pressable></View>:
   <>
    {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    {!!success&&<Text style={styles.success}>{success}</Text>}
    <View style={styles.card}>
      <Text style={styles.heading}>Activate your approved role</Text>
      <TextInput value={code} onChangeText={setCode} style={styles.input}
       placeholder="BSOC-••••••••••••••••" autoCapitalize="characters"
       autoCorrect={false} secureTextEntry accessibilityLabel="One-time BSOC access code"/>
      <Pressable style={styles.button} disabled={busy||code.trim().length<10} onPress={()=>void redeem()}>
       <Text style={styles.buttonText}>{busy?'Verifying…':'Redeem access code'}</Text>
      </Pressable>
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>My BSOC authorization</Text>
      <Text style={styles.hint}>Roles: {Array.isArray(access?.roles)&&access.roles.length?access.roles.join(', '):'None yet'}</Text>
      <Text style={styles.hint}>Training: {access?.readiness?.training_status||'NOT_STARTED'} · Production access: {access?.readiness?.production_access_enabled?'Enabled':'Not enabled'}</Text>
      <Pressable onPress={()=>void refresh()}><Text style={styles.link}>Refresh access status</Text></Pressable>
      {access?.has_bsoc_access===true&&<Pressable style={styles.button} onPress={()=>router.push('/admin/bsoc-support' as any)}>
       <Text style={styles.buttonText}>Open authorized BSOC support</Text>
      </Pressable>}
    </View>
   </>
  }
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{padding:18,paddingBottom:80,gap:14},
 title:{fontSize:24,fontWeight:'800',color:colors.text},heading:{fontSize:17,fontWeight:'800',color:colors.text},
 hint:{fontSize:13,lineHeight:21,color:'#64748b'},link:{fontWeight:'800',color:colors.green},
 card:{padding:16,gap:14,borderWidth:1,borderColor:'#cbd5e1',borderRadius:14},
 input:{padding:13,borderWidth:1,borderColor:'#cbd5e1',borderRadius:11,color:colors.text},
 button:{backgroundColor:colors.green,alignItems:'center',borderRadius:11,padding:14},
 buttonText:{color:colors.white,fontWeight:'800'},error:{backgroundColor:'#fee2e2',color:'#991b1b',padding:12},
 success:{backgroundColor:'#dcfce7',color:'#166534',padding:12}
});
