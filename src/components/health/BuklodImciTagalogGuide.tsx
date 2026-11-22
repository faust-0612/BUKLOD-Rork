import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getImciOutcome, getImciQuestions, IMCI_AGE_OPTIONS,
  IMCI_PHL_REFERENCE, IMCI_WHO_REFERENCE,
  type ImciAge, type ImciAnswer,
} from '@/lib/buklodImciTagalog';

type Props = { onUrgencyChange: (urgent: boolean) => void };
const CHOICES: { id: ImciAnswer; label: string }[] = [
  { id: 'yes', label: 'Oo' },
  { id: 'no', label: 'Hindi' },
  { id: 'unsure', label: 'Hindi sigurado' },
];

/** Privacy-first, caregiver-facing educational guide; nothing is persisted or sent. */
export default function BuklodImciTagalogGuide({ onUrgencyChange }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [age, setAge] = useState<ImciAge>('child');
  const [answers, setAnswers] = useState<Record<string, ImciAnswer>>({});
  const [index, setIndex] = useState(0);
  const questions = getImciQuestions(age);
  const current = questions[index];
  const finished = index >= questions.length;
  const outcome = getImciOutcome(age, answers);
  const emergency = outcome === 'emergency';
  const answered = questions.filter(q => answers[q.id] !== undefined);
  const handoff = questions.filter(q => answers[q.id] === 'yes' || answers[q.id] === 'unsure');

  useEffect(() => { onUrgencyChange(emergency); }, [emergency, onUrgencyChange]);

  const chooseAge = (nextAge: ImciAge) => {
    setAge(nextAge);
    setAnswers({});
    setIndex(0);
  };
  const reset = () => { setAnswers({}); setIndex(0); };
  const choose = (value: ImciAnswer) => {
    if (!current) return;
    setAnswers(previous => ({ ...previous, [current.id]: value }));
  };

  return (
    <View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityLabel="Buksan o isara ang gabay ng IMCI" onPress={() => setExpanded(value => !value)} style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.eyebrow}>GABAY SA KALUSUGAN NG BATA</Text>
          <Text style={styles.title}>IMCI — Gabay sa Tagalog</Text>
          <Text style={styles.muted}>Isa-isang tanong, ayon sa edad at sintomas</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={25} color="#126946" />
      </Pressable>
      {expanded ? (
        <View style={styles.inner}>
          <Text style={styles.explanation}>
            Para sa magulang o tagapag-alaga. Gabay lamang ito sa mga babalang palatandaan;
            hindi ito diagnosis, reseta, o kapalit ng pagsusuri ng doktor.
          </Text>

          <Text style={styles.subheading}>1. Ilang taon o buwan na ang bata?</Text>
          <View style={styles.ages}>
            {IMCI_AGE_OPTIONS.map(option => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: age === option.id }}
                onPress={() => chooseAge(option.id)}
                style={[styles.ageChip, age === option.id && styles.ageSelected]}
              >
                <Text style={[styles.ageText, age === option.id && styles.ageTextSelected]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>{IMCI_AGE_OPTIONS.find(option => option.id === age)?.subtitle}</Text>
          {age === 'older' ? (
            <Text style={styles.hint}>Ang IMCI na ito ay para sa wala pang 5 taong gulang. Safety check lang ang susunod para sa mas matandang bata; kailangan pa rin ng angkop na pediatric assessment.</Text>
          ) : null}

          <View style={styles.rule} />
          <View style={styles.progressHeader}>
            <Text style={styles.subheading}>2. Sagutin ang mga tanong</Text>
            <Text style={styles.count}>{answered.length}/{questions.length}</Text>
          </View>
          <View accessibilityLabel={`Nasagutan: ${answered.length} sa ${questions.length}`} style={styles.track}>
            <View style={[styles.progress, { width: `${Math.round(answered.length / questions.length * 100)}%` }]} />
          </View>

          {!finished && current ? (
            <View style={styles.questionCard}>
              <Text style={styles.step}>Tanong {index + 1} sa {questions.length}</Text>
              <Text style={styles.question}>{current.question}</Text>
              <Text style={styles.muted}>{current.explanation}</Text>
              <View style={styles.choices}>
                {CHOICES.map(choice => (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityLabel={choice.label}
                    accessibilityState={{ selected: answers[current.id] === choice.id }}
                    onPress={() => choose(choice.id)}
                    style={[styles.choice, answers[current.id] === choice.id && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceLabel, answers[current.id] === choice.id && styles.choiceLabelSelected]}>{choice.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : !emergency ? (
            <View style={styles.questionCard}>
              <Text style={styles.subheading}>Tapos na ang mga tanong</Text>
              <Text style={styles.muted}>Basahin ang susunod na hakbang sa ibaba. Ang walang napiling danger sign ay hindi patunay na walang sakit.</Text>
            </View>
          ) : null}

          {emergency ? (
            <View accessibilityRole="alert" style={styles.dangerPanel}>
              <Text style={styles.dangerTitle}>Magpatingin agad — posibleng seryosong palatandaan</Text>
              <Text style={styles.dangerText}>
                May sagot na Oo o Hindi sigurado sa isang danger sign. Itigil ang pagsusuri sa app at dalhin ang bata sa pinakamalapit na emergency department o tumawag sa 911 (Pilipinas). Huwag maghintay sa AI o online consultation.
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Tumawag sa 911" onPress={() => { void Linking.openURL('tel:911').catch(() => {}); }} style={styles.callButton}>
                <MaterialCommunityIcons name="phone" color="#FFFFFF" size={18} />
                <Text style={styles.callText}>Tumawag sa 911</Text>
              </Pressable>
              <Text style={styles.dangerText}>Kung walang malay o hindi makalunok, huwag piliting painumin o pakainin. Humingi ng agarang tulong.</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bumalik sa nakaraang tanong"
                disabled={index === 0}
                accessibilityState={{ disabled: index === 0 }}
                style={[styles.secondaryButton, index === 0 && styles.disabled]}
                onPress={() => setIndex(value => Math.max(0, value - 1))}
              ><Text style={styles.secondaryText}>Bumalik</Text></Pressable>
              {!finished ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Susunod na tanong"
                  accessibilityState={{ disabled: answers[current.id] === undefined }}
                  disabled={answers[current.id] === undefined}
                  style={[styles.nextButton, answers[current.id] === undefined && styles.disabled]}
                  onPress={() => setIndex(value => Math.min(questions.length, value + 1))}
                ><Text style={styles.nextText}>Susunod</Text></Pressable>
              ) : (
                <Pressable accessibilityRole="button" onPress={reset} style={styles.nextButton}>
                  <Text style={styles.nextText}>Ulitin ang gabay</Text>
                </Pressable>
              )}
            </View>
          )}

          {(finished || emergency) ? (
            <View style={styles.summary}>
              <Text style={styles.subheading}>3. Susunod na hakbang</Text>
              {emergency ? (
                <Text style={styles.body}>Emergency assessment ang unahin. Ipakita sa health worker ang mga napansing palatandaan sa ibaba.</Text>
              ) : outcome === 'consult' ? (
                <Text style={styles.body}>May alalahaning dapat ipasuri. Makipag-ugnayan sa barangay health center o pediatrician sa lalong madaling panahon, mas mainam ngayong araw. Kung lumala o may danger sign, mag-emergency agad.</Text>
              ) : (
                <Text style={styles.body}>Kung may sintomas o nag-aalala ka pa rin, magpatingin sa health worker. Hindi ginagarantiya ng sagot na ito na ligtas o walang sakit ang bata.</Text>
              )}
              <Text style={styles.handoffTitle}>Mga isasabi sa health worker</Text>
              {handoff.length ? handoff.map(q => (
                <Text key={q.id} style={styles.body}>• {q.question} — {answers[q.id] === 'yes' ? 'Oo' : 'Hindi sigurado'}</Text>
              )) : <Text style={styles.muted}>Walang napiling Oo o Hindi sigurado. Sabihin pa rin kung ano ang ikinababahala mo.</Text>}
              <Text style={styles.muted}>Dalhin ang tala ng bakuna, mga gamot na iniinom, at impormasyon kung kailan nagsimula ang sintomas.</Text>
            </View>
          ) : null}
          {emergency ? (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setIndex(value => Math.max(0, value - 1))}>
                <Text style={styles.secondaryText}>Tingnan ang tanong</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={reset}>
                <Text style={styles.secondaryText}>Simulang muli</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.muted}>
            Walang iniimbak o ipinapadalang sagot. Ang lokal na chart na ginagamit ng lisensiyadong health worker ang dapat sundin para sa pormal na IMCI classification at treatment.
          </Text>
          <View style={styles.referenceRow}>
            <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(IMCI_PHL_REFERENCE).catch(() => {}); }} style={styles.reference}>
              <Text style={styles.link}>Philippine IMCI chart (2015) ↗</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(IMCI_WHO_REFERENCE).catch(() => {}); }} style={styles.reference}>
              <Text style={styles.link}>WHO IMCI ↗</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8DED1', borderRadius: 14, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 55, gap: 8 },
  inner: { gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', color: '#126946' },
  title: { color: '#193F30', fontSize: 19, fontWeight: '900' },
  subheading: { color: '#193F30', fontSize: 16, fontWeight: '800' },
  explanation: { color: '#365642', fontSize: 14, lineHeight: 20 },
  muted: { color: '#567063', fontSize: 13, lineHeight: 19 },
  body: { color: '#264634', fontSize: 14, lineHeight: 21 },
  hint: { backgroundColor: '#FFF8E6', color: '#7A501D', padding: 10, borderRadius: 8, fontSize: 13, lineHeight: 19 },
  ages: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ageChip: { minHeight: 43, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderColor: '#BAD7C5', borderWidth: 1, backgroundColor: '#F4FAF6' },
  ageSelected: { backgroundColor: '#126946', borderColor: '#126946' },
  ageText: { color: '#126946', fontWeight: '700', fontSize: 13 },
  ageTextSelected: { color: '#FFFFFF' },
  rule: { height: 1, backgroundColor: '#E3ECE6' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: '#126946', fontSize: 13, fontWeight: '900' },
  track: { backgroundColor: '#E6EEE8', height: 7, borderRadius: 4, overflow: 'hidden' },
  progress: { backgroundColor: '#126946', height: 7 },
  questionCard: { padding: 12, borderRadius: 11, backgroundColor: '#F4FAF6', gap: 10 },
  step: { fontWeight: '800', color: '#126946', fontSize: 12 },
  question: { color: '#193F30', fontSize: 18, fontWeight: '800', lineHeight: 25 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 48, flexGrow: 1, paddingHorizontal: 9, borderWidth: 1, borderColor: '#BAD7C5', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { backgroundColor: '#126946', borderColor: '#126946' },
  choiceLabel: { color: '#126946', fontSize: 13, fontWeight: '800' },
  choiceLabelSelected: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { minHeight: 46, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#AFCDB9' },
  secondaryText: { color: '#126946', fontWeight: '800' },
  nextButton: { minHeight: 46, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: '#126946' },
  nextText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  dangerPanel: { borderRadius: 11, padding: 12, gap: 10, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#D68080' },
  dangerTitle: { color: '#982222', fontSize: 16, fontWeight: '900' },
  dangerText: { color: '#742323', lineHeight: 20, fontSize: 14 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#9E1B1B', paddingHorizontal: 14, minHeight: 48, borderRadius: 9, alignSelf: 'flex-start' },
  callText: { color: '#FFFFFF', fontWeight: '900' },
  summary: { backgroundColor: '#EDF8F0', borderRadius: 10, padding: 12, gap: 9 },
  handoffTitle: { color: '#193F30', fontSize: 14, fontWeight: '800' },
  referenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reference: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 5 },
  link: { color: '#126946', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
});
