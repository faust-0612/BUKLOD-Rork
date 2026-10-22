import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Card, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';

export default function MyFeedback(){
  const {user}=useAuth();
  const [items,setItems]=useState<any[]>([]);

  useEffect(()=>{
    if(!user)return;
    supabase.from('user_feedback')
      .select('id,category,title,message,status,resolution,created_at')
      .eq('user_id',user.id)
      .order('created_at',{ascending:false})
      .then(({data})=>setItems(data??[]));
  },[user?.id]);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>My Feedback</Text>
          <Text style={shared.muted}>Track the feedback you sent during the BUKLOD pilot.</Text>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No feedback submitted yet.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Text style={shared.h2}>{item.title}</Text>
            <Text style={shared.muted}>{item.category.replace('_',' ')} • {item.status} • {new Date(item.created_at).toLocaleString()}</Text>
            <Text style={[shared.body,{marginTop:7}]}>{item.message}</Text>
            {!!item.resolution&&<Text style={[shared.body,{marginTop:8}]}>Resolution: {item.resolution}</Text>}
          </Card>
        )}/>
    </View>
  )
}
