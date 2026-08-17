import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { colors } from '@/lib/theme';

const SEVERITIES=['P0','P1','P2','P3'];
const STATUSES=['open','investigating','fix_ready','retest_required','retest_passed','closed','accepted'];

export default function IncidentRegister(){
  const [items,setItems]=useState<any[]>([]);
  const [severity,setSeverity]=useState('P1');
  const [area,setArea]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('pilot_incidents')
      .select('id,severity,status,area,title,description,environment,app_version,platform,resolution,opened_at,owner:owner_id(full_name)')
      .eq('environment',appEnvironment)
      .order('opened_at',{ascending:false});
    if(error)return Alert.alert('Incidents',error.message);
    setItems(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const create=async()=>{
    if(!area.trim()||!title.trim())return Alert.alert('Incident','Area and title are required.');
    const {error}=await supabase.rpc('create_pilot_incident',{
      p_severity:severity,p_area:area.trim(),p_title:title.trim(),
      p_description:description.trim()||null,p_environment:appEnvironment,
      p_app_version:Constants.expoConfig?.version||null,p_platform:'other',
      p_linked_feedback_id:null
    });
    if(error)return Alert.alert('Incident',error.message);
    setArea('');setTitle('');setDescription('');await load();
  };

  const update=async(item:any,status:string)=>{
    const {error}=await supabase.rpc('update_pilot_incident',{
      p_incident_id:item.id,p_status:status,p_owner_id:null,
      p_resolution:item.resolution||null
    });
    if(error)return Alert.alert('Incident',error.message);
    await load();
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>Incident / Defect Register</Text>
          <Text style={shared.muted}>P0 and P1 issues must be explicit before rollout decisions.</Text>

          <SectionTitle>LOG INCIDENT</SectionTitle>
          <View style={styles.wrap}>
            {SEVERITIES.map(s=>(
              <Pressable key={s} onPress={()=>setSeverity(s)}
                style={[styles.chip,severity===s&&styles.chipOn]}>
                <Text style={{fontWeight:'900'}}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Card>
            <TextInput style={styles.input} placeholder="Area: Privacy, Auth, Prayer..." value={area} onChangeText={setArea}/>
            <TextInput style={styles.input} placeholder="Incident title" value={title} onChangeText={setTitle}/>
            <TextInput multiline style={styles.area} placeholder="Minimum necessary incident description" value={description} onChangeText={setDescription}/>
            <Button title="LOG INCIDENT" onPress={create}/>
          </Card>
          <SectionTitle>INCIDENTS</SectionTitle>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No incidents registered for this environment.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={[shared.h2,{color:item.severity==='P0'?colors.danger:item.severity==='P1'?colors.amber:colors.text}]}>
              {item.severity} • {item.title}
            </Text>
            <Text style={shared.muted}>{item.area} • {item.status} • {new Date(item.opened_at).toLocaleString()}</Text>
            {!!item.description&&<Text style={[shared.body,{marginTop:7}]}>{item.description}</Text>}
            <View style={[styles.wrap,{marginTop:9}]}>
              {STATUSES.map(s=>(
                <Pressable key={s} onPress={()=>update(item,s)}
                  style={[styles.statusChip,item.status===s&&styles.chipOn]}>
                  <Text style={{fontSize:10,fontWeight:'800'}}>{s.replaceAll('_',' ')}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}/>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:12},
  statusChip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:6,paddingHorizontal:8},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:100,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:8}
});
