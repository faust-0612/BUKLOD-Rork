import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { useAuth } from '@/providers/AuthProvider';
import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import BuklodDevotionalRewardStatus from '@/components/BuklodDevotionalRewardStatus';
// BUKLOD_DEVOTIONAL_POINTS_UI_R1

export default function DevotionalScreen() {
  const { id } = useLocalSearchParams<{id:string}>();
  const {user}=useAuth();
  const {data:item,loading,error,online,refresh}=useBuklodOfflineCache<any>({
    cacheKey:user?.id&&id?'devotional:'+user.id+':'+id:'',enabled:Boolean(user?.id&&id),
    fetcher:async()=>{const result=await supabase.from('devotionals').select('*').eq('id',id).single();if(result.error)throw result.error;return result.data;},
  });
  if (!item) return <View style={[shared.screen,{justifyContent:'center',padding:20}]}>{loading?<ActivityIndicator color={colors.green}/>:<><Text>{!online?'Offline - no saved devotion for this account.':error?'Devotion unavailable. Retry when connected.':'Devotion unavailable.'}</Text><Button title="RETRY" onPress={()=>void refresh()}/></>}</View>;

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
      <BuklodDevotionalRewardStatus devotionalId={String(item.id)} />
      <Button title="CONTINUE TO REFLECTION" onPress={()=>router.push(`/reflection/${item.id}`)} />
    </ScrollView>
      </SafeAreaView>
    </>
  );
}
