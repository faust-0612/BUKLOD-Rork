import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

const STATUSES=['new_visitor','returning','follow_up','bible_study','membership_interest','onboarding','member','inactive'];

export default function VisitorDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [item,setItem]=useState<any>(null);
  const [followups,setFollowups]=useState<any[]>([]);
  const [leaders,setLeaders]=useState<any[]>([]);
  const [assignee,setAssignee]=useState('');
  const [note,setNote]=useState('');

  const load=useCallback(async()=>{
    if(!id)return;
    const [{data:v},{data:f},{data:l}]=await Promise.all([
      supabase.from('visitors').select('*').eq('id',id).single(),
      supabase.from('visitor_followups')
        .select('id,status,contact_method,note,scheduled_at,contacted_at,completed_at,assignee:assigned_to(full_name)')
        .eq('visitor_id',id).order('created_at',{ascending:false}),
      supabase.from('profiles')
        .select('id,full_name,role')
        .in('role',['leader','pastor','local_admin','system_admin'])
        .eq('is_active',true).order('full_name')
    ]);
    setItem(v);setFollowups(f??[]);setLeaders(l??[]);
  },[id]);

  useEffect(()=>{load()},[load]);

  const advance=async(status:string)=>{
    const {error}=await supabase.rpc('advance_visitor_journey',{
      p_visitor_id:id,p_status:status
    });
    if(error)return Alert.alert('Visitor Journey',error.message);
    await load();
  };

  const createFollowup=async()=>{
    if(!item?.consent_to_contact)return Alert.alert('Follow-up','Contact consent is not recorded for this visitor.');
    const {error}=await supabase.rpc('create_visitor_followup',{
      p_visitor_id:id,
      p_assigned_to:assignee||null,
      p_contact_method:'message',
      p_scheduled_at:null,
      p_note:note.trim()||null
    });
    if(error)return Alert.alert('Could not create follow-up',error.message);
    setNote('');await load();
  };

  if(!item)return <View style={shared.screen}/>;

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>{item.full_name}</Text>
      <Text style={shared.muted}>First visit: {item.first_visit_date}</Text>

      <Card>
        {!!item.mobile&&<Text style={shared.body}>📱 {item.mobile}</Text>}
        {!!item.email&&<Text style={shared.body}>✉️ {item.email}</Text>}
        <Text style={[shared.body,{marginTop:6}]}>Contact consent: {item.consent_to_contact?'Yes':'No'}</Text>
      </Card>

      <SectionTitle>JOURNEY STATUS</SectionTitle>
      <View style={styles.wrap}>
        {STATUSES.map(s=>(
          <Pressable key={s} onPress={()=>advance(s)} style={[styles.chip,item.status===s&&styles.chipOn]}>
            <Text style={{fontSize:11,fontWeight:'800'}}>{s.replace('_',' ')}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>CREATE FOLLOW-UP</SectionTitle>
      <Card>
        <Text style={shared.h2}>Assign to</Text>
        <View style={styles.wrap}>
          {leaders.map(l=>(
            <Pressable key={l.id} onPress={()=>setAssignee(l.id)} style={[styles.chip,assignee===l.id&&styles.chipOn]}>
              <Text>{l.full_name||l.role}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput multiline style={styles.area} placeholder="Follow-up note" value={note} onChangeText={setNote}/>
        <Button title="CREATE FOLLOW-UP" onPress={createFollowup}/>
      </Card>

      <SectionTitle>FOLLOW-UP HISTORY</SectionTitle>
      {followups.length?followups.map(f=>(
        <Card key={f.id}>
          <Text style={shared.h2}>{f.status}</Text>
          <Text style={shared.muted}>Assigned: {f.assignee?.full_name||'Unassigned'}</Text>
          {!!f.note&&<Text style={[shared.body,{marginTop:6}]}>{f.note}</Text>}
        </Card>
      )):<Card><Text style={shared.muted}>No follow-up records yet.</Text></Card>}
    </ScrollView>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  area:{minHeight:100,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginVertical:9}
});
