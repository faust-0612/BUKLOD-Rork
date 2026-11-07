import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function SupportCenter(){
  const [items,setItems]=useState<any[]>([]);
  const [query,setQuery]=useState('');

  useEffect(()=>{
    supabase.from('help_articles')
      .select('slug,category,title,summary,sort_order')
      .eq('is_published',true)
      .order('sort_order')
      .then(({data})=>setItems(data??[]));
  },[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return items;
    return items.filter(x=>
      x.title.toLowerCase().includes(q) ||
      (x.summary||'').toLowerCase().includes(q) ||
      (x.category||'').toLowerCase().includes(q)
    );
  },[items,query]);

  return(
    <View style={shared.screen}>
      <FlatList contentContainerStyle={shared.content}
        data={filtered} keyExtractor={i=>i.slug}
        ListHeaderComponent={<View>
          <Text style={shared.h1}>BUKLOD Support</Text>
          <Text style={shared.muted}>Quick answers about privacy, pilot testing, notifications, and common app workflows.</Text>
          <TextInput value={query} onChangeText={setQuery}
            placeholder="Search help..." style={styles.search}/>
          <View style={{backgroundColor:'#e7f6ee',padding:13,borderRadius:12,marginVertical:9}}>
            <Text style={{fontSize:16,fontWeight:'800',color:colors.green}}>Live Chat · Report a Problem</Text>
            <Text style={{color:colors.text,marginTop:6,lineHeight:20}}>
              Ilarawan ang problema at kung saang screen ito nangyari. Mag-attach ng screenshot, larawan, o maikling video kung kailangan para makita at maayos ang issue. Takpan ang private details; huwag mag-send ng password o OTP.
            </Text>
          </View>
          <Button title="OPEN LIVE CHAT · SEND SCREENSHOT / VIDEO" onPress={()=>router.push('/support/live' as any)}/>
          <Button title="SEND FEEDBACK" onPress={()=>router.push('/feedback')}/>
        </View>}
        ListEmptyComponent={<Card><Text style={shared.muted}>No help article matches your search.</Text></Card>}
        renderItem={({item})=>(
          <Pressable onPress={()=>router.push(`/support/${item.slug}`)}>
            <Card>
              <Text style={{fontSize:11,fontWeight:'900',color:colors.green}}>{item.category.toUpperCase()}</Text>
              <Text style={shared.h2}>{item.title}</Text>
              {!!item.summary&&<Text style={[shared.muted,{marginTop:5}]}>{item.summary}</Text>}
            </Card>
          </Pressable>
        )}/>
    </View>
  )
}
const styles=StyleSheet.create({
  search:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white,marginVertical:10}
});
