import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function MinistriesAdmin() {
  const [churches,setChurches]=useState<any[]>([]);
  const [ministries,setMinistries]=useState<any[]>([]);
  const [churchId,setChurchId]=useState('');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');

  const load=useCallback(async()=>{
    const [{data:c},{data:m}]=await Promise.all([
      supabase.from('churches').select('id,name').eq('is_active',true).order('name'),
      supabase.from('ministries').select('id,name,description,church:church_id(name),leader:leader_id(full_name)').order('name')
    ]);
    setChurches(c??[]);setMinistries(m??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const create=async()=>{
    if(!churchId||!name.trim())return Alert.alert('Ministry','Church and ministry name are required.');
    const {error}=await supabase.rpc('create_ministry',{
      p_church_id:churchId,p_name:name.trim(),p_description:description.trim()||null,p_leader_id:null
    });
    if(error)return Alert.alert('Could not create ministry',error.message);
    setName('');setDescription('');await load();
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={ministries} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Ministries</Text>
            <SectionTitle>CREATE MINISTRY</SectionTitle>
            <Card>
              <View style={styles.wrap}>
                {churches.map(c=>(
                  <Pressable key={c.id} onPress={()=>setChurchId(c.id)} style={[styles.chip,churchId===c.id&&styles.chipOn]}>
                    <Text>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={styles.input} placeholder="Ministry name" value={name} onChangeText={setName}/>
              <TextInput multiline style={styles.area} placeholder="Description" value={description} onChangeText={setDescription}/>
              <Button title="CREATE MINISTRY" onPress={create}/>
            </Card>
            <SectionTitle>MINISTRIES</SectionTitle>
          </View>
        }
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.name}</Text>
            <Text style={shared.muted}>{item.church?.name||'Church'} • Leader: {item.leader?.full_name||'Not assigned'}</Text>
            {!!item.description&&<Text style={[shared.body,{marginTop:5}]}>{item.description}</Text>}
          </Card>
        )}/>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:8},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:90,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:8}
});
