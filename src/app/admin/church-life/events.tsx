import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

export default function EventsAdmin() {
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{
    supabase.from('church_events').select('*').order('starts_at',{ascending:false}).limit(100)
      .then(({data})=>setItems(data??[]));
  },[]);
  return(
    <AdminGate>
      <View style={shared.screen}>
        <FlatList contentContainerStyle={shared.content} data={items} keyExtractor={i=>i.id}
          ListHeaderComponent={<Text style={shared.h1}>Manage Events</Text>}
          renderItem={({item})=>(
            <Pressable onPress={()=>router.push(`/church/event/${item.id}`)}>
              <Card>
                <Text style={shared.h2}>{item.title}</Text>
                <Text style={shared.muted}>{item.scope} • {new Date(item.starts_at).toLocaleString()}</Text>
              </Card>
            </Pressable>
          )}/>
      </View>
    </AdminGate>
  )
}
