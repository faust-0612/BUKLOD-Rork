import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';

export default function AnnouncementDetail() {
  const {id}=useLocalSearchParams<{id:string}>();
  const [item,setItem]=useState<any>(null);

  useEffect(()=>{
    if(!id)return;
    supabase.from('announcements').select('*').eq('id',id).single().then(async({data})=>{
      setItem(data);
      await supabase.rpc('mark_announcement_read',{p_announcement_id:id});
    });
  },[id]);

  if(!item)return <View style={shared.screen}/>;
  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.muted}>{item.priority.toUpperCase()} {item.is_pinned?'• PINNED':''}</Text>
      <Text style={shared.h1}>{item.title}</Text>
      <Card><Text style={shared.body}>{item.body}</Text></Card>
      {!!item.event_id&&<Button title="OPEN LINKED EVENT" onPress={()=>router.push(`/church/event/${item.event_id}`)}/>}
    </ScrollView>
  )
}
