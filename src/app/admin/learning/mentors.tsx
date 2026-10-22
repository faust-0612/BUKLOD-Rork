import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function MentorAssignmentsAdmin() {
  const [leaders,setLeaders]=useState<any[]>([]);
  const [members,setMembers]=useState<any[]>([]);
  const [mentorId,setMentorId]=useState('');
  const [discipleId,setDiscipleId]=useState('');

  useEffect(()=>{
    Promise.all([
      supabase.from('profiles').select('id,full_name,role').in('role',['leader','pastor','local_admin','system_admin']).eq('is_active',true).order('full_name'),
      supabase.from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')
    ]).then(([a,b])=>{setLeaders(a.data??[]);setMembers(b.data??[])});
  },[]);

  const assign=async()=>{
    if(!mentorId||!discipleId)return Alert.alert('Mentor Assignment','Select both mentor and disciple.');
    if(mentorId===discipleId)return Alert.alert('Mentor Assignment','Mentor and disciple must be different people.');
    const {error}=await supabase.from('mentor_assignments').upsert({
      mentor_id:mentorId,disciple_id:discipleId,is_active:true
    });
    if(error)return Alert.alert('Could not assign mentor',error.message);
    Alert.alert('Assigned','Mentor relationship created.');
    setDiscipleId('');
  };

  return(
    <AdminGate>
      <View style={[shared.screen,shared.content]}>
        <Text style={shared.h1}>Mentor Assignments</Text>
        <Card>
          <Text style={shared.h2}>Choose Mentor</Text>
          <View style={styles.wrap}>
            {leaders.map(x=>(
              <Pressable key={x.id} onPress={()=>setMentorId(x.id)} style={[styles.chip,mentorId===x.id&&styles.chipOn]}>
                <Text>{x.full_name||x.role}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={shared.h2}>Choose Disciple</Text>
          <View style={styles.wrap}>
            {members.filter(x=>x.id!==mentorId).map(x=>(
              <Pressable key={x.id} onPress={()=>setDiscipleId(x.id)} style={[styles.chip,discipleId===x.id&&styles.chipOn]}>
                <Text>{x.full_name||'Member'}</Text>
              </Pressable>
            ))}
          </View>

          <Button title="ASSIGN MENTOR" onPress={assign}/>
        </Card>
      </View>
    </AdminGate>
  )
}

const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginVertical:9},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:18,paddingVertical:7,paddingHorizontal:9},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green}
});
