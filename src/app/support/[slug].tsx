import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, shared } from '@/components/UI';

export default function SupportArticle(){
  const {slug}=useLocalSearchParams<{slug:string}>();
  const [item,setItem]=useState<any>(null);

  useEffect(()=>{
    if(!slug)return;
    supabase.from('help_articles')
      .select('*').eq('slug',slug).eq('is_published',true).single()
      .then(({data})=>setItem(data));
  },[slug]);

  if(!item)return <View style={shared.screen}/>;

  return(
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.muted}>{item.category?.toUpperCase()}</Text>
      <Text style={shared.h1}>{item.title}</Text>
      {!!item.summary&&<Text style={shared.muted}>{item.summary}</Text>}
      <Card><Text style={shared.body}>{item.body}</Text></Card>
    </ScrollView>
  )
}
