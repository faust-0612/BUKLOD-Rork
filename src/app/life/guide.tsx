import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import { useBuklodLifeLanguage } from '@/hooks/useBuklodLifeLanguage';
import {
  BUKLOD_LIFE_CONCERNS,
  BUKLOD_LIFE_GOSPEL_MODES,
  type BuklodLifeConcernKey,
} from '@/lib/buklodLifeGuide';

type Mode = keyof typeof BUKLOD_LIFE_GOSPEL_MODES;
const GREEN = '#2F6946';
const DARK = '#20362A';

function GuideContent() {
  const inset = useSafeAreaInsets();
  const lang = useBuklodLifeLanguage();
  const isFil = lang === 'fil';
  const [concernKey, setConcernKey] = useState<BuklodLifeConcernKey>('worry');
  const [allowed, setAllowed] = useState(false);
  const [mode, setMode] = useState<Mode>('short');
  const concern = useMemo(
    () => BUKLOD_LIFE_CONCERNS.find(c => c.key === concernKey) ?? BUKLOD_LIFE_CONCERNS[0],
    [concernKey],
  );

  const selectConcern = (next: BuklodLifeConcernKey) => {
    setConcernKey(next);
    setAllowed(false);
    setMode('short');
  };

  return (
    <ScrollView style={styles.screen}
      contentContainerStyle={[styles.container, {
        paddingTop: Math.max(inset.top, 18),
        paddingBottom: Math.max(inset.bottom, 20) + 28,
      }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"
        accessibilityLabel={isFil ? 'Bumalik' : 'Back'} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={DARK} />
        <Text style={styles.backText}>LIFE</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{isFil ? 'TULUNGAN ANG IBA' : 'HELP SOMEONE'}</Text>
        <Text style={styles.title}>{isFil ? 'Makinig muna. Unawain. Tumulong.' : 'Listen first. Understand. Support.'}</Text>
        <Text style={styles.sub}>{isFil
          ? 'Gabay para sa makatao at magalang na usapan. Walang pamimilit o kailangang ideklara.'
          : 'A human-first guide for respectful conversations. No pressure and no labels.'}</Text>
      </View>

      <Text style={styles.heading}>{isFil ? '1  Ano ang pinagdaraanan niya?' : '1  What are they facing?'}</Text>
      <View style={styles.chips}>
        {BUKLOD_LIFE_CONCERNS.map(item => (
          <Pressable key={item.key} onPress={() => selectConcern(item.key)}
            accessibilityRole="button" accessibilityState={{ selected: concernKey === item.key }}
            style={[styles.chip, concernKey === item.key && styles.chipSelected]}>
            <Text style={[styles.chipText, concernKey === item.key && styles.chipTextSelected]}>
              {item.label[lang]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>{isFil ? '2  Praktikal na suporta muna' : '2  Offer practical support first'}</Text>
      <View style={styles.surface}>
        <Text style={styles.surfaceLabel}>{isFil ? 'PAKINIG AT MAGING PRESENT' : 'LISTEN AND BE PRESENT'}</Text>
        <Text style={styles.body}>{concern.practical[lang]}</Text>
        <Text style={styles.question}>{'“' + concern.question[lang] + '”'}</Text>
        <Text style={styles.muted}>{isFil
          ? 'Kung may agarang panganib, abuso, o matinding krisis, unahin ang kaligtasan at angkop na tulong. Hindi kapalit ng professional care ang prayer.'
          : 'If there is immediate danger, abuse, or a severe crisis, prioritize safety and appropriate help. Prayer does not replace professional care.'}</Text>
      </View>

      <Text style={styles.heading}>{isFil ? '3  Magpaalam bago magbahagi' : '3  Ask permission before sharing'}</Text>
      <View style={styles.surface}>
        <Text style={styles.question}>{'“' + concern.bridge[lang] + '”'}</Text>
        <Text style={styles.muted}>{isFil
          ? 'Kung hindi siya interesado, igalang iyon. Hindi kailangang sumagot o ipagtanggol ang kanyang paniniwala.'
          : 'If they decline, respect it. Nobody has to justify their belief or decision.'}</Text>
        {!allowed ? (
          <Pressable style={styles.primary} onPress={() => setAllowed(true)}
            accessibilityRole="button">
            <Text style={styles.primaryText}>{isFil ? 'Pumayag siyang makinig' : 'They are willing to listen'}</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <>
            <Text style={styles.surfaceLabel}>{isFil ? 'PILIIN ANG HABA' : 'CHOOSE THE LENGTH'}</Text>
            <View style={styles.modes}>
              {(['short', 'three', 'full'] as const).map(value => (
                <Pressable key={value} style={[styles.mode, mode === value && styles.modeActive]}
                  onPress={() => setMode(value)} accessibilityRole="button"
                  accessibilityState={{ selected: mode === value }}>
                  <Text style={[styles.modeLabel, mode === value && styles.modeLabelActive]}>
                    {value === 'short' ? (isFil ? 'Maikli' : 'Short') : value === 'three' ? '3 min' : (isFil ? 'Buong usapan' : 'Full')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.gospel}>
              <Text style={styles.surfaceLabel}>{isFil ? 'CHRISTIAN GOSPEL • MALINAW AT OPSYONAL' : 'CHRISTIAN GOSPEL • CLEAR AND OPTIONAL'}</Text>
              <Text style={styles.body}>{BUKLOD_LIFE_GOSPEL_MODES[mode][lang]}</Text>
            </View>
            <Pressable style={styles.secondary} onPress={() => router.push({
              pathname: '/life/topic' as any, params: { topic: 'jesus', lang },
            })}>
              <Text style={styles.secondaryText}>{isFil ? 'Basahin ang buong Gospel' : 'Explore the full Gospel'}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{isFil
          ? 'Hindi mo dapat markahan ang ibang tao bilang “saved” o “converted.” Walang points, cash o leaderboard para sa spiritual response.'
          : 'Never label someone else “saved” or “converted.” There are no points, cash rewards or leaderboards for spiritual responses.'}</Text>
        <Pressable onPress={() => router.push('/life/share' as any)} style={styles.link}>
          <Text style={styles.linkText}>{isFil ? 'Opsyonal na Share BUKLOD' : 'Optional Share BUKLOD'}</Text>
          <MaterialCommunityIcons name="arrow-top-right" size={18} color={GREEN}/>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function BuklodLifeGuideScreen() {
  return <BuklodFaithRouteBoundary><GuideContent /></BuklodFaithRouteBoundary>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAF7' },
  container: { paddingHorizontal: 18, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  backText: { color: DARK, fontSize: 16, fontWeight: '700' },
  hero: { backgroundColor: '#E5F0E4', borderRadius: 22, padding: 21, gap: 10, marginBottom: 8 },
  eyebrow: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: DARK, fontSize: 27, lineHeight: 34, fontWeight: '800' },
  sub: { color: '#4D6453', fontSize: 14, lineHeight: 21 },
  heading: { color: DARK, fontSize: 17, fontWeight: '800', marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FFFFFF', borderColor: '#DAE5D9', borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, minHeight: 42 },
  chipSelected: { borderColor: GREEN, backgroundColor: '#E0F0E2' },
  chipText: { fontSize: 13, color: '#405448', fontWeight: '600' },
  chipTextSelected: { color: DARK, fontWeight: '800' },
  surface: { padding: 17, backgroundColor: '#FFFFFF', borderColor: '#E0E8DF', borderWidth: 1, borderRadius: 18, gap: 14 },
  surfaceLabel: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  body: { color: DARK, fontSize: 15, lineHeight: 24 },
  question: { fontSize: 17, lineHeight: 25, color: '#254B32', fontWeight: '700' },
  muted: { fontSize: 12, lineHeight: 19, color: '#5E7063' },
  primary: { backgroundColor: GREEN, borderRadius: 14, minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { backgroundColor: '#ECF2EC', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, flex: 1, alignItems: 'center', justifyContent: 'center' },
  modeActive: { backgroundColor: GREEN },
  modeLabel: { color: '#4B6552', fontSize: 12, fontWeight: '700' },
  modeLabelActive: { color: '#FFFFFF' },
  gospel: { backgroundColor: '#F2F7F0', borderRadius: 13, padding: 15, gap: 12 },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: '#BFD5C1', paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontWeight: '800', color: GREEN },
  footer: { marginTop: 18, gap: 16, paddingBottom: 18 },
  footerText: { color: '#5A6E60', fontSize: 12, lineHeight: 19 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontWeight: '700', fontSize: 14, color: GREEN },
});
