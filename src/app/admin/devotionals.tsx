import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function DevotionalManager() {
  const [items,setItems]=useState<any[]>([]);

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from('devotionals')
      .select('id,title,bible_passage,publish_date,is_published,day_number,series:series_id(title)')
      .order('publish_date',{ascending:false})
      .order('created_at',{ascending:false});
    if(error) Alert.alert('Devotionals',error.message);
    setItems(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  return (
    <AdminGate>
      <FlatList style={shared.screen} contentContainerStyle={shared.content}
        data={items} keyExtractor={i=>i.id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Devotional Manager</Text>
            <Text style={shared.muted}>Create, edit, schedule, and publish devotional content.</Text>
            <View style={{height:10}}/>
            <Button title="+ NEW DEVOTIONAL" onPress={()=>router.push('/admin/devotional-editor')}/>
            <SectionTitle>ALL DEVOTIONALS</SectionTitle>
          </View>
        }
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push({pathname:'/admin/devotional-editor',params:{id:item.id}})}>
            <Card>
              <View style={shared.row}>
                <View style={{flex:1}}>
                  <Text style={shared.h2}>{item.title}</Text>
                  <Text style={shared.muted}>{item.bible_passage || 'No passage'} • {item.series?.title || 'No series'}</Text>
                  <Text style={styles.meta}>{item.publish_date || 'No date'} {item.day_number ? `• Day ${item.day_number}` : ''}</Text>
                </View>
                <Text style={[styles.badge,item.is_published?styles.live:styles.draft]}>
                  {item.is_published ? 'LIVE/SCHEDULED' : 'DRAFT'}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </AdminGate>
  );
}
const styles=StyleSheet.create({
  meta:{fontSize:12,color:colors.muted,marginTop:5},
  badge:{fontSize:9,fontWeight:'900',paddingVertical:5,paddingHorizontal:7,borderRadius:10,overflow:'hidden'},
  live:{backgroundColor:colors.greenSoft,color:colors.greenDark},
  draft:{backgroundColor:'#FFF5E5',color:'#9B6500'},
});
