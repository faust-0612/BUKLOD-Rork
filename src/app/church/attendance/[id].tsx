import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

const STATUSES=['present','late','excused','absent'] as const;

export default function AttendanceManager() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [event,setEvent]=useState<any>(null);
  const [members,setMembers]=useState<any[]>([]);
  const [attendance,setAttendance]=useState<Record<string,string>>({});
  const [code,setCode]=useState('');

  const load=useCallback(async()=>{
    if(!id)return;
    const {data:e,error}=await supabase.from('church_events').select('*').eq('id',id).single();
    if(error)return Alert.alert('Event',error.message);
    setEvent(e);

    let profiles:any[]=[];
    if(e.scope==='group'&&e.group_id){
      const {data}=await supabase.from('group_members')
        .select('user_id,profiles:user_id(id,full_name)')
        .eq('group_id',e.group_id).eq('is_active',true);
      profiles=(data??[]).map((x:any)=>x.profiles);
    }else if(e.scope==='church'&&e.church_id){
      const {data}=await supabase.from('profiles')
        .select('id,full_name').eq('church_id',e.church_id).eq('is_active',true).order('full_name');
      profiles=data??[];
    }else{
      const {data}=await supabase.from('profiles')
        .select('id,full_name').eq('is_active',true).order('full_name').limit(500);
      profiles=data??[];
    }
    setMembers(profiles.filter(Boolean));

    const {data:a}=await supabase.from('event_attendance')
      .select('user_id,status').eq('event_id',id);
    const map:Record<string,string>={};
    (a??[]).forEach((x:any)=>map[x.user_id]=x.status);
    setAttendance(map);
  },[id]);

  useEffect(()=>{load()},[load]);

  const record=async(userId:string,status:string)=>{
    const {error}=await supabase.rpc('record_event_attendance',{
      p_event_id:id,p_user_id:userId,p_status:status,p_note:null
    });
    if(error)return Alert.alert('Attendance',error.message);
    setAttendance(a=>({...a,[userId]:status}));
  };

  const enable=async()=>{
    const {data,error}=await supabase.rpc('enable_event_self_checkin',{
      p_event_id:id,p_open_minutes_before:60,p_close_minutes_after:180
    });
    if(error)return Alert.alert('Self check-in',error.message);
    setCode(data);
    Alert.alert('Self check-in enabled',`Code: ${data}`);
    load();
  };

  if(!event)return <View style={shared.screen}/>;

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={members} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Attendance</Text>
            <Text style={shared.h2}>{event.title}</Text>
            <Text style={shared.muted}>{new Date(event.starts_at).toLocaleString()}</Text>

            <SectionTitle>SELF CHECK-IN</SectionTitle>
            <Card>
              <Text style={shared.h2}>{event.self_check_in_enabled?'Enabled':'Not enabled'}</Text>
              {event.self_check_in_enabled
                ? <Text style={shared.muted}>Check-in window: {event.check_in_opens_at?new Date(event.check_in_opens_at).toLocaleString():'—'} to {event.check_in_closes_at?new Date(event.check_in_closes_at).toLocaleString():'—'}</Text>
                : <Button title="ENABLE & GENERATE CODE" onPress={enable}/>
              }
              {!!code&&<Text style={styles.bigCode}>{code}</Text>}
            </Card>

            <SectionTitle>MEMBERS</SectionTitle>
          </View>
        }
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.full_name||'Member'}</Text>
            <Text style={shared.muted}>Current: {attendance[item.id]||'not recorded'}</Text>
            <View style={styles.wrap}>
              {STATUSES.map(s=>(
                <Pressable key={s} onPress={()=>record(item.id,s)}
                  style={[styles.chip,attendance[item.id]===s&&styles.chipOn]}>
                  <Text style={{fontSize:11,fontWeight:'800'}}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}
      />
    </View>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:9},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:7,paddingHorizontal:9},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  bigCode:{fontSize:34,fontWeight:'900',textAlign:'center',letterSpacing:8,color:colors.greenDark,marginTop:10}
});
