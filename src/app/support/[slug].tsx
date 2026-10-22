import { ScrollView,Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button,Card,shared } from '@/components/UI';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
export default function SupportArticle(){
  const {slug}=useLocalSearchParams<{slug:string}>();
  const {data:item,loading,error,online,refresh}=useBuklodOfflineCache<any>({
    cacheKey:'published-help-article:'+String(slug??''),enabled:Boolean(slug),
    fetcher:async()=>{const r=await supabase.from('help_articles').select('slug,category,title,summary,body').eq('slug',slug).eq('is_published',true).single();if(r.error)throw r.error;return r.data;}
  });
  return <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
    {!online&&<Text>Offline - showing saved help if available.</Text>}
    {item?<><Text style={shared.muted}>{String(item.category??'').toUpperCase()}</Text><Text style={shared.h1}>{item.title}</Text>{!!item.summary&&<Text style={shared.muted}>{item.summary}</Text>}<Card><Text style={shared.body}>{item.body}</Text></Card></>:<Card><Text>{loading?'Loading help...':error?'Help unavailable. Retry when connected.':'No saved help article is available.'}</Text><Button title="RETRY" onPress={()=>void refresh()}/></Card>}
  </ScrollView>;
}
