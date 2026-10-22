import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function LeaderDashboard() {
  const {hasAnyRole}=useAuth();
  const [groups,setGroups]=useState<any[]>([]);
  const [groupId,setGroupId]=useState('');
  const [members,setMembers]=useState<any[]>([]);

  const allowed=hasAnyRole(['leader','pastor','local_admin','system_admin']);

  const loadGroups=useCallback(async()=>{
    if(!allowed)return;
    const {data,error}=await supabase.from('buklod_groups')
      .select('id,name,church_id').eq('is_active',true).order('name');
    if(error)return Alert.alert('Groups',error.message);
    setGroups(data??[]);
    if(!groupId&&data?.length)setGroupId(data[0].id);
  },[allowed,groupId]);

  const loadMembers=useCallback(async()=>{
    if(!groupId)return setMembers([]);
    const {data,error}=await supabase.rpc('leader_member_engagement',{p_group_id:groupId});
    if(error)return Alert.alert('Engagement',error.message);
    setMembers(data??[]);
  },[groupId]);

  useEffect(()=>{loadGroups()},[loadGroups]);
  useEffect(()=>{loadMembers()},[loadMembers]);

  useEffect(()=>{
    if(!groupId)return;
    const ch=supabase.channel(`leader-engagement:${groupId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'devotional_completions'},loadMembers)
      .on('postgres_changes',{event:'*',schema:'public',table:'follow_ups',filter:`group_id=eq.${groupId}`},loadMembers)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[groupId,loadMembers]);

  if(!allowed)return <View style={[shared.screen,shared.content]}>
    <Text style={shared.h1}>Leader Dashboard</Text>
    <Card><Text>You do not have leader access.</Text></Card>
  </View>;

  const selected=groups.find(g=>g.id===groupId);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={members} keyExtractor={i=>i.user_id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Leader Dashboard</Text>
            <Text style={shared.muted}>Participation signals are for care and follow-up, not spiritual ranking.

<Button
  title="FORMATION VALIDATION"
  onPress={() => router.push('/leader/formation')}
/></Text>
            <SectionTitle>GROUP</SectionTitle>
            <View style={styles.wrap}>
              {groups.map(g=>(
                <Pressable key={g.id} onPress={()=>setGroupId(g.id)} style={[styles.chip,groupId===g.id&&styles.chipOn]}>
                  <Text style={{fontWeight:'800'}}>{g.name}</Text>
                </Pressable>
              ))}
            </View>
            <SectionTitle>{selected?.name?.toUpperCase() || 'MEMBERS'}</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No visible members.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <View style={shared.row}>
              <View style={{flex:1}}>
                <Text style={shared.h2}>{item.full_name||'Member'}</Text>
                <Text style={shared.muted}>{item.completed_last_7_days}/7 devotional days • {
                  item.days_since_completion===999?'No completion yet':
                  item.days_since_completion===0?'Completed today':
                  `${item.days_since_completion} day(s) since last completion`
                }</Text>
              </View>
              <Text style={[styles.status,styles[item.engagement_status as keyof typeof styles]]}>
                {item.engagement_status.replace('_',' ')}
              </Text>
            </View>

            {item.open_follow_up_id ? (
              <Pressable onPress={()=>router.push(`/leader/follow-up/${item.open_follow_up_id}`)}>
                <Text style={styles.link}>OPEN FOLLOW-UP</Text>
              </Pressable>
            ) : item.engagement_status!=='active' ? (
              <Button title="START CARING FOLLOW-UP" outline onPress={async()=>{
                const {data,error}=await supabase.rpc('open_member_follow_up',{
                  p_member_id:item.user_id,
                  p_group_id:groupId,
                  p_reason:`${item.engagement_status.replace('_',' ')} participation check-in`
                });
                if(error)return Alert.alert('Follow-up',error.message);
                router.push(`/leader/follow-up/${data}`);
              }}/>
            ) : null}
          </Card>
        )}
      />
    </View>
  )
}

const styles=StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:20,paddingVertical:8,paddingHorizontal:11,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
  status:{fontSize:10,fontWeight:'900',paddingVertical:5,paddingHorizontal:7,borderRadius:10,overflow:'hidden'},
  active:{backgroundColor:colors.greenSoft,color:colors.greenDark},
  check_in:{backgroundColor:'#FFF7E8',color:'#9B6500'},
  follow_up:{backgroundColor:'#FFF0DD',color:'#A45A00'},
  attention:{backgroundColor:'#FFECEC',color:colors.danger},
  link:{color:colors.green,fontWeight:'900',fontSize:12,marginTop:10}
});



