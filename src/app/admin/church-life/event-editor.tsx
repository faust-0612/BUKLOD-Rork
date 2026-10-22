import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function EventEditor() {
  const [churches,setChurches]=useState<any[]>([]);
  const [groups,setGroups]=useState<any[]>([]);
  const [scope,setScope]=useState<'system'|'church'|'group'>('church');
  const [churchId,setChurchId]=useState('');
  const [groupId,setGroupId]=useState('');
  const [type,setType]=useState('worship');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [location,setLocation]=useState('');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [rsvp,setRsvp]=useState(false);

  useEffect(()=>{
    Promise.all([
      supabase.from('churches').select('id,name').eq('is_active',true).order('name'),
      supabase.from('buklod_groups').select('id,name,church_id').eq('is_active',true).order('name')
    ]).then(([c,g])=>{setChurches(c.data??[]);setGroups(g.data??[])});
  },[]);

  const create=async()=>{
    if(!title.trim()||!start.trim())return Alert.alert('Event','Title and start date/time are required.');
    const startsAt=new Date(start).toISOString();
    const endsAt=end.trim()?new Date(end).toISOString():null;
    const {data,error}=await supabase.rpc('create_church_event',{
      p_scope:scope,
      p_church_id:scope==='system'?null:churchId||null,
      p_group_id:scope==='group'?groupId||null:null,
      p_event_type:type,
      p_title:title.trim(),
      p_description:description.trim()||null,
      p_location:location.trim()||null,
      p_starts_at:startsAt,
      p_ends_at:endsAt,
      p_requires_rsvp:rsvp
    });
    if(error)return Alert.alert('Could not create event',error.message);
    Alert.alert('Event created','The event is now in the BUKLOD calendar.');
    router.replace(`/church/event/${data}`);
  };

  return(
    <AdminGate>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.h1}>Create Event</Text>

        <SectionTitle>AUDIENCE</SectionTitle>
        <View style={styles.wrap}>
          {(['system','church','group'] as const).map(s=>(
            <Pressable key={s} onPress={()=>{setScope(s);setGroupId('')}} style={[styles.chip,scope===s&&styles.chipOn]}>
              <Text>{s}</Text>
            </Pressable>
          ))}
        </View>

        {scope!=='system'&&<>
          <Text style={shared.h2}>Local Church</Text>
          <View style={styles.wrap}>
            {churches.map(c=>(
              <Pressable key={c.id} onPress={()=>{setChurchId(c.id);setGroupId('')}} style={[styles.chip,churchId===c.id&&styles.chipOn]}>
                <Text>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </>}

        {scope==='group'&&<>
          <Text style={shared.h2}>BUKLOD Cluster</Text>
          <View style={styles.wrap}>
            {groups.filter(g=>g.church_id===churchId).map(g=>(
              <Pressable key={g.id} onPress={()=>setGroupId(g.id)} style={[styles.chip,groupId===g.id&&styles.chipOn]}>
                <Text>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </>}

        <SectionTitle>EVENT DETAILS</SectionTitle>
        <Card>
          <TextInput style={styles.input} placeholder="Event title *" value={title} onChangeText={setTitle}/>
          <TextInput multiline style={styles.area} placeholder="Description" value={description} onChangeText={setDescription}/>
          <TextInput style={styles.input} placeholder="Location" value={location} onChangeText={setLocation}/>
          <TextInput style={styles.input} placeholder="Start: 2026-08-16T09:00:00+08:00" value={start} onChangeText={setStart}/>
          <TextInput style={styles.input} placeholder="End (optional)" value={end} onChangeText={setEnd}/>
        </Card>

        <Text style={shared.h2}>Event Type</Text>
        <View style={styles.wrap}>
          {['worship','prayer','bible_study','discipleship','fellowship','training','outreach','meeting','conference','other'].map(t=>(
            <Pressable key={t} onPress={()=>setType(t)} style={[styles.chip,type===t&&styles.chipOn]}>
              <Text style={{fontSize:11}}>{t.replace('_',' ')}</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          <View style={shared.row}><Text style={shared.h2}>Require RSVP</Text><Switch value={rsvp} onValueChange={setRsvp}/></View>
        </Card>

        <Button title="CREATE EVENT" onPress={create}/>
      </ScrollView>
    </AdminGate>
  )
}
const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:10,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  input:{borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,marginBottom:8},
  area:{minHeight:100,borderWidth:1,borderColor:colors.line,borderRadius:11,padding:12,textAlignVertical:'top',marginBottom:8}
});
