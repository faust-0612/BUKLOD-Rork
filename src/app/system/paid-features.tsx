import React,{useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {supabase} from '@/lib/supabase';

const code=(v:string)=>v.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');

export default function PaidFeatureAdmin(){
  const [features,setFeatures]=useState<any[]>([]);
  const [title,setTitle]=useState('');
  const [featureCode,setFeatureCode]=useState('');
  const [featureId,setFeatureId]=useState<string|null>(null);
  const [planTitle,setPlanTitle]=useState('');
  const [planCode,setPlanCode]=useState('');
  const [amount,setAmount]=useState('');

  const load=async()=>{
    const {data,error}=await supabase.from('buklod_paid_features').select('id,code,title,is_active').order('created_at',{ascending:false});
    if(error){Alert.alert('Paid Features',error.message);return;}
    setFeatures(data??[]);
    if(!featureId&&data?.[0]) setFeatureId(data[0].id);
  };
  useEffect(()=>{void load();},[]);

  const addFeature=async()=>{
    const {data:u}=await supabase.auth.getUser();
    const {error}=await supabase.from('buklod_paid_features').insert({
      title:title.trim(),code:code(featureCode||title),created_by:u.user?.id??null
    });
    if(error){Alert.alert('Feature',error.message);return;}
    setTitle('');setFeatureCode('');await load();
  };

  const addPlan=async()=>{
    const price=Number(amount);
    if(!featureId||!planTitle.trim()||!Number.isFinite(price)||price<=0){Alert.alert('Plan','Complete feature, title and monthly price.');return;}
    const {data:u}=await supabase.auth.getUser();
    const {error}=await supabase.from('buklod_subscription_plans').insert({
      feature_id:featureId,title:planTitle.trim(),code:code(planCode||planTitle),
      amount_php:price,interval_unit:'MONTH',interval_count:1,grace_days:3,created_by:u.user?.id??null
    });
    if(error){Alert.alert('Plan',error.message);return;}
    setPlanTitle('');setPlanCode('');setAmount('');Alert.alert('Plan','Monthly plan created.');
  };

  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Text style={s.title}>Paid Feature Manager</Text>
    <Text>System Admin only.</Text>
    <View style={s.card}>
      <Text style={s.head}>NEW FEATURE</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Feature title"/>
      <TextInput style={s.input} value={featureCode} onChangeText={setFeatureCode} placeholder="FEATURE_CODE"/>
      <Pressable style={s.button} onPress={()=>void addFeature()}><Text style={s.buttonText}>CREATE FEATURE</Text></Pressable>
    </View>
    <View style={s.card}>
      <Text style={s.head}>NEW MONTHLY PLAN</Text>
      <ScrollView horizontal contentContainerStyle={{gap:8}}>
        {features.map(f=><Pressable key={f.id} style={[s.chip,featureId===f.id&&s.chipOn]} onPress={()=>setFeatureId(f.id)}>
          <Text style={featureId===f.id?{color:'#fff'}:undefined}>{f.title}</Text>
        </Pressable>)}
      </ScrollView>
      <TextInput style={s.input} value={planTitle} onChangeText={setPlanTitle} placeholder="Plan title"/>
      <TextInput style={s.input} value={planCode} onChangeText={setPlanCode} placeholder="PLAN_CODE"/>
      <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Monthly PHP price"/>
      <Pressable style={s.button} onPress={()=>void addPlan()}><Text style={s.buttonText}>CREATE MONTHLY PLAN</Text></Pressable>
    </View>
    <Text style={s.note}>Live GCash auto-debit still requires merchant approval and provider secrets.</Text>
  </ScrollView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F7F8F7'},content:{padding:16,paddingBottom:120,gap:14},
  title:{fontSize:25,fontWeight:'900',color:'#0E4F20'},card:{padding:16,gap:10,borderRadius:18,backgroundColor:'#fff'},
  head:{fontWeight:'900',color:'#0E4F20'},input:{minHeight:48,paddingHorizontal:14,borderWidth:1,borderColor:'#ddd',borderRadius:12},
  button:{padding:13,borderRadius:999,alignItems:'center',backgroundColor:'#0E4F20'},buttonText:{color:'#fff',fontWeight:'900'},
  chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#ccc'},chipOn:{backgroundColor:'#0E4F20',borderColor:'#0E4F20'},
  note:{padding:14,backgroundColor:'#FFF7DF',borderRadius:14,lineHeight:20}
});
