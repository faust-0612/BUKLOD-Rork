import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function FollowUpDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [item,setItem]=useState<any>(null);
  const [action,setAction]=useState('');
  const [notes,setNotes]=useState('');
  const [status,setStatus]=useState<'open'|'contacted'|'awaiting_response'|'completed'>('open');

  const load=useCallback(async()=>{
    if(!id)return;
    const {data,error}=await supabase.from('follow_ups')
      .select(`
        *,
        member:member_id(full_name,mobile),
        leader:leader_id(full_name),
        group:group_id(name)
      `)
      .eq('id',id).single();
    if(error)return Alert.alert('Follow-up',error.message);
    setItem(data);setAction(data.action_taken??'');setNotes(data.notes??'');setStatus(data.status);
  },[id]);

  useEffect(()=>{load()},[load]);

  const save=async(nextStatus= status)=>{
    if(!id)return;
    const {error}=await supabase.from('follow_ups').update({
      action_taken:action.trim()||null,
      notes:notes.trim()||null,
      status:nextStatus,
      completed_at:nextStatus==='completed'?new Date().toISOString():null
    }).eq('id',id);
    if(error)return Alert.alert('Could not save',error.message);
    Alert.alert('Follow-up saved',nextStatus==='completed'?'Pastoral follow-up completed.':'Follow-up record updated.');
    if(nextStatus==='completed')router.back(); else load();
  };

  if(!item)return <ScrollView style={shared.screen}/>;

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Pastoral Follow-up</Text>
      <Card>
        <Text style={shared.h2}>{item.member?.full_name||'Member'}</Text>
        <Text style={shared.muted}>{item.group?.name||'BUKLOD'} • Status: {item.status}</Text>
        <Text style={[shared.body,{marginTop:8}]}>Reason: {item.reason}</Text>
      </Card>

      <SectionTitle>CARE RECORD</SectionTitle>
      <Card>
        <Text style={{fontWeight:'900'}}>Action taken</Text>
        <TextInput multiline value={action} onChangeText={setAction} style={styles.area}
          placeholder="Example: Sent encouragement, called member, offered prayer..."/>
        <Text style={{fontWeight:'900'}}>Leader notes</Text>
        <TextInput multiline value={notes} onChangeText={setNotes} style={styles.area}
          placeholder="Keep notes brief, respectful, and relevant to pastoral care."/>
      </Card>

      <Button title="MARK CONTACTED" onPress={()=>{setStatus('contacted');save('contacted')}}/>
      <Button title="AWAITING RESPONSE" outline onPress={()=>{setStatus('awaiting_response');save('awaiting_response')}}/>
      <Button title="✓ COMPLETE FOLLOW-UP" outline onPress={()=>{setStatus('completed');save('completed')}}/>
    </ScrollView>
  )
}

const styles=StyleSheet.create({
  area:{minHeight:100,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginVertical:8}
});
