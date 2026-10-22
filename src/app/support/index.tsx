import { useMemo,useState } from 'react';
import { FlatList,Pressable,StyleSheet,Text,TextInput,View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button,Card,shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
export default function SupportCenter(){
  const [query,setQuery]=useState('');
  const {data,loading,error,online,refresh}=useBuklodOfflineCache<any[]>({
    cacheKey:'published-help-articles-r6',
    fetcher:async()=>{const r=await supabase.from('help_articles').select('slug,category,title,summary,sort_order').eq('is_published',true).order('sort_order');if(r.error)throw r.error;return r.data??[];}
  });
  const items=data??[];
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(x=>[x.title,x.summary,x.category].some(v=>String(v??'').toLowerCase().includes(q))):items;},[data,query]);
  return <View style={shared.screen}><FlatList contentContainerStyle={shared.content} data={filtered} keyExtractor={i=>i.slug}
    ListHeaderComponent={<View><Text style={shared.h1}>BUKLOD Support</Text><Text style={shared.muted}>Search help and get support.</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search help..." style={styles.search}/><Button title="CHECK & FIX / SUPPORT" onPress={()=>router.push('/help?category=TECHNICAL' as any)}/><Button title="SEND FEEDBACK" onPress={()=>router.push('/feedback')}/>{!online&&<Text>Offline - saved help remains available.</Text>}{!!error&&<Text accessibilityRole="alert">Help unavailable. Saved articles remain available.</Text>}</View>}
    ListEmptyComponent={<Card><Text style={shared.muted}>{loading?'Loading help...':!online?'Offline - no saved matching article.':error?'Help temporarily unavailable.':'No help article matches your search.'}</Text><Button title="RETRY" onPress={()=>void refresh()}/></Card>}
    renderItem={({item})=><Pressable onPress={()=>router.push(('/support/'+encodeURIComponent(item.slug)) as any)}><Card><Text style={{color:colors.green,fontWeight:'900'}}>{String(item.category??'').toUpperCase()}</Text><Text style={shared.h2}>{item.title}</Text>{!!item.summary&&<Text style={shared.muted}>{item.summary}</Text>}</Card></Pressable>} /></View>;
}
const styles=StyleSheet.create({search:{borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,backgroundColor:colors.white,marginVertical:10}});
