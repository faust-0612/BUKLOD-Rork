import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function CohortsAdmin(){
  const [cohorts,setCohorts]=useState<any[]>([]);
  const [users,setUsers]=useState<any[]>([]);
  const [participants,setParticipants]=useState<any[]>([]);
  const [selectedCohort,setSelectedCohort]=useState('');
  const [selectedUser,setSelectedUser]=useState('');
  const [newName,setNewName]=useState('');

  const load=async()=>{
    const [{data:c},{data:u},{data:p}]=await Promise.all([
      supabase.from('pilot_cohorts').select('*').order('created_at'),
      supabase.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name'),
      supabase.from('pilot_participants')
        .select('cohort_id,user_id,status,profiles:user_id(full_name,role)')
        .order('invited_at')
    ]);
    setCohorts(c??[]);setUsers(u??[]);setParticipants(p??[]);
    if(!selectedCohort&&c?.length)setSelectedCohort(c[0].id);
  };
  useEffect(()=>{load()},[]);

  const create=async()=>{
    if(!newName.trim())return;
    const {error}=await supabase.from('pilot_cohorts').insert({
      name:newName.trim(),is_active:true
    });
    if(error)return Alert.alert('Cohort',error.message);
    setNewName('');await load();
  };

  const activate=async()=>{
    if(!selectedCohort||!selectedUser)return Alert.alert('Pilot Access','Select a cohort and user.');
    const {error}=await supabase.rpc('set_pilot_participant',{
      p_cohort_id:selectedCohort,
      p_user_id:selectedUser,
      p_status:'active',
      p_notes:null
    });
    if(error)return Alert.alert('Pilot Access',error.message);
    setSelectedUser('');await load();
  };

  const remove=async(row:any)=>{
    const {error}=await supabase.rpc('set_pilot_participant',{
      p_cohort_id:row.cohort_id,
      p_user_id:row.user_id,
      p_status:'removed',
      p_notes:'Removed from active pilot access.'
    });
    if(error)return Alert.alert('Pilot Access',error.message);
    await load();
  };

  return(
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={participants.filter(p=>!selectedCohort||p.cohort_id===selectedCohort)}
        keyExtractor={i=>`${i.cohort_id}-${i.user_id}`}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>Pilot Cohorts</Text>

          <SectionTitle>CREATE COHORT</SectionTitle>
          <Card>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName}
              placeholder="Example: Local Church Pilot"/>
            <Button title="CREATE COHORT" onPress={create}/>
          </Card>

          <SectionTitle>SELECT COHORT</SectionTitle>
          <View style={styles.wrap}>
            {cohorts.map(c=>(
              <Pressable key={c.id} onPress={()=>setSelectedCohort(c.id)}
                style={[styles.chip,selectedCohort===c.id&&styles.chipOn]}>
                <Text style={{fontWeight:'800'}}>{c.name}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>ADD PARTICIPANT</SectionTitle>
          <View style={styles.wrap}>
            {users.filter(u=>!participants.some(p=>p.cohort_id===selectedCohort&&p.user_id===u.id&&p.status==='active')).map(u=>(
              <Pressable key={u.id} onPress={()=>setSelectedUser(u.id)}
                style={[styles.chip,selectedUser===u.id&&styles.chipOn]}>
                <Text style={{fontSize:11}}>{u.full_name||u.role}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="ACTIVATE PILOT ACCESS" onPress={activate}/>

          <SectionTitle>PARTICIPANTS</SectionTitle>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No participants in this cohort yet.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <View style={shared.row}>
              <View style={{flex:1}}>
                <Text style={shared.h2}>{item.profiles?.full_name||'Pilot User'}</Text>
                <Text style={shared.muted}>{item.profiles?.role} • {item.status}</Text>
              </View>
              {item.status==='active'&&
                <Pressable onPress={()=>remove(item)}><Text style={{fontWeight:'900',color:colors.danger}}>REMOVE</Text></Pressable>}
            </View>
          </Card>
        )}/>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:9},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8}
});
