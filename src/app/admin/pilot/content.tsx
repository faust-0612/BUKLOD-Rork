import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

export default function PilotContentAdmin(){
  const [templates,setTemplates]=useState<any[]>([]);
  const [articles,setArticles]=useState<any[]>([]);

  useEffect(()=>{
    Promise.all([
      supabase.from('announcement_templates').select('*').order('sort_order'),
      supabase.from('help_articles').select('slug,category,title,audience,is_published,sort_order').order('sort_order')
    ]).then(([a,h])=>{
      setTemplates(a.data??[]);
      setArticles(h.data??[]);
    });
  },[]);

  return(
    <View style={shared.screen}>
      <AdminGate>
        <FlatList contentContainerStyle={shared.content}
          data={templates} keyExtractor={i=>i.id}
          ListHeaderComponent={<View>
            <Text style={shared.h1}>Pilot Launch Content</Text>
            <Text style={shared.muted}>Review reusable announcements and the in-app Support Center content before each pilot phase.</Text>

            <SectionTitle>HELP ARTICLES</SectionTitle>
            {articles.map(a=>(
              <Card key={a.slug}>
                <Text style={shared.h2}>{a.title}</Text>
                <Text style={shared.muted}>{a.category} • {a.audience} • {a.is_published?'published':'draft'}</Text>
              </Card>
            ))}

            <SectionTitle>ANNOUNCEMENT TEMPLATES</SectionTitle>
          </View>}
          renderItem={({item})=>(
            <Card>
              <Text style={shared.h2}>{item.title}</Text>
              <Text style={shared.muted}>{item.default_scope} • {item.default_priority}</Text>
              <Text style={[shared.body,{marginTop:7}]}>{item.body_template}</Text>
            </Card>
          )}/>
      </AdminGate>
    </View>
  )
}
