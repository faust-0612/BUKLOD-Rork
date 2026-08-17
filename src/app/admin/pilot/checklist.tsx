import { useEffect, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

export default function PilotChecklistAdmin(){
  const [rows,setRows]=useState<any[]>([]);

  useEffect(()=>{
    supabase.rpc('pilot_checklist_admin_summary')
      .then(({data,error})=>{
        if(error)Alert.alert('Pilot Checklist',error.message);
        setRows(data??[]);
      });
  },[]);

  return(
    <AdminGate>
      <View style={shared.screen}>
        <FlatList contentContainerStyle={shared.content}
          data={rows} keyExtractor={i=>`${i.cohort_name}-${i.user_id}`}
          ListHeaderComponent={<View>
            <Text style={shared.h1}>Pilot Checklist Progress</Text>
            <Text style={shared.muted}>This shows which product experiences testers marked as tested. Do not use it as a ministry-performance ranking.</Text>
          </View>}
          ListEmptyComponent={<Card><Text style={shared.muted}>No active pilot participants.</Text></Card>}
          renderItem={({item})=>(
            <Card>
              <Text style={shared.h2}>{item.full_name}</Text>
              <Text style={shared.muted}>{item.cohort_name} • {item.role}</Text>
              <Text style={[shared.body,{marginTop:6}]}>
                {item.completed_items} of {item.total_items} items • {item.completion_percent}%
              </Text>
            </Card>
          )}/>
      </View>
    </AdminGate>
  )
}
