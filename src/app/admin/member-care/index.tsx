import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';

export default function MemberCareIndex() {
  const [members,setMembers]=useState<any[]>([]);

  useEffect(()=>{
    supabase.rpc('church_directory').then(({data})=>setMembers(data??[]));
  },[]);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={members} keyExtractor={i=>i.user_id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Member Care</Text>
            <Text style={shared.muted}>Pastoral care profiles and private care notes.</Text>
            <SectionTitle>MEMBERS</SectionTitle>
          </View>
        }
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/admin/member-care/${item.user_id}`)}>
            <Card>
              <Text style={shared.h2}>{item.full_name}</Text>
              <Text style={shared.muted}>{item.household_name||'No household linked'} • {item.role}</Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}
