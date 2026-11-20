import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodLifeLanguage } from '@/hooks/useBuklodLifeLanguage';
import { BUKLOD_LIFE_CONCERNS } from '@/lib/buklodLifeGuide';

export default function BuklodLifeSupportScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ concern?: string }>();
  const { activeScope } = useBuklodScope();
  const lang = useBuklodLifeLanguage();
  const isFil = lang === 'fil';
  const topic = useMemo(() =>
    BUKLOD_LIFE_CONCERNS.find(item => item.key === params.concern) ??
    BUKLOD_LIFE_CONCERNS[0], [params.concern]);
  const [requested, setRequested] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{
      paddingHorizontal: 18, paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 20) + 32, gap: 16,
    }}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <MaterialCommunityIcons name="arrow-left" size={23} color="#284735" />
        <Text style={styles.backText}>LIFE</Text>
      </Pressable>
      <View style={styles.hero}>
        <Text style={styles.overline}>{isFil ? 'PARA SA IYO' : 'FOR YOU'}</Text>
        <Text style={styles.title}>{topic.label[lang]}</Text>
        <Text style={styles.intro}>{isFil
          ? 'Magsimula sa isang bagay na makatutulong ngayon. Ikaw ang may kontrol sa susunod na hakbang.'
          : 'Start with something that can help today. You choose what comes next.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isFil ? 'Isang makabuluhang hakbang' : 'One meaningful step'}</Text>
        <Text style={styles.body}>{topic.practical[lang]}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isFil ? 'Tanong na puwedeng pag-isipan' : 'A question to consider'}</Text>
        <Text style={styles.question}>{topic.question[lang]}</Text>
      </View>
      <Text style={styles.safety}>{isFil
        ? 'Kung may agarang panganib, pananakit o krisis, unahin ang kaligtasan at kumontak sa lokal na emergency services o pinagkakatiwalaang taong makatutulong.'
        : 'If someone faces immediate danger, violence or a crisis, prioritize safety and contact local emergency services or a trusted person who can help.'}</Text>

      {Boolean(activeScope?.show_faith_content) && (
        <View style={styles.bridge}>
          <Text style={styles.bridgeTitle}>{isFil ? 'May isa pang pananaw, kung interesado ka' : 'Another perspective, if you are interested'}</Text>
          <Text style={styles.bridgeBody}>{isFil
            ? 'May mga taong nakakakita ng mas malalim na pag-asa sa Christian Gospel. Maaari mong tingnan ito nang walang pressure.'
            : 'Some people find deeper hope in the Christian Gospel. You can explore that perspective with no pressure.'}</Text>
          {!requested ? (
            <Pressable style={styles.primary} onPress={() => setRequested(true)} accessibilityRole="button">
              <Text style={styles.primaryText}>{isFil ? 'Gusto kong malaman pa' : 'I would like to know more'}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.bridgeBody}>{isFil
                ? 'Sa pananampalatayang Christian, si Jesus ang sentro ng mensahe ng pag-ibig, kapatawaran at bagong buhay. Maaari kang magtanong bago magpasya.'
                : 'In Christian faith, Jesus is central to the message of love, forgiveness and new life. Questions are welcome before any decision.'}</Text>
              <Pressable style={styles.primary} onPress={() => router.push({
                pathname: '/life/topic' as any, params: { topic: 'jesus', lang },
              })}>
                <Text style={styles.primaryText}>{isFil ? 'Kilalanin si Jesus' : 'Explore Jesus'}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      <Pressable style={styles.later} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.laterText}>{isFil ? 'Hindi muna • Bumalik' : 'Not now • Go back'}</Text>
      </Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF7' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { color: '#284735', fontWeight: '800', fontSize: 16 },
  hero: { padding: 20, backgroundColor: '#E5F0E5', borderRadius: 22, gap: 12 },
  overline: { color: '#4B7656', fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  title: { color: '#203C2B', fontWeight: '800', fontSize: 27, lineHeight: 34 },
  intro: { color: '#4C6552', lineHeight: 22, fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', padding: 19, borderRadius: 18, gap: 10, borderColor: '#E0E8E1', borderWidth: 1 },
  cardTitle: { color: '#345F41', fontWeight: '800', fontSize: 14 },
  body: { color: '#233F2E', fontSize: 16, lineHeight: 25 },
  question: { color: '#294D35', fontWeight: '600', fontSize: 17, lineHeight: 25 },
  safety: { color: '#677567', fontSize: 12, lineHeight: 19, paddingHorizontal: 3 },
  bridge: { backgroundColor: '#F1F5EF', borderRadius: 18, padding: 18, gap: 13, borderColor: '#D7E6D8', borderWidth: 1 },
  bridgeTitle: { color: '#234631', fontWeight: '800', fontSize: 17 },
  bridgeBody: { color: '#4F6154', fontSize: 14, lineHeight: 22 },
  primary: { backgroundColor: '#2F6946', borderRadius: 13, padding: 15, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  later: { padding: 15, alignItems: 'center' },
  laterText: { color: '#52685A', fontSize: 14, fontWeight: '700' },
});
