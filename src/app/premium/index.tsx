import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {supabase} from '@/lib/supabase';

export default function PremiumScreen(){
  const [plans,setPlans]=useState<any[]>([]);
  const [access,setAccess]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const [p,a]=await Promise.all([
      supabase.from('buklod_subscription_plans')
        .select('id,code,title,amount_php,interval_unit,interval_count,feature:buklod_paid_features!inner(code,title,description)')
        .eq('is_active',true).eq('buklod_paid_features.is_active',true).order('amount_php'),
      supabase.rpc('buklod_my_paid_access')
    ]);
    if(p.error) Alert.alert('Paid Features',p.error.message); else setPlans(p.data??[]);
    if(!a.error) setAccess(a.data??[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  const subscribe=async(plan:any)=>{
    setBusy(plan.id);
    const {data,error}=await supabase.functions.invoke('subscription-gcash',{body:{action:'start',planId:plan.id}});
    setBusy(null);
    if(error){Alert.alert('Subscription',error.message);return;}
    if(data?.authorizationUrl){
      await WebBrowser.openBrowserAsync(data.authorizationUrl);
      Alert.alert('GCash authorization','Return to BUKLOD after authorizing. Access activates only after payment confirmation.');
      await load();
      return;
    }
    Alert.alert('Subscription',data?.message??'Unable to start GCash authorization.');
  };

  const cancel=async(planCode:string)=>{
    const {data,error}=await supabase.functions.invoke('subscription-gcash',{body:{action:'cancel',planCode}});
    Alert.alert('Subscription',error?.message??data?.message??'Auto-renew updated.');
    await load();
  };

  const map=new Map(access.map(x=>[x.plan_code,x]));
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.title}>Paid Features</Text>
    <Text style={s.sub}>Choose a feature plan. GCash recurring billing starts only after your authorization.</Text>
    {loading?<ActivityIndicator/>:null}
    {!loading&&plans.length===0?<Text>No paid feature is published yet.</Text>:null}
    {plans.map(plan=>{
      const cur=map.get(plan.code);
      const active=cur?.status==='ACTIVE'||cur?.status==='PAST_DUE';
      return <View key={plan.id} style={s.card}>
        <Text style={s.feature}>{plan.feature?.title??'Paid Feature'}</Text>
        <Text style={s.plan}>{plan.title}</Text>
        <Text style={s.price}>₱{Number(plan.amount_php).toFixed(2)} / month</Text>
        {cur?<Text style={s.status}>{cur.status}</Text>:null}
        {!active?
          <Pressable style={s.primary} disabled={busy===plan.id} onPress={()=>void subscribe(plan)}>
            <Text style={s.primaryText}>{busy===plan.id?'OPENING GCASH...':'SET UP GCASH AUTO-DEBIT'}</Text>
          </Pressable>:
          <Pressable style={s.secondary} disabled={cur?.cancel_at_period_end} onPress={()=>void cancel(plan.code)}>
            <Text style={s.secondaryText}>{cur?.cancel_at_period_end?'CANCELS AT PERIOD END':'CANCEL AUTO-RENEW'}</Text>
          </Pressable>}
      </View>;
    })}
    <Text style={s.note}>BUKLOD never stores your GCash PIN. Payment authorization is handled by the payment provider.</Text>
  </ScrollView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F7F8F7'},content:{padding:16,paddingBottom:120,gap:14},
  title:{fontSize:26,fontWeight:'900',color:'#0E4F20'},sub:{color:'#555',lineHeight:20},
  card:{padding:18,gap:8,borderRadius:20,backgroundColor:'#fff'},feature:{fontWeight:'900',color:'#0E4F20'},
  plan:{fontSize:20,fontWeight:'900'},price:{fontSize:23,fontWeight:'900'},status:{fontWeight:'800'},
  primary:{padding:13,borderRadius:999,alignItems:'center',backgroundColor:'#0E4F20'},
  primaryText:{color:'#fff',fontWeight:'900'},secondary:{padding:12,borderRadius:999,borderWidth:1,borderColor:'#bbb',alignItems:'center'},
  secondaryText:{fontWeight:'800'},note:{padding:14,lineHeight:20,color:'#555'}
});
