import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';

type Summary={
  legacy_remaining:number;
  has_profile_mobile_unverified:number;
  has_real_auth_email_unverified:number;
  auto_external_notice_live:boolean;
  sms_requires_messaging_provider:boolean;
};

export default function AdminLegacyLoginSummary(){
  const [summary,setSummary]=useState<Summary|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const {data,error:rpcError}=await supabase.rpc('buklod_admin_legacy_login_summary_v1' as any);
      if(rpcError)throw rpcError;
      if(!data||typeof data!=='object'||typeof (data as any).legacy_remaining!=='number')
        throw new Error('Invalid summary response');
      setSummary(data as unknown as Summary);setError('');
    }catch(err:any){
      setError(String(err?.message||'Account migration report is not available.'));
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  return <View style={{borderWidth:1,borderColor:colors.line,borderRadius:14,padding:12,
    backgroundColor:colors.white,gap:7}}>
    <Text style={{fontWeight:'900',fontSize:17,color:colors.greenDark}}>Username login migration</Text>
    <Text style={{color:colors.text,fontSize:13}}>Legacy accounts are retained until their owners verify a new email or phone and complete the migration.</Text>
    {!!error&&<Text accessibilityRole="alert" style={{color:'#9A3412'}}>Report unavailable: {error}</Text>}
    {summary&&<>
      <Text style={{color:colors.text}}>Username-only logins remaining: {summary.legacy_remaining}</Text>
      <Text style={{color:colors.muted,fontSize:12}}>Mobile contact recorded (not proof of verification): {summary.has_profile_mobile_unverified}</Text>
      <Text style={{color:colors.muted,fontSize:12}}>Real auth email recorded (not proof of verification): {summary.has_real_auth_email_unverified}</Text>
      <Text style={{color:colors.muted,fontSize:12}}>External notification live: {summary.auto_external_notice_live?'Yes':'No — provider setup and delivery verification pending'}</Text>
      <Text style={{color:colors.muted,fontSize:12}}>SMS outreach requires a separate messaging provider; OTP Verify alone does not send arbitrary notices.</Text>
    </>}
    <Pressable accessibilityRole="button" disabled={loading} onPress={()=>void load()}
      style={{alignSelf:'flex-start',borderWidth:1,borderColor:colors.green,padding:10,borderRadius:9}}>
      {loading?<ActivityIndicator color={colors.green}/>:<Text style={{color:colors.greenDark,fontWeight:'800'}}>REFRESH LOGIN MIGRATION REPORT</Text>}
    </Pressable>
  </View>;
}
