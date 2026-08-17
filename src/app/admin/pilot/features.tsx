import { useEffect, useState } from 'react';
import { Alert, FlatList, Switch, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

export default function FeatureFlagsAdmin(){
  const [items,setItems]=useState<any[]>([]);

  const load=async()=>{
    const {data,error}=await supabase.from('feature_flags')
      .select('*').eq('scope','system').order('feature_key');
    if(error)return Alert.alert('Feature Flags',error.message);
    setItems(data??[]);
  };
  useEffect(()=>{load()},[]);

  const toggle=async(item:any,enabled:boolean)=>{
    const {error}=await supabase.rpc('set_feature_flag',{
      p_feature_key:item.feature_key,
      p_scope:'system',
      p_church_id:null,
      p_group_id:null,
      p_enabled:enabled,
      p_note:item.note??null
    });
    if(error)return Alert.alert('Feature Flag',error.message);
    setItems(rows=>rows.map(x=>x.id===item.id?{...x,enabled}:x));
  };

  return(
    <AdminGate>
      <View style={shared.screen}>
        <FlatList contentContainerStyle={shared.content}
          data={items} keyExtractor={i=>i.id}
          ListHeaderComponent={<View>
            <Text style={shared.h1}>Feature Flags</Text>
            <Text style={shared.muted}>System-wide rollout switches. Church/group overrides can be added later through the same database model.</Text>
          </View>}
          renderItem={({item})=>(
            <Card>
              <View style={shared.row}>
                <View style={{flex:1}}>
                  <Text style={shared.h2}>{item.feature_key.replace('_',' ')}</Text>
                  <Text style={shared.muted}>{item.note||'BUKLOD feature'}</Text>
                </View>
                <Switch value={item.enabled} onValueChange={v=>toggle(item,v)}/>
              </View>
            </Card>
          )}/>
      </View>
    </AdminGate>
  )
}
