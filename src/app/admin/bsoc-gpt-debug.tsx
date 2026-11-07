import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';
export default function BsocGptDebug(){
 const [allowed,setAllowed]=useState<boolean|null>(null);
 const [prompt,setPrompt]=useState(''),[answer,setAnswer]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
   void supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.read'})
    .then(({data,error})=>setAllowed(!error&&data===true));
 },[]);
 const inspect=useCallback(async()=>{
  if(busy||prompt.trim().length<15)return;
  setBusy(true);setAnswer('');setError('');
  try{
   const {data,error}=await supabase.functions.invoke('bsoc-gpt-debug-v1',{body:{prompt:prompt.trim()}});
   if(error)throw error;
   if(!data?.ok)throw Error(data?.message||data?.error||'GPT diagnostics unavailable');
   setAnswer(String(data.analysis||''));
  }catch(e:any){setError(String(e?.message||'Diagnostics unavailable'));}
  finally{setBusy(false);}
 },[prompt,busy]);
 return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
  <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BSOC</Text></Pressable>
  <Text style={styles.title}>BSOC · GPT Debug Assistant</Text>
  <Text style={styles.muted}>Technical investigation helper only. Results are suggestions, not executed fixes or verified tests.</Text>
  <View style={styles.notice}><Text style={styles.body}>Do not paste user chats, names, personal details, passwords, OTPs, API keys, full logs, photos or videos. Describe a sanitized error, app version and the affected module. No case data is sent automatically.</Text></View>
  {allowed===null?<ActivityIndicator color={colors.green}/>:!allowed?
    <Text style={styles.error}>Only authorized BSOC support personnel may use this tool.</Text>:
    <>
      <Text style={styles.label}>Sanitized problem description</Text>
      <TextInput value={prompt} onChangeText={setPrompt} multiline maxLength={3000} style={styles.input}
        placeholder="Example: Android 1.3.4 · Community Wall · video preview stays blank after switching tabs. What should we inspect and verify?"/>
      <Text style={styles.muted}>{prompt.length}/3000 characters. Analysis requires configured server-side OpenAI API access.</Text>
      <Pressable disabled={busy||prompt.trim().length<15} style={[styles.button,(busy||prompt.trim().length<15)&&styles.disabled]} onPress={()=>void inspect()}>
        <Text style={styles.buttonText}>{busy?'Analyzing…':'Ask GPT for diagnostics'}</Text>
      </Pressable>
      {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {!!answer&&<View style={styles.result}><Text style={styles.label}>Suggested checks</Text><Text selectable style={styles.body}>{answer}</Text></View>}
    </>
  }
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{gap:13,padding:18,paddingBottom:90},
 title:{fontSize:23,fontWeight:'800',color:colors.text},label:{fontSize:15,fontWeight:'800',color:colors.text},
 muted:{color:'#64748b',fontSize:12,lineHeight:19},body:{color:colors.text,fontSize:14,lineHeight:22},
 link:{color:colors.green,fontWeight:'800'},notice:{backgroundColor:'#eaf7f1',padding:14,borderRadius:12},
 input:{minHeight:160,borderColor:'#cbd5e1',borderWidth:1,borderRadius:12,padding:13,color:colors.text,textAlignVertical:'top'},
 button:{backgroundColor:colors.green,padding:13,alignItems:'center',borderRadius:11},
 disabled:{opacity:.5},buttonText:{color:colors.white,fontWeight:'800'},
 error:{color:'#991b1b',backgroundColor:'#fee2e2',padding:13,borderRadius:10},
 result:{padding:14,backgroundColor:'#f1f5f9',gap:10,borderRadius:12}
});
