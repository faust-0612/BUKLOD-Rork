import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, Button, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { FeatureUnavailable } from '@/components/FeatureUnavailable';

const STATUSES=['new_visitor','returning','follow_up','bible_study','membership_interest','onboarding','member','inactive'];

export default function VisitorsAdmin() {
  const { featureEnabled } = useRuntimeConfig();
  if (!featureEnabled('visitors')) return <FeatureUnavailable title="Visitors & New Members"/>;
  const {profile}=useAuth();
  const [items,setItems]=useState<any[]>([]);
  const [name,setName]=useState('');
  const [mobile,setMobile]=useState('');
  const [consent,setConsent]=useState(false);

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('visitors')
      .select('id,full_name,mobile,email,first_visit_date,status,consent_to_contact,linked_user_id')
      .order('first_visit_date',{ascending:false});
    if(error)Alert.alert('Visitors',error.message);
    setItems(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const add=async()=>{
    if(!profile?.church_id||!name.trim())return Alert.alert('Visitor','Name is required.');
    const {error}=await supabase.rpc('create_visitor_record',{
      p_church_id:profile.church_id,
      p_full_name:name.trim(),
      p_mobile:mobile.trim()||null,
      p_email:null,
      p_first_visit_date:new Date().toISOString().slice(0,10),
      p_invited_by:null,
      p_consent_to_contact:consent,
      p_notes:null
    });
    if(error)return Alert.alert('Could not add visitor',error.message);
    setName('');setMobile('');setConsent(false);await load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Visitors & New Member Journey</Text>
            <Text style={shared.muted}>Track welcome, follow-up, Bible study, membership interest, and onboarding.</Text>

            <SectionTitle>ADD VISITOR</SectionTitle>
            <Card>
              <TextInput style={styles.input} placeholder="Visitor full name" value={name} onChangeText={setName}/>
              <TextInput style={styles.input} placeholder="Mobile (optional)" value={mobile} onChangeText={setMobile}/>
              <Pressable onPress={()=>setConsent(v=>!v)}>
                <Text style={{fontWeight:'900',marginBottom:9}}>{consent?'✓ ':''}Visitor consented to follow-up contact</Text>
              </Pressable>
              <Button title="ADD VISITOR" onPress={add}/>
            </Card>

            <SectionTitle>VISITOR JOURNEY</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No visitor records yet.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/admin/visitors/${item.id}`)}>
            <Card>
              <Text style={shared.h2}>{item.full_name}</Text>
              <Text style={shared.muted}>{item.status.replace('_',' ')} • First visit {item.first_visit_date}</Text>
              {!!item.mobile&&<Text style={[shared.body,{marginTop:5}]}>📱 {item.mobile}</Text>}
              {!item.consent_to_contact&&<Text style={{marginTop:5,color:colors.amber,fontWeight:'800'}}>Contact consent not recorded</Text>}
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}
const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8}
});
