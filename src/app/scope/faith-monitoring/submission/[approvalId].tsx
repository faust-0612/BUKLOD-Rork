import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {supabase} from '@/lib/supabase';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import {openMemberConnect} from '@/lib/buklodMemberProfile';

type History={
 approval_id:string;scope_id:string;item_kind:string;item_id:string;
 learner_id:string;learner_name:string;scope_name:string;title:string;
 subtitle:string;submitted_at:string|null;status:string;why:string|null;
 automatic_feedback:string|null;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one=(v:string|string[]|undefined)=>typeof v==='string'?v:Array.isArray(v)?v[0]??'':'';
export default function ExactFormationSubmissionReport(){
 const {theme}=useBuklodTheme();
 const p=useLocalSearchParams<{approvalId?:string|string[];scopeId?:string|string[];focusKind?:string|string[];itemId?:string|string[]}>();
 const id=one(p.approvalId).trim(),scopeId=one(p.scopeId).trim(),kind=one(p.focusKind).trim().toUpperCase(),itemId=one(p.itemId).trim();
 const [busy,setBusy]=useState(true),[row,setRow]=useState<History|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');setRow(null);
  if(!uuid.test(id)||!uuid.test(scopeId)){
    setError('Invalid or incomplete notification. Open the Formation Report from your Cluster/Organization Home.');
    setBusy(false);return;
  }
  try{
    // SECURITY DEFINER RPC checks authenticated user and exact scope/Cluster
    // progress permission before returning up to 250 summary rows.
    const {data,error:requestError}=await supabase.rpc('buklod_scope_formation_submission_history_v2',{
      p_scope_id:scopeId,p_limit:250
    });
    if(requestError)throw requestError;
    const found=((data??[]) as History[]).find(x=>x.approval_id===id);
    if(!found||found.scope_id!==scopeId&&kind!=='DAILY_DEVOTION'&&kind!=='LESSON'){
      throw new Error('Exact submission not accessible in your authorized report window.');
    }
    if(kind&&found.item_kind!==kind)throw new Error('Notification type does not match this submission.');
    if(itemId&&found.item_id!==itemId)throw new Error('Notification item does not match this submission.');
    setRow(found);
  }catch(e){
    setError(e instanceof Error?e.message:'Submission details are unavailable to this account.');
  }finally{setBusy(false);}
 },[id,scopeId,kind,itemId]);
 useEffect(()=>{void load();},[load]);
 const box={borderRadius:15,borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSurface,padding:14,gap:8} as const;
 const primary={color:theme.textPrimary,fontSize:17,fontWeight:'900' as const};
 const muted={color:theme.textMuted,fontSize:13};
 return <ScrollView style={{flex:1,backgroundColor:theme.canvas}} contentContainerStyle={{padding:16,gap:14,paddingBottom:96}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Back to notifications"
    onPress={()=>router.canGoBack()?router.back():router.replace('/notifications' as any)}
    style={{flexDirection:'row',alignItems:'center',gap:9,minHeight:48}}>
    <MaterialCommunityIcons name="arrow-left" color={theme.textPrimary} size={24}/>
    <Text allowFontScaling style={primary}>Exact Formation Submission</Text>
  </Pressable>
  <Text allowFontScaling style={muted}>For authorized Cluster and Organization report viewers only.</Text>
  {busy?<ActivityIndicator color={theme.accent}/>:error?(
   <View style={box}>
    <Text allowFontScaling style={{color:theme.textPrimary}}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={()=>void load()} style={{minHeight:48,justifyContent:'center'}}>
      <Text allowFontScaling style={{color:theme.accent,fontWeight:'900'}}>Retry exact lookup</Text>
    </Pressable>
   </View>
  ):row&&<>
    <View style={box}>
      <Text allowFontScaling style={primary}>{row.title||'Formation submission'}</Text>
      <Text allowFontScaling style={muted}>{row.subtitle||row.item_kind}</Text>
      <Text allowFontScaling style={{color:theme.textSecondary,fontWeight:'700'}}>Learner: {row.learner_name||'BUKLOD Member'}</Text>
      <Text allowFontScaling style={muted}>Scope: {row.scope_name} · {row.item_kind.replaceAll('_',' ')}</Text>
      <Text allowFontScaling style={muted}>Submitted: {row.submitted_at?new Date(row.submitted_at).toLocaleString('en-PH'):'Unknown'}</Text>
      <Text allowFontScaling style={{color:theme.accent,fontWeight:'900'}}>Status: {row.status}</Text>
    </View>
    <View style={box}>
      <Text allowFontScaling style={primary}>Automatic checking and feedback</Text>
      <Text allowFontScaling style={{color:theme.textPrimary,fontSize:14}}>{row.why||'No reviewer remark yet.'}</Text>
      <Text allowFontScaling style={muted}>{row.automatic_feedback||'No automatic feedback recorded.'}</Text>
    </View>
    <View style={box}>
      <Text allowFontScaling style={muted}>
        This record shows the authorized submission summary, not private written responses or clinical details.
        Reviewer comments on the exact submission are not enabled until a dedicated audited server endpoint exists.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Message the submitting member privately"
        onPress={()=>openMemberConnect(row.learner_id,row.learner_name||'BUKLOD Member')}
        style={{minHeight:48,justifyContent:'center',borderRadius:12,padding:11,backgroundColor:theme.accentSoft}}>
        <Text allowFontScaling style={{color:theme.accent,fontWeight:'900'}}>Message member privately in Connect</Text>
      </Pressable>
    </View>
  </>}
 </ScrollView>;
}
