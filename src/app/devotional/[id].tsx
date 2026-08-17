import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function DevotionalScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
  const [item, setItem] = useState<any>(null);

  useEffect(()=>{
    if (!id) return;
    supabase.from('devotionals').select('*').eq('id',id).single()
      .then(({data})=>setItem(data));
  },[id]);

  if (!item) return <View style={[shared.screen,{justifyContent:'center'}]}><ActivityIndicator color={colors.green}/></View>;

  const S = ({title, children}:{title:string;children?:string|null}) =>
    children ? <Card><Text style={shared.h2}>{title}</Text><Text style={[shared.body,{marginTop:7}]}>{children}</Text></Card> : null;

  return (
    <>
      {/* LESSON_SAFE_AREA */}
      <SafeAreaView
        style={{ flex: 1 }}
        edges={['top', 'bottom']}
      >
        <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <BuklodOccasionalAd placement="devotion" />
      <Text style={shared.muted}>{item.bible_passage}</Text>
      <Text style={shared.h1}>{item.title}</Text>
      <S title="📖 SCRIPTURE">{item.scripture_text || item.key_verse}</S>
      <S title="✍️ REFLECTION">{item.reflection_text}</S>
      <S title="❓ THINK ABOUT IT">{item.think_about_it}</S>
      <S title="✅ LIVE IT TODAY">{item.live_it_today}</S>
      <S title="🙏 PRAY">{item.prayer_text}</S>
      <Button title="CONTINUE TO REFLECTION" onPress={()=>router.push(`/reflection/${item.id}`)} />
    </ScrollView>
      </SafeAreaView>
    </>
  );
}
