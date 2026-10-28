import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';

function DevotionalScreenContent() {
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
      {/* BUKLOD_DAILY_DEVOTIONAL_R24_DETAIL */}
      <Text style={[shared.muted,{fontWeight:'800'}]}>{item.bible_passage}</Text>
      <Text style={[shared.h1,{marginTop:4}]}>{item.title}</Text>
      <S title="📖 SCRIPTURE">{item.scripture_text || item.key_verse}</S>
      <S title="✍️ REFLECTION">{item.reflection_text}</S>
      <S title="🌱 STORY / ILLUSTRATION">{item.illustration_text}</S>
      {item.quotation_text ? (
        <Card>
          <Text style={shared.h2}>💬 QUOTATION</Text>
          <Text style={[shared.body,{marginTop:7,fontStyle:'italic'}]}>
            “{item.quotation_text}”
          </Text>
          {item.quotation_author ? (
            <Text style={[shared.muted,{marginTop:7,fontWeight:'800'}]}>
              — {item.quotation_author}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <S title="❓ THINK ABOUT IT">{item.think_about_it}</S>
      <S title="🛠️ PRACTICAL TODAY">{item.live_it_today || item.application_text}</S>
      <S title="🙏 PRAY">{item.prayer_text}</S>
      <Button title="CONTINUE TO REFLECTION" onPress={()=>router.push(`/reflection/${item.id}`)} />
    </ScrollView>
      </SafeAreaView>
    </>
  );
}

export default function DevotionalScreen() {
  return <BuklodFaithRouteBoundary><DevotionalScreenContent /></BuklodFaithRouteBoundary>;
}
