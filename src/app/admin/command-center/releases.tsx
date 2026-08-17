import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { colors } from '@/lib/theme';

const STATUSES=['draft','testing','approved','rejected','superseded','released'];

export default function ReleaseCandidates(){
  const [items,setItems]=useState<any[]>([]);
  const [version,setVersion]=useState(Constants.expoConfig?.version||'1.0.0');
  const [label,setLabel]=useState('');
  const [url,setUrl]=useState('');
  const [platform,setPlatform]=useState('android');

  const environment=appEnvironment==='production'?'production':'staging';

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('release_candidates')
      .select('*').eq('environment',environment)
      .order('created_at',{ascending:false});
    if(error)return Alert.alert('Release Candidates',error.message);
    setItems(data??[]);
  },[environment]);

  useEffect(()=>{load()},[load]);

  const create=async()=>{
    if(!version.trim()||!label.trim())return Alert.alert('Release Candidate','Version and build label are required.');
    const {error}=await supabase.rpc('create_release_candidate',{
      p_environment:environment,p_version:version.trim(),p_build_label:label.trim(),
      p_platform:platform,p_build_url:url.trim()||null,p_source_revision:null,p_notes:null
    });
    if(error)return Alert.alert('Release Candidate',error.message);
    setLabel('');setUrl('');await load();
  };

  const status=async(item:any,next:string)=>{
    const {error}=await supabase.rpc('set_release_candidate_status',{
      p_release_candidate_id:item.id,p_status:next
    });
    if(error)return Alert.alert('Release Candidate',error.message);
    await load();
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>Release Candidates</Text>
          <Text style={shared.muted}>Register the exact build tested by the pilot before final signoff.</Text>

          <SectionTitle>REGISTER BUILD</SectionTitle>
          <Card>
            <TextInput style={styles.input} value={version} onChangeText={setVersion} placeholder="1.0.0"/>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Example: Android Preview #12"/>
            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="Build/install URL (optional)"/>
            <View style={styles.wrap}>
              {['android','ios','both'].map(p=>(
                <Pressable key={p} onPress={()=>setPlatform(p)}
                  style={[styles.chip,platform===p&&styles.chipOn]}>
                  <Text>{p}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{marginTop:10}}><Button title="REGISTER RELEASE CANDIDATE" onPress={create}/></View>
          </Card>
          <SectionTitle>BUILDS</SectionTitle>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No release candidate registered.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.build_label}</Text>
            <Text style={shared.muted}>v{item.version} • {item.platform} • {item.status}</Text>
            {!!item.build_url&&<Text style={[shared.body,{marginTop:5}]} numberOfLines={1}>{item.build_url}</Text>}
            <View style={[styles.wrap,{marginTop:9}]}>
              {STATUSES.map(s=>(
                <Pressable key={s} onPress={()=>status(item,s)}
                  style={[styles.status,item.status===s&&styles.chipOn]}>
                  <Text style={{fontSize:10,fontWeight:'800'}}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}/>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:7,paddingHorizontal:10},
  status:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:6,paddingHorizontal:8},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green}
});
