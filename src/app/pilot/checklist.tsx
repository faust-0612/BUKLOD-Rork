import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function PilotChecklist(){
  const [items,setItems]=useState<any[]>([]);

  const load=useCallback(async()=>{
    const {data,error}=await supabase.rpc('pilot_checklist_for_current_user');
    if(error)return Alert.alert('Pilot Checklist',error.message);
    setItems(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const done=items.filter(x=>x.completed).length;
  const percent=items.length?Math.round(done/items.length*100):0;

  const toggle=async(item:any)=>{
    const {error}=await supabase.rpc('set_pilot_checklist_item',{
      p_code:item.code,p_completed:!item.completed
    });
    if(error)return Alert.alert('Checklist',error.message);
    await load();
  };

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.code}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>Pilot Checklist</Text>
          <Text style={shared.muted}>This records which pilot experiences you intentionally tested. It is not a performance or spiritual score.</Text>
          <Card>
            <View style={shared.row}>
              <Text style={shared.h2}>{done} of {items.length}</Text>
              <Text style={{fontWeight:'900',color:colors.green}}>{percent}% tested</Text>
            </View>
            <View style={styles.bar}><View style={[styles.fill,{width:`${percent}%`}]} /></View>
          </Card>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No checklist items are assigned to your role.</Text></Card>}
        renderItem={({item})=>(
          <Card>
            <Pressable onPress={()=>toggle(item)}>
              <View style={shared.row}>
                <View style={{flex:1}}>
                  <Text style={shared.h2}>{item.completed?'✓ ':''}{item.title}</Text>
                  <Text style={[shared.body,{marginTop:5}]}>{item.description}</Text>
                </View>
                <Text style={styles.check}>{item.completed?'✅':'○'}</Text>
              </View>
            </Pressable>
            {!!item.action_route&&<View style={{marginTop:10}}>
              <Button title="OPEN FEATURE" outline onPress={()=>router.push(item.action_route as any)}/>
            </View>}
          </Card>
        )}/>
    </View>
  )
}

const styles=StyleSheet.create({
  bar:{height:8,backgroundColor:colors.line,borderRadius:20,overflow:'hidden',marginTop:10},
  fill:{height:'100%',backgroundColor:colors.green},
  check:{fontSize:23}
});
