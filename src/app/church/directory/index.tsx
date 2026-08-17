import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { FeatureUnavailable } from '@/components/FeatureUnavailable';

export default function ChurchDirectory() {
  const { featureEnabled } = useRuntimeConfig();
  if (!featureEnabled('directory')) return <FeatureUnavailable title="Church Directory"/>;
  const [items,setItems]=useState<any[]>([]);
  const [query,setQuery]=useState('');

  const load=useCallback(async()=>{
    const {data}=await supabase.rpc('church_directory');
    setItems(data??[]);
  },[]);

  useEffect(()=>{load()},[load]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return items;
    return items.filter(x=>
      (x.full_name||'').toLowerCase().includes(q) ||
      (x.household_name||'').toLowerCase().includes(q) ||
      (x.ministries||[]).some((m:string)=>m.toLowerCase().includes(q))
    );
  },[items,query]);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={filtered} keyExtractor={i=>i.user_id}
        ListHeaderComponent={
          <View>
            <Text style={shared.h1}>Church Directory</Text>
            <Text style={shared.muted}>Only information each member allows is shown.</Text>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search member, household, ministry..."
              style={styles.search}/>
          </View>
        }
        ListEmptyComponent={<Card><Text style={shared.muted}>No visible members found.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/church/member/${item.user_id}`)}>
            <Card>
              <Text style={shared.h2}>{item.full_name||'Member'}</Text>
              <Text style={shared.muted}>{item.role?.replace('_',' ')}
                {item.household_name?` • ${item.household_name}`:''}
              </Text>
              {!!item.mobile&&<Text style={[shared.body,{marginTop:5}]}>📱 {item.mobile}</Text>}
              {item.birth_month&&item.birth_day&&
                <Text style={[shared.body,{marginTop:3}]}>🎂 {monthName(item.birth_month)} {item.birth_day}</Text>}
              {!!item.ministries?.length&&
                <Text style={[shared.body,{marginTop:3}]}>🤝 {item.ministries.join(', ')}</Text>}
            </Card>
          </Pressable>
        )}
      />
    </View>
  )
}

function monthName(n:number){
  return new Date(2000,n-1,1).toLocaleString([],{month:'long'});
}
const styles=StyleSheet.create({
  search:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white,marginVertical:12}
});
