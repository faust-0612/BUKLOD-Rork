import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

export default function DirectorySettings() {
  const {user}=useAuth();
  const [prefs,setPrefs]=useState({
    directory_visibility:'church',
    show_mobile:false,
    show_birth_month_day:true,
    show_household:true,
    show_ministries:true,
    allow_member_messages:true,
  });

  useEffect(()=>{
    if(!user)return;
    supabase.from('directory_preferences').select('*').eq('user_id',user.id).maybeSingle()
      .then(({data})=>{if(data)setPrefs({
        directory_visibility:data.directory_visibility,
        show_mobile:data.show_mobile,
        show_birth_month_day:data.show_birth_month_day,
        show_household:data.show_household,
        show_ministries:data.show_ministries,
        allow_member_messages:data.allow_member_messages,
      })});
  },[user?.id]);

  const save=async()=>{
    if(!user)return;
    const {error}=await supabase.from('directory_preferences').upsert({
      user_id:user.id,...prefs
    });
    if(error)return Alert.alert('Directory Settings',error.message);
    Alert.alert('Saved','Your directory privacy preferences were updated.');
  };

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Directory Privacy</Text>
      <Text style={shared.muted}>Choose what fellow church members may see.</Text>

      <Card>
        <Row label="Show mobile number" value={prefs.show_mobile} setValue={v=>setPrefs(p=>({...p,show_mobile:v}))}/>
        <Row label="Show birthday month/day" value={prefs.show_birth_month_day} setValue={v=>setPrefs(p=>({...p,show_birth_month_day:v}))}/>
        <Row label="Show household" value={prefs.show_household} setValue={v=>setPrefs(p=>({...p,show_household:v}))}/>
        <Row label="Show ministries" value={prefs.show_ministries} setValue={v=>setPrefs(p=>({...p,show_ministries:v}))}/>
      </Card>

      <Text style={shared.h2}>Directory visibility</Text>
      {['church','leaders','private'].map(v=>(
        <Text key={v} onPress={()=>setPrefs(p=>({...p,directory_visibility:v}))}
          style={{padding:12,fontWeight:prefs.directory_visibility===v?'900':'500'}}>
          {prefs.directory_visibility===v?'✓ ':''}{v}
        </Text>
      ))}

      <Button title="SAVE SETTINGS" onPress={save}/>
    </ScrollView>
  )
}
function Row({label,value,setValue}:{label:string;value:boolean;setValue:(v:boolean)=>void}){
  return <View style={[shared.row,{paddingVertical:6}]}><Text>{label}</Text><Switch value={value} onValueChange={setValue}/></View>
}
