import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AJA_BANDS, AJA_QUESTIONS, AJA_REFERENCE, WHO_ADOLESCENT_REFERENCE,
  ajaDisposition, ajaHandoffTopics, type AjaAnswer, type AjaBand,
} from '@/lib/buklodAjaTagalog';

type Props = { onUrgencyChange: (urgent: boolean) => void };
const CHOICES: { id: AjaAnswer; label: string }[] = [
  { id: 'yes', label: 'Oo' },
  { id: 'no', label: 'Hindi' },
  { id: 'unsure', label: 'Hindi sigurado' },
  { id: 'skip', label: 'Ayokong sagutin' },
];

/** Consent-first AJA-inspired adolescent guide: entirely ephemeral, no network. */
export default function BuklodAjaTagalogGuide({ onUrgencyChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [age, setAge] = useState<AjaBand | null>(null);
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AjaAnswer>>({});
  const [index, setIndex] = useState(0);
  const question = AJA_QUESTIONS[index];
  const finished = index >= AJA_QUESTIONS.length;
  const outcome = ajaDisposition(answers);
  const emergency = outcome === 'emergency';
  const firstDangerIndex = AJA_QUESTIONS.findIndex(q => q.severity === 'danger' && (answers[q.id] === 'yes' || answers[q.id] === 'unsure'));
  const topics = ajaHandoffTopics(answers);
  useEffect(() => { onUrgencyChange(emergency); }, [emergency, onUrgencyChange]);

  const clear = () => { setAge(null); setConsent(false); setAnswers({}); setIndex(0); };
  const editDanger = () => {
    if (firstDangerIndex < 0) return;
    const id = AJA_QUESTIONS[firstDangerIndex].id;
    setAnswers(previous => { const next = { ...previous }; delete next[id]; return next; });
    setIndex(firstDangerIndex);
  };
  return (
    <View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityLabel="Buksan o isara ang AJA 2.0 adolescent guide"
        onPress={() => setExpanded(value => emergency ? true : !value)}
        style={styles.header}>
        <View style={styles.fill}>
          <Text style={styles.eyebrow}>KALUSUGAN NG KABATAAN · 10–19</Text>
          <Text style={styles.title}>AJA 2.0 — Gabay sa Tagalog</Text>
          <Text style={styles.muted}>Pribadong gabay sa HEEADSSS, mental health at kaligtasan</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} color="#126946" size={25} />
      </Pressable>
      {expanded ? <View style={styles.content}>
        <Text style={styles.body}>Adolescent Job Aid 2.0–inspired self-guide lamang; hindi opisyal na clinical AJA, diagnosis, o reseta. Walang awtomatikong SOS o medical referral.</Text>
        <Text style={styles.muted}>Pribadong sagot: nasa screen memory lamang; walang iniimbak, ina-upload o ipinapadala sa BUKLOD. Maaaring may sensitibong tanong. Siguraduhing ligtas ang paligid mo.</Text>
        <Text style={styles.subheading}>1. Edad ng adolescent</Text>
        <View style={styles.rowWrap}>{AJA_BANDS.map(item => <Pressable key={item.id} accessibilityRole="button"
          accessibilityState={{ selected: age === item.id }} onPress={() => { setAge(item.id); setConsent(false); setAnswers({}); setIndex(0); }}
          style={[styles.chip, age === item.id && styles.chipSelected]}>
          <Text style={[styles.chipText, age === item.id && styles.chipTextSelected]}>{item.label}</Text>
        </Pressable>)}</View>
        {age ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }}
          onPress={() => { setConsent(v => !v); setAnswers({}); setIndex(0); }}
          style={styles.check}>
          <MaterialCommunityIcons name={consent ? 'checkbox-marked' : 'checkbox-blank-outline'} size={25} color="#126946" />
          <Text style={styles.body}>Nauunawaan ko ang privacy at nais kong gamitin ang optional, lokal na gabay. Maaari akong tumigil anumang oras. May legal na limitasyon ang confidentiality ng professionals.</Text>
        </Pressable> : null}
        {age && consent ? <>
          <View style={styles.progressHeader}>
            <Text style={styles.subheading}>2. Mga tanong</Text>
            <Text style={styles.count}>{Object.keys(answers).length}/{AJA_QUESTIONS.length}</Text>
          </View>
          <View style={styles.track}><View style={[styles.progress, { width: `${Math.round(Object.keys(answers).length / AJA_QUESTIONS.length * 100)}%` }]} /></View>
          {!finished && question && !emergency ? <View style={styles.questionCard}>
            <Text style={styles.eyebrow}>{question.section} · Tanong {index + 1} sa {AJA_QUESTIONS.length}</Text>
            <Text style={styles.question}>{question.prompt}</Text>
            <Text style={styles.muted}>{question.note}</Text>
            <View style={styles.rowWrap}>
              {CHOICES.filter(choice => question.severity !== 'danger' || choice.id !== 'skip').map(choice =>
                <Pressable key={choice.id} accessibilityRole="button" accessibilityLabel={choice.label}
                  accessibilityState={{ selected: answers[question.id] === choice.id }}
                  onPress={() => setAnswers(previous => ({ ...previous, [question.id]: choice.id }))}
                  style={[styles.choice, answers[question.id] === choice.id && styles.chipSelected]}>
                  <Text style={[styles.chipText, answers[question.id] === choice.id && styles.chipTextSelected]}>{choice.label}</Text>
                </Pressable>)}
            </View>
          </View> : null}
          {emergency ? <View accessibilityRole="alert" style={styles.danger}>
            <Text style={styles.dangerTitle}>Posibleng agarang panganib — humingi ng tulong</Text>
            <Text style={styles.dangerText}>Itigil muna ang questionnaire. Kung ligtas na gawin, lumapit sa mapagkakatiwalaang tao at magtungo sa emergency department o tumawag sa 911 (Pilipinas). Hindi kusang nagpapadala ng alert ang app.</Text>
            <Pressable accessibilityRole="button" style={styles.call} onPress={() => { void Linking.openURL('tel:911').catch(() => {}); }}>
              <Text style={styles.callText}>Tumawag sa 911</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={editDanger}><Text style={styles.secondaryText}>Baguhin ang sagot sa danger sign</Text></Pressable>
          </View> : <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={index === 0} style={[styles.secondary, index === 0 && styles.disabled]}
              onPress={() => setIndex(value => Math.max(0, value - 1))}><Text style={styles.secondaryText}>Bumalik</Text></Pressable>
            {finished ? <Pressable accessibilityRole="button" style={styles.primary} onPress={clear}><Text style={styles.primaryText}>Burahin at ulitin</Text></Pressable>
              : <Pressable accessibilityRole="button" disabled={!answers[question.id]} style={[styles.primary, !answers[question.id] && styles.disabled]}
                onPress={() => setIndex(v => Math.min(AJA_QUESTIONS.length, v + 1))}><Text style={styles.primaryText}>Susunod</Text></Pressable>}
          </View>}
          {finished || emergency ? <View style={styles.summary}>
            <Text style={styles.subheading}>3. Susunod na hakbang</Text>
            <Text style={styles.body}>{emergency ? 'Emergency services at personal na kaligtasan ang unahin.' :
              outcome === 'consult' ? 'May alalahaning nararapat pag-usapan sa adolescent-friendly health worker, doktor o counselor sa lalong madaling panahon.' :
              'Walang napiling agarang danger sign, ngunit hindi ito patunay na ligtas o walang kondisyon. Humingi ng tulong kung may alalahanin.'}</Text>
            {topics.length > 0 ? <Text style={styles.body}>Mga paksang maaaring ipag-usap nang pribado sa health professional: {topics.join(', ')}.</Text> : null}
          </View> : null}
          <Pressable accessibilityRole="button" onPress={clear} style={styles.secondary}><Text style={styles.secondaryText}>Burahin ang mga sagot</Text></Pressable>
        </> : <Text style={styles.muted}>Piliin ang edad at pumayag muna bago magsimula. Para lamang sa edad 10–19.</Text>}
        <View style={styles.rowWrap}>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(AJA_REFERENCE).catch(() => {}); }} style={styles.reference}><Text style={styles.link}>DOH AJA 2.0 reference ↗</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(WHO_ADOLESCENT_REFERENCE).catch(() => {}); }} style={styles.reference}><Text style={styles.link}>WHO Adolescent Job Aid ↗</Text></Pressable>
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8DED1', borderRadius: 14, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 53 },
  fill: { flex: 1, gap: 3 },
  eyebrow: { color: '#126946', fontSize: 11, fontWeight: '900' },
  title: { color: '#193F30', fontSize: 18, fontWeight: '900' },
  muted: { color: '#567063', fontSize: 13, lineHeight: 18 },
  body: { color: '#264634', fontSize: 14, lineHeight: 21, flexShrink: 1 },
  subheading: { color: '#193F30', fontSize: 15, fontWeight: '800' },
  content: { gap: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 10, borderWidth: 1, borderColor: '#BED7C7', paddingHorizontal: 10, paddingVertical: 11, minHeight: 43 },
  chipSelected: { backgroundColor: '#126946', borderColor: '#126946' },
  chipText: { color: '#126946', fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#FFFFFF' },
  check: { flexDirection: 'row', alignItems: 'flex-start', padding: 11, borderRadius: 9, backgroundColor: '#F0F8F3', gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: '#126946', fontSize: 12, fontWeight: '900' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#E6EEE8', overflow: 'hidden' },
  progress: { height: 7, backgroundColor: '#126946' },
  questionCard: { backgroundColor: '#F4FAF6', borderRadius: 11, padding: 12, gap: 10 },
  question: { color: '#193F30', fontSize: 18, fontWeight: '800', lineHeight: 26 },
  choice: { borderRadius: 9, borderColor: '#BED7C7', borderWidth: 1, minHeight: 45, flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: { borderRadius: 9, borderWidth: 1, borderColor: '#AFCDB9', paddingHorizontal: 11, paddingVertical: 12, minHeight: 46, flex: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#126946', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  primary: { backgroundColor: '#126946', borderRadius: 9, minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  danger: { gap: 10, backgroundColor: '#FFF0F0', borderRadius: 11, padding: 12, borderWidth: 1, borderColor: '#D68080' },
  dangerTitle: { color: '#982222', fontSize: 16, fontWeight: '900' },
  dangerText: { color: '#742323', fontSize: 14, lineHeight: 21 },
  call: { borderRadius: 9, backgroundColor: '#9E1B1B', paddingHorizontal: 16, paddingVertical: 13, alignSelf: 'flex-start' },
  callText: { color: '#FFFFFF', fontWeight: '900' },
  summary: { backgroundColor: '#EDF8F0', borderRadius: 10, padding: 12, gap: 8 },
  reference: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  link: { color: '#126946', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
});