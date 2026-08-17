import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

const REQUESTS=[
  ['access','Access my data'],
  ['rectify','Correct my data'],
  ['erase','Erase/block data'],
  ['portability','Data portability'],
  ['object','Object to processing'],
  ['withdraw_consent','Withdraw consent where applicable'],
] as const;

export default function DataRightsScreen(){
  const {user}=useAuth();
  const [type,setType]=useState<string>('access');
  const [text,setText]=useState('');
  const [items,setItems]=useState<any[]>([]);

  const load=async()=>{
    if(!user)return;
    const {data}=await supabase.from('data_subject_requests')
      .select('*').eq('user_id',user.id).order('submitted_at',{ascending:false});
    setItems(data??[]);
  };
  useEffect(()=>{load()},[user?.id]);

  const submit=async()=>{
    if(!user)return;
    const {error}=await supabase.from('data_subject_requests').insert({
      user_id:user.id,request_type:type,request_text:text.trim()||null,status:'submitted'
    });
    if(error)return Alert.alert('Privacy Request',error.message);
    Alert.alert('Request submitted','Your request has been recorded for review.');
    setText('');await load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Privacy & Data Rights</Text>
            <Text style={shared.muted}>Submit a request about your personal data.</Text>

            <SectionTitle>NEW REQUEST</SectionTitle>
            <View style={styles.wrap}>
              {REQUESTS.map(([value,label])=>(
                <Pressable key={value} onPress={()=>setType(value)}
                  style={[styles.chip,type===value&&styles.chipOn]}>
                  <Text style={{fontSize:11,fontWeight:'800'}}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Card>
              <TextInput multiline value={text} onChangeText={setText}
                placeholder="Describe your request (optional but helpful)"
                style={styles.area}/>
              <Button title="SUBMIT PRIVACY REQUEST" onPress={submit}/>
            </Card>

            <Button title="ACCOUNT DELETION" outline onPress={()=>router.push('/account/delete')}/>
            <Button title="READ PRIVACY NOTICE" outline onPress={()=>router.push('/privacy/notice')}/>
            <SectionTitle>MY REQUESTS</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No privacy requests submitted yet.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.request_type.replace('_',' ')}</Text>
            <Text style={shared.muted}>{item.status} • {new Date(item.submitted_at).toLocaleString()}</Text>
            {!!item.response_text&&<Text style={[shared.body,{marginTop:6}]}>{item.response_text}</Text>}
          </Card>
        )}/>
    </View>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:9},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  area:{minHeight:110,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:9}
});
