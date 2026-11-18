import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import BuklodLifeTabs from '@/components/BuklodLifeTabs';
import { useBuklodLifeLanguage } from '@/hooks/useBuklodLifeLanguage';
import { loadBuklodLifeImpact } from '@/lib/buklodLifeImpact';
import {
  loadBuklodLifePrivateProgress,
  clearBuklodLifePrivateProgress,
  type BuklodLifePrivateProgress,
} from '@/lib/buklodLifePrivateProgress';
import { useAuth } from '@/providers/AuthProvider';

function LifeImpactContent() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const lang = useBuklodLifeLanguage();
  const fil = lang === 'fil';
  const [reached, setReached] = useState<number | null>(null);
  const [saved, setSaved] = useState<BuklodLifePrivateProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [partial, setPartial] = useState(false);

  const refresh = useCallback(async (cancelled: () => boolean) => {
    setLoading(true);
    try {
      const [summary, privateProgress] = await Promise.all([
        loadBuklodLifeImpact().catch(() => null),
        loadBuklodLifePrivateProgress(user?.id),
      ]);
      if (cancelled()) return;
      setReached(summary ? Math.max(0, summary.people_reached) : null);
      setPartial(Boolean(summary?.partial || !summary));
      setSaved(privateProgress);
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void refresh(() => cancelled);
    return () => { cancelled = true; };
  }, [refresh]));

  const topicLabel = useMemo(() => {
    if (!saved) return '';
    const labels: Record<BuklodLifePrivateProgress['topic'], [string, string]> = {
      hope:['Pag-asa','Hope'], peace:['Kapayapaan','Peace'], purpose:['Layunin','Purpose'],
      forgiveness:['Kapatawaran','Forgiveness'], strength:['Lakas','Strength'],
      'new-start':['Bagong Simula','A New Start'], questions:['Mga Tanong','Questions'],
      jesus:['Kilalanin si Jesus','Explore Jesus'], help:['Tulungan ang Iba','Help Someone'],
    };
    return labels[saved.topic][fil ? 0 : 1];
  }, [saved, fil]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{
      paddingHorizontal: 18, paddingTop: Math.max(insets.top, 16),
      paddingBottom: Math.max(insets.bottom, 20) + 28, gap: 17,
    }}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={23} color="#25482F"/>
        <Text style={styles.backText}>LIFE</Text>
      </Pressable>
      <BuklodLifeTabs active="impact" language={lang}/>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{fil ? 'ANG IYONG EPEKTO' : 'YOUR IMPACT'}</Text>
        <Text style={styles.title}>{fil ? 'Bawat pag-abot ay mahalaga.' : 'Every invitation matters.'}</Text>
        <Text style={styles.subtitle}>{fil
          ? 'Ibahagi ang BUKLOD nang may malasakit. Ang personal na pananampalataya ng bawat tao ay mananatiling kanya.'
          : 'Share BUKLOD with care. Each person’s private faith journey belongs to them.'}</Text>
      </View>

      <View style={styles.treeCard}>
        <View style={styles.treeSymbol}>
          <MaterialCommunityIcons name="tree" size={100} color="#518D58"/>
        </View>
        <Text style={styles.treeTitle}>{fil ? 'Puno ng Buhay' : 'Life Tree'}</Text>
        <Text style={styles.treeSub}>{fil
          ? 'Simbolo ng mga imbitasyong naibahagi mo, hindi ng conversion o spiritual status ng iba.'
          : 'A symbol of invitations you have shared, not conversions or anyone else’s spiritual status.'}</Text>
        {loading ? <ActivityIndicator color="#3F7350"/> : (
          <View style={styles.metric}>
            <Text style={styles.metricNumber}>{reached === null ? '—' : reached}</Text>
            <Text style={styles.metricLabel}>{fil ? 'Mga taong naimbitahan' : 'People invited'}</Text>
          </View>
        )}
        {partial && <Text style={styles.partial}>{fil
          ? 'Maaaring hindi pa kumpleto ang referral sync. Walang spiritual activity ng iba ang ipinapakita.'
          : 'Referral sync may be incomplete. Other people’s spiritual activity is never displayed.'}</Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <MaterialCommunityIcons name="bookmark-outline" size={23} color="#356E48"/>
          <Text style={styles.sectionTitle}>{fil ? 'Aking pribadong pagpapatuloy' : 'My private continuation'}</Text>
        </View>
        {saved ? (
          <>
            <Text style={styles.body}>{fil
              ? 'Ang sariling pinili mong balikan ay naka-encrypt sa device na ito. Hindi ito ipinapakita sa inviter, admin, o ibang member.'
              : 'Your chosen checkpoint is encrypted on this device and is not shared with inviters, admins, or other members.'}</Text>
            <Text style={styles.savedTitle}>{topicLabel}</Text>
            <Pressable style={styles.primary} onPress={() => router.push({
              pathname: '/life/topic' as any,
              params: {
                topic: saved.topic, lang: saved.language, resume: saved.step,
                ...(saved.topic === 'questions' && saved.questionIndex !== undefined
                  ? { questionIndex: String(saved.questionIndex) } : {}),
              },
            })}>
              <Text style={styles.primaryText}>{fil ? 'Ipagpatuloy' : 'Continue'}</Text>
            </Pressable>
            <Pressable style={styles.clear} onPress={async () => {
              const ok = await clearBuklodLifePrivateProgress(user?.id);
              if (ok) setSaved(null);
            }}>
              <Text style={styles.clearText}>{fil ? 'Alisin ang saved checkpoint' : 'Remove saved checkpoint'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.body}>{fil
            ? 'Wala pang pribadong sinave. Maaari kang pumili ng paksa sa My Life at i-save lamang kung gusto mo.'
            : 'Nothing saved yet. Explore a topic in My Life and save only when you choose.'}</Text>
        )}
      </View>

      <View style={styles.privacy}>
        <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#386348" />
        <Text style={styles.privacyText}>{fil
          ? 'Walang conversion leaderboard, cash, o points para sa spiritual response. Hindi binibilang o iniuulat ang faith choices ng ibang tao.'
          : 'No conversion leaderboards, cash or points for spiritual responses. Other people’s faith choices are never counted or reported.'}</Text>
      </View>
      <Pressable style={styles.share} onPress={() => router.push('/life/share' as any)}>
        <MaterialCommunityIcons name="share-variant-outline" size={19} color="#FFFFFF" />
        <Text style={styles.shareText}>{fil ? 'Ibahagi ang BUKLOD' : 'Share BUKLOD'}</Text>
      </Pressable>
    </ScrollView>
  );
}
export default function BuklodLifeImpactScreen() {
  return <BuklodFaithRouteBoundary><LifeImpactContent/></BuklodFaithRouteBoundary>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF7' },
  back: { flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 44 },
  backText: { color: '#25482F', fontWeight: '800', fontSize: 16 },
  hero: { borderRadius: 23, backgroundColor: '#E3EEE1', padding: 21, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: '#4A7757' },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#203D2B' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#4C6754' },
  treeCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E9DD', borderRadius: 22, padding: 20, alignItems: 'center', gap: 10 },
  treeSymbol: { backgroundColor: '#E9F4E7', borderRadius: 100, height: 148, width: 148, alignItems: 'center', justifyContent: 'center' },
  treeTitle: { color: '#254832', fontSize: 21, fontWeight: '800' },
  treeSub: { color: '#566C5C', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  metric: { marginTop: 12, backgroundColor: '#F0F6EF', paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', borderRadius: 16 },
  metricNumber: { color: '#285C38', fontWeight: '800', fontSize: 30 },
  metricLabel: { color: '#54705C', fontSize: 12 },
  partial: { color: '#667A6A', fontSize: 11, textAlign: 'center', lineHeight: 17 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 1, borderColor: '#E0E9DD', padding: 18, gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: '#244A33', fontSize: 16, fontWeight: '800', flex: 1 },
  body: { color: '#536957', lineHeight: 21, fontSize: 14 },
  savedTitle: { color: '#28573B', fontWeight: '800', fontSize: 17 },
  primary: { padding: 14, backgroundColor: '#2F6946', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  clear: { padding: 10, alignItems: 'center' },
  clearText: { color: '#657568', fontSize: 12 },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 15, borderRadius: 16, backgroundColor: '#ECF4EA' },
  privacyText: { flex: 1, color: '#4D6553', fontSize: 12, lineHeight: 19 },
  share: { backgroundColor: '#2F6946', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48 },
  shareText: { color: '#FFFFFF', fontWeight: '800' },
});
