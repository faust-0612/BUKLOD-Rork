import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import BuklodOccasionalAd from '@/components/BuklodOccasionalAd';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';

function DevotionalScreenContent() {
  const { id } = useLocalSearchParams<{id:string}>();
  const { user } = useAuth();
  const { online } = useNetwork();
  const accountId = user?.id ?? '';
  const [item, setItem] = useState<any>(null);
  const [itemOwner, setItemOwner] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setItem(null);
    setItemOwner('');
    setErrorText('');
    setLoading(true);
    if (!id || !accountId) {
      setErrorText('Sign in to open this Word.');
      setLoading(false);
      return () => { active = false; };
    }
    void (async () => {
      const cache = await getOfflineCache<any>('word-full:' + id, {
        userId: accountId, allowStale: true,
      });
      if (!active) return;
      if (cache?.data?.id === id) {
        setItem(cache.data);
        setItemOwner(accountId);
        setLoading(false);
      }
      if (!online) {
        if (!cache?.data) setErrorText('This Word was not downloaded on this device. Connect once to save it.');
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from('devotionals').select('*')
          .eq('id', id).eq('is_published', true).single();
        if (error) throw error;
        if (!active) return;
        if (data) {
          setItem(data);
          setItemOwner(accountId);
          void setOfflineCache('word-full:' + id, data, {
            userId: accountId, ttlMs: 30 * 24 * 60 * 60 * 1000,
          }).catch(() => undefined);
        }
      } catch {
        if (active) setErrorText(cache?.data
          ? 'Connection unavailable. Showing your saved Word.'
          : 'Unable to open this Word. Retry when online.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, accountId, online]);

  if (!item || itemOwner !== accountId) return <View style={[shared.screen,{justifyContent:'center',alignItems:'center',padding:18}]}>
    {loading ? <ActivityIndicator color={colors.green}/> :
      <Text style={shared.muted}>{errorText || 'No saved Word available.'}</Text>}
  </View>;

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
      {!!errorText && <Text style={shared.muted}>{errorText}</Text>}
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
      <Button title="MY DEVOTIONAL SUBMISSIONS / REVISIONS"
        onPress={()=>router.push('/devotional/submissions' as any)} />
    </ScrollView>
      </SafeAreaView>
    </>
  );
}

export default function DevotionalScreen() {
  return <BuklodFaithRouteBoundary><DevotionalScreenContent /></BuklodFaithRouteBoundary>;
}
