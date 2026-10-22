import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

export default function MyMinistries() {
  const {user}=useAuth();
  const [memberships,setMemberships]=useState<any[]>([]);
  const [assignments,setAssignments]=useState<any[]>([]);

  const load=useCallback(async()=>{
    if(!user)return;
    const [{data:m},{data:a}]=await Promise.all([
      supabase.from('ministry_members')
        .select('status,ministry_role,ministry:ministry_id(id,name,description)')
        .eq('user_id',user.id),
      supabase.from('event_service_assignments')
        .select('id,assignment,status,event:event_id(title,starts_at,location),ministry:ministry_id(name)')
        .eq('user_id',user.id).order('assigned_at',{ascending:false})
    ]);
    setMemberships(m??[]);setAssignments(a??[]);
  },[user?.id]);

  useEffect(()=>{load()},[load]);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={assignments} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>My Ministries</Text>
            <SectionTitle>MINISTRY MEMBERSHIP</SectionTitle>
            {memberships.length?memberships.map((m:any)=>(
              <Card key={m.ministry?.id}>
                <Text style={shared.h2}>{m.ministry?.name||'Ministry'}</Text>
                <Text style={shared.muted}>{m.ministry_role||'Member'} • {m.status}</Text>
                {!!m.ministry?.description&&<Text style={[shared.body,{marginTop:6}]}>{m.ministry.description}</Text>}
              </Card>
            )):<Card><Text style={shared.muted}>No ministry membership assigned yet.</Text></Card>}
            <SectionTitle>SERVING HISTORY & SCHEDULE</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No serving assignments yet.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>🤝 {item.assignment}</Text>
            <Text style={shared.muted}>{item.event?.title} • {item.status}</Text>
            {!!item.event?.starts_at&&<Text style={[shared.body,{marginTop:5}]}>{new Date(item.event.starts_at).toLocaleString()}</Text>}
          </Card>
        )}
      />
    </View>
  )
}
