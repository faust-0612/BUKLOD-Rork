import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

export default function MentorDashboard() {
  const {hasRole}=useAuth();
  const [rows,setRows]=useState<any[]>([]);

  const load=useCallback(async()=>{
    const {data,error}=await supabase.rpc('mentor_disciple_progress');
    if(error) return Alert.alert('Mentor Dashboard',error.message);
    setRows(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const canMentor=hasRole('mentor');

  if(!canMentor)return <View style={[shared.screen,shared.content]}>
    <Text style={shared.h1}>Mentor Dashboard</Text>
    <Card><Text>You do not currently have mentor access.</Text></Card>
  </View>;

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={rows} keyExtractor={i=>i.disciple_id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Mentor Dashboard</Text>
            <Text style={shared.muted}>Track discipleship progress without reducing growth to a spiritual ranking.</Text>
            <SectionTitle>MY DISCIPLES</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No active mentor assignments.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push({pathname:'/mentor/disciple',params:{id:item.disciple_id}})}>
            <Card>
              <Text style={shared.h2}>{item.disciple_name||'Disciple'}</Text>
              <Text style={shared.muted}>
                {item.active_tracks} active | {item.completed_tracks} completed | {item.lessons_completed} lessons
              </Text>
              {Number(item.pending_assignments)>0&&
                <Text style={{marginTop:7,fontWeight:'900'}}>📝 {item.pending_assignments} assignment(s) to review</Text>}
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}

