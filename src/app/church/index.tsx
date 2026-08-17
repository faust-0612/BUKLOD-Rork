import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, Button, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { FeatureUnavailable } from '@/components/FeatureUnavailable';

export default function ChurchLifeScreen() {
  const { featureEnabled } = useRuntimeConfig();
  if (!featureEnabled('church_life')) return <FeatureUnavailable title="Church Life"/>;
  const {user}=useAuth();
  const [events,setEvents]=useState<any[]>([]);
  const [announcements,setAnnouncements]=useState<any[]>([]);
  const [assignments,setAssignments]=useState<any[]>([]);

  const load=useCallback(async()=>{
    if(!user)return;
    const now=new Date().toISOString();
    const [{data:e},{data:a},{data:s}]=await Promise.all([
      supabase.from('church_events')
        .select('id,title,event_type,starts_at,ends_at,location,requires_rsvp,is_cancelled')
        .gte('starts_at',now).eq('is_cancelled',false).order('starts_at').limit(20),
      supabase.from('announcements')
        .select('id,title,body,priority,is_pinned,starts_at,event_id')
        .lte('starts_at',now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('is_pinned',{ascending:false})
        .order('starts_at',{ascending:false})
        .limit(10),
      supabase.from('event_service_assignments')
        .select('id,status,assignment,event:event_id(id,title,starts_at,location),ministry:ministry_id(name)')
        .eq('user_id',user.id)
        .in('status',['assigned','confirmed'])
        .order('assigned_at')
    ]);
    setEvents(e??[]);setAnnouncements(a??[]);setAssignments(s??[]);
  },[user?.id]);

  useEffect(()=>{load()},[load]);

  return(
    <View style={shared.screen}>
      <FlatList
        contentContainerStyle={shared.content}
        data={events}
        keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Church Life</Text>
            <Text style={shared.muted}>Calendar, announcements, directory, attendance, ministries, and serving.</Text>
            <View style={{gap:8,marginTop:10}}>
              <Button title="CHURCH DIRECTORY" onPress={()=>router.push('/church/directory')}/>
              <Button title="HOUSEHOLDS" outline onPress={()=>router.push('/church/household')}/>
            </View>

            {!!assignments.length&&<>
              <SectionTitle>MY SERVING SCHEDULE</SectionTitle>
              {assignments.slice(0,3).map(x=>(
                <Pressable key={x.id} onPress={()=>router.push(`/church/event/${x.event.id}`)}>
                  <Card>
                    <Text style={shared.h2}>🤝 {x.assignment}</Text>
                    <Text style={shared.muted}>{x.event?.title} • {fmt(x.event?.starts_at)}</Text>
                    <Text style={{fontWeight:'900',color:colors.green,marginTop:5}}>{x.status}</Text>
                  </Card>
                </Pressable>
              ))}
              <Button title="VIEW MY MINISTRIES" outline onPress={()=>router.push('/church/ministries')}/>
            </>}

            {!!announcements.length&&<>
              <SectionTitle>ANNOUNCEMENTS</SectionTitle>
              {announcements.slice(0,3).map(a=>(
                <Pressable key={a.id} onPress={()=>router.push(`/church/announcement/${a.id}`)}>
                  <Card>
                    <Text style={shared.h2}>{a.is_pinned?'📌 ':''}{a.title}</Text>
                    <Text style={shared.muted}>{a.priority}</Text>
                    <Text numberOfLines={2} style={[shared.body,{marginTop:5}]}>{a.body}</Text>
                  </Card>
                </Pressable>
              ))}
            </>}

            <SectionTitle>UPCOMING EVENTS</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No upcoming events visible to you.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/church/event/${item.id}`)}>
            <Card>
              <Text style={{color:colors.green,fontWeight:'900'}}>{item.event_type.replace('_',' ')}</Text>
              <Text style={shared.h2}>{item.title}</Text>
              <Text style={shared.muted}>{fmt(item.starts_at)}{item.location?` • ${item.location}`:''}</Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}
function fmt(value?:string){
  if(!value)return '';
  return new Date(value).toLocaleString([],{
    weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  });
}
