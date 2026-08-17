import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function EventDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const {user,profile,hasAnyRole}=useAuth();
  const [event,setEvent]=useState<any>(null);
  const [rsvp,setRsvp]=useState<string>('');
  const [attendance,setAttendance]=useState<any>(null);
  const [assignments,setAssignments]=useState<any[]>([]);
  const [code,setCode]=useState('');

  const load=useCallback(async()=>{
    if(!id||!user)return;
    const [{data:e},{data:r},{data:a},{data:s}]=await Promise.all([
      supabase.from('church_events').select('*').eq('id',id).single(),
      supabase.from('event_rsvps').select('status').eq('event_id',id).eq('user_id',user.id).maybeSingle(),
      supabase.from('event_attendance').select('status,checked_in_at').eq('event_id',id).eq('user_id',user.id).maybeSingle(),
      supabase.from('event_service_assignments')
        .select('id,assignment,status,note,ministry:ministry_id(name)')
        .eq('event_id',id).eq('user_id',user.id)
    ]);
    setEvent(e);setRsvp(r?.status??'');setAttendance(a);setAssignments(s??[]);
  },[id,user?.id]);

  useEffect(()=>{load()},[load]);

  const respond=async(status:'going'|'maybe'|'not_going')=>{
    const {error}=await supabase.rpc('rsvp_event',{p_event_id:id,p_status:status});
    if(error)return Alert.alert('RSVP',error.message);
    setRsvp(status);
  };

  const checkin=async()=>{
    if(!code.trim())return Alert.alert('Check-in','Enter the event check-in code.');
    const {error}=await supabase.rpc('self_checkin_event',{p_event_id:id,p_code:code.trim()});
    if(error)return Alert.alert('Check-in failed',error.message);
    Alert.alert('Checked in','Your attendance has been recorded.');
    setCode('');load();
  };

  const serviceResponse=async(assignmentId:string,status:'confirmed'|'declined')=>{
    const {error}=await supabase.rpc('respond_service_assignment',{
      p_assignment_id:assignmentId,p_status:status
    });
    if(error)return Alert.alert('Assignment',error.message);
    await load();
  };

  if(!event)return <View style={shared.screen}/>;

  const canManage=hasAnyRole(['pastor','local_admin','system_admin','leader']);

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={{color:colors.green,fontWeight:'900'}}>{event.event_type.replace('_',' ')}</Text>
      <Text style={shared.h1}>{event.title}</Text>
      <Card>
        <Text style={shared.h2}>📅 {new Date(event.starts_at).toLocaleString()}</Text>
        {!!event.ends_at&&<Text style={shared.muted}>Ends: {new Date(event.ends_at).toLocaleString()}</Text>}
        {!!event.location&&<Text style={[shared.body,{marginTop:8}]}>📍 {event.location}</Text>}
        {!!event.description&&<Text style={[shared.body,{marginTop:8}]}>{event.description}</Text>}
      </Card>

      {event.requires_rsvp&&<>
        <SectionTitle>RSVP</SectionTitle>
        <View style={styles.wrap}>
          {[
            ['going','✓ Going'],
            ['maybe','? Maybe'],
            ['not_going','Not Going'],
          ].map(([value,label])=>(
            <Pressable key={value} onPress={()=>respond(value as any)}
              style={[styles.chip,rsvp===value&&styles.chipOn]}>
              <Text style={{fontWeight:'800'}}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </>}

      {!!assignments.length&&<>
        <SectionTitle>MY SERVING ASSIGNMENT</SectionTitle>
        {assignments.map(a=>(
          <Card key={a.id}>
            <Text style={shared.h2}>🤝 {a.assignment}</Text>
            <Text style={shared.muted}>{a.ministry?.name||'Ministry service'} • {a.status}</Text>
            {!!a.note&&<Text style={[shared.body,{marginTop:6}]}>{a.note}</Text>}
            {a.status==='assigned'&&<View style={{gap:7,marginTop:10}}>
              <Button title="CONFIRM ASSIGNMENT" onPress={()=>serviceResponse(a.id,'confirmed')}/>
              <Button title="DECLINE" outline onPress={()=>serviceResponse(a.id,'declined')}/>
            </View>}
          </Card>
        ))}
      </>}

      <SectionTitle>ATTENDANCE</SectionTitle>
      {attendance ? (
        <Card>
          <Text style={[shared.h2,{color:colors.green}]}>✓ {attendance.status}</Text>
          {!!attendance.checked_in_at&&<Text style={shared.muted}>Checked in: {new Date(attendance.checked_in_at).toLocaleString()}</Text>}
        </Card>
      ) : event.self_check_in_enabled ? (
        <Card>
          <Text style={shared.h2}>Event Check-in</Text>
          <Text style={shared.muted}>Enter the 6-digit code displayed by your church leader.</Text>
          <TextInput value={code} onChangeText={setCode} keyboardType="number-pad"
            maxLength={6} placeholder="000000" style={styles.code}/>
          <Button title="CHECK IN" onPress={checkin}/>
        </Card>
      ) : (
        <Card><Text style={shared.muted}>Attendance check-in is handled by the event leader.</Text></Card>
      )}

      {canManage&&
        <Button title="MANAGE EVENT ATTENDANCE" outline onPress={()=>router.push(`/church/attendance/${event.id}`)}/>
      }
    </ScrollView>
  )
}

const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:9,paddingHorizontal:12,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  code:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:13,fontSize:22,textAlign:'center',letterSpacing:8,marginVertical:9}
});


