import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import {
  BUKLOD_HEALTH_CENTER_URL,
  BUKLOD_HEALTH_CONSULTATION_URL,
  BUKLOD_HEALTH_CONSULTATION_READY,
  BUKLOD_HEALTH_PROFESSIONALS_READY,
  launchBuklodHealthCenter,
  launchBuklodHealthConsultation,
  launchBuklodHealthProfessionals,
} from '@/lib/buklodHealthCenterLauncher';

type Concern = 'symptoms' | 'medicines' | 'laboratory' | 'wellbeing' | 'general';
type Urgency = 'unanswered' | 'urgent' | 'none';
type Door = 'consult' | 'standalone' | 'professional';

const CONCERNS: { id: Concern; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'symptoms', label: 'Symptoms', icon: 'heart-pulse' },
  { id: 'medicines', label: 'Medicines', icon: 'pill' },
  { id: 'laboratory', label: 'Lab results', icon: 'flask-outline' },
  { id: 'wellbeing', label: 'Mental health', icon: 'head-heart-outline' },
  { id: 'general', label: 'General health', icon: 'medical-bag' },
];

/**
 * Public patient-facing guide. No symptoms, flags, health IDs or BUKLOD auth
 * tokens are written to analytics/storage or attached to outgoing URLs.
 * Actual AI response generation is owned by the standalone Health Center.
 */
export default function BuklodHealthPortal() {
  const [concern, setConcern] = useState<Concern>('general');
  const [language,setLanguage]=useState<'fil'|'en'>('fil');
  const [guideOpen,setGuideOpen]=useState(false);
  const [contributorInfoOpen,setContributorInfoOpen]=useState(false);
  const t=(en:string,fil:string)=>language==='fil'?fil:en;
  const [urgency, setUrgency] = useState<Urgency>('unanswered');
  const [opening, setOpening] = useState<Door | null>(null);
  const [error, setError] = useState(false);
  const openingRef = useRef(false);

  const openDoor = useCallback(async (door: Door) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(door);
    setError(false);
    try {
      if (door === 'standalone') {
        await launchBuklodHealthCenter(url => Linking.openURL(url));
       } else if (door === 'professional' && BUKLOD_HEALTH_PROFESSIONALS_READY) {
        await launchBuklodHealthProfessionals(url => Linking.openURL(url));
      } else if (urgency === 'none' && BUKLOD_HEALTH_CONSULTATION_READY) {
        await launchBuklodHealthConsultation(url => Linking.openURL(url));
      }
    } catch {
      setError(true);
    } finally {
      openingRef.current = false;
      setOpening(null);
    }
  }, [urgency]);

  const urgent = urgency === 'urgent';

  return (
    <>
      <Stack.Screen options={{ title: 'Online Health Consultation' }} />
      <BuklodPortalScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroHeading}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="stethoscope" size={30} color="#126946" />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>BUKLOD HEALTH CENTER</Text>
              <Text style={styles.title}>{t('Online Consultation','Konsultasyong Pangkalusugan')}</Text>
            </View>
          </View>
          <View style={styles.choiceRow}>
            <Pressable accessibilityRole="button" onPress={()=>setLanguage('fil')} style={[styles.chip,language==='fil'&&styles.selectedChip]}><Text style={[styles.chipText,language==='fil'&&styles.selectedChipText]}>Filipino</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setLanguage('en')} style={[styles.chip,language==='en'&&styles.selectedChip]}><Text style={[styles.chipText,language==='en'&&styles.selectedChipText]}>English</Text></Pressable>
          </View>
          <Text style={styles.description}>{t('Start with a safety check, then use the BUKLOD Health Guide for general educational information. It is not a doctor, diagnosis or prescription.','Magsimula sa pagsusuri ng babalang sintomas bago gamitin ang BUKLOD Health Guide para sa pangkalahatang kaalaman. Hindi ito doktor, diagnosis o reseta.')}</Text>
        </View>

        <View style={styles.guideCard}>
          <Text style={styles.sectionHeading}>{t('1. What can we help with?','1. Ano ang kailangan mong malaman?')}</Text>
          <Text style={styles.hint}>Select a topic. Your selection stays on this screen and is not sent to BUKLOD or the Health Center.</Text>
          <View style={styles.chips}>
            {CONCERNS.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: concern === item.id }}
                onPress={() => setConcern(item.id)}
                style={({ pressed }) => [
                  styles.chip, concern === item.id && styles.selectedChip, pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons name={item.icon} size={17} color={concern === item.id ? '#FFFFFF' : '#245F48'} />
                <Text style={[styles.chipText, concern === item.id && styles.selectedChipText]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.guideCard}>
          <Text style={styles.sectionHeading}>{t('2. Check for urgent warning signs','2. Suriin ang mga babalang sintomas')}</Text>
          <Text style={styles.body}>
            Are you experiencing severe chest pain, difficulty breathing, possible stroke symptoms,
            uncontrolled bleeding, loss of consciousness, or an immediate risk of self-harm?
          </Text>
          <View style={styles.choiceRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yes or unsure, I may have an urgent warning sign"
              accessibilityState={{ selected: urgent }}
              onPress={() => setUrgency('urgent')}
              style={({ pressed }) => [styles.warningChoice, urgent && styles.warningChoiceSelected, pressed && styles.pressed]}
            >
              <Text style={styles.warningChoiceText}>Yes / unsure</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="No, none of these urgent warning signs"
              accessibilityState={{ selected: urgency === 'none' }}
              onPress={() => setUrgency('none')}
              style={({ pressed }) => [styles.clearChoice, urgency === 'none' && styles.clearChoiceSelected, pressed && styles.pressed]}
            >
              <Text style={styles.clearChoiceText}>None of these</Text>
            </Pressable>
          </View>
          {urgent ? (
            <View accessibilityRole="alert" style={styles.urgentPanel}>
              <MaterialCommunityIcons name="alert-circle" size={23} color="#9E1B1B" />
              <View style={styles.urgentBody}>
                <Text style={styles.urgentTitle}>Seek immediate medical help</Text>
                <Text style={styles.urgentText}>
                  Do not wait for an AI response. Call emergency services or go to the nearest emergency department.
                  In the Philippines, you can dial 911.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call emergency services 911"
                  onPress={() => { void Linking.openURL('tel:911').catch(() => setError(true)); }}
                  style={styles.emergencyCall}
                >
                  <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                  <Text style={styles.emergencyCallText}>Call 911 (PH)</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {!urgent ? (
          <View style={styles.guideCard}>
            <Text style={styles.sectionHeading}>{t('3. BUKLOD Health Guide','3. BUKLOD Health Guide')}</Text>
            <Text style={styles.body}>
              {t('General education only. Automated tools may be used and can make errors. Private interactive consultation requires separate consent.','Pangkalahatang kaalaman lamang. Maaaring gumamit ng automated na tulong na maaaring magkamali. May hiwalay na pahintulot para sa pribadong konsultasyon.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to BUKLOD Health Guide"
              accessibilityState={{ disabled: urgency !== 'none' || opening !== null, busy: opening === 'consult' }}
              disabled={urgency !== 'none' || opening !== null}
              onPress={() => { if(BUKLOD_HEALTH_CONSULTATION_READY){void openDoor('consult')}else{setGuideOpen(true)} }}
              style={({ pressed }) => [
                styles.primaryButton,
                (urgency !== 'none' || opening !== null) && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              {opening === 'consult' ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="message-text" size={20} color="#FFFFFF" />}
              <Text style={styles.primaryButtonText}>
                {opening === 'consult' ? t('Opening secure guide…','Binubuksan…') : t('OPEN BUKLOD HEALTH GUIDE','BUKSAN ANG HEALTH GUIDE')}
              </Text>
            </Pressable>
            {urgency === 'unanswered' ? (
              <Text style={styles.hint}>First confirm whether you have urgent warning signs.</Text>
            ) : null}
            {guideOpen && urgency==='none'?<View style={styles.notice}>
              <Text style={styles.sectionHeading}>{t('Health information','Impormasyong pangkalusugan')}</Text>
              <Text style={styles.body}>{concern==='symptoms'?t('Record when symptoms started, their severity, medicines and any changes. Seek clinical assessment if symptoms worsen or persist.','Itala ang simula, tindi, gamot at pagbabago ng sintomas. Magpatingin kung lumalala o nagtatagal.')
                :concern==='medicines'?t('Check medicine name, strength, instructions and allergies. Ask a clinician or pharmacist before changing prescribed medicines.','Suriin ang pangalan, lakas, panuto at allergy. Kumonsulta sa doktor o parmasyutiko bago baguhin ang reseta.')
                :concern==='laboratory'?t('Lab results require reference ranges and clinical context. Discuss critical or abnormal findings with a licensed clinician.','Kailangang isaalang-alang ang reference ranges at kalagayan ng pasyente. Ipakonsulta ang abnormal o kritikal na resulta.')
                :concern==='wellbeing'?t('Seek professional mental health support; immediate risk of harm requires emergency help.','Humingi ng tulong sa mental health professional; sa agarang panganib, humingi ng emergency help.')
                :t('Prepare symptoms, past conditions, current medicines and allergies before a healthcare consultation.','Ihanda ang sintomas, nakaraang sakit, gamot at allergy bago magpakonsulta.')}</Text>
              {!BUKLOD_HEALTH_CONSULTATION_READY?<Text style={styles.hint}>{t('Private interactive consultation is not yet active; this local guide is available.','Hindi pa aktibo ang pribadong interactive consultation; available ang gabay na ito.')}</Text>:null}
            </View>:null}
          </View>
        ) : null}

        <View style={styles.standaloneCard}>
          <View style={styles.standaloneHeading}>
            <MaterialCommunityIcons name="hospital-building" size={27} color="#126946" />
            <View style={styles.standaloneText}>
              <Text style={styles.sectionHeading}>Full Health Center</Text>
              <Text style={styles.hint}>Medicines · vitals · appointments · health records · care plans</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full standalone BUKLOD Health Center"
            accessibilityState={{ busy: opening === 'standalone', disabled: opening !== null }}
            disabled={opening !== null}
            onPress={() => void openDoor('standalone')}
            style={({ pressed }) => [styles.standaloneButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="open-in-new" size={20} color="#126946" />
            <Text style={styles.standaloneButtonText}>Open standalone Health Center</Text>
          </Pressable>
          <Text selectable style={styles.url}>{BUKLOD_HEALTH_CENTER_URL}</Text>
        </View>

        {!urgent ? (
          <View style={styles.professionalCard}>
            <MaterialCommunityIcons name="badge-account-outline" size={23} color="#416755" />
            <View style={styles.professionalBody}>
              <Text style={styles.professionalTitle}>Licensed health professional?</Text>
              <Text style={styles.hint}>
                Learn about educational contributions. License verification, independent review and privacy controls are required before participation.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open health professional contributor program"
                disabled={opening !== null}
                accessibilityState={{ disabled: opening !== null }}
                onPress={() => { if(BUKLOD_HEALTH_PROFESSIONALS_READY){void openDoor('professional')}else{setContributorInfoOpen(v=>!v)} }}
                style={styles.professionalLink}
              >
                <Text style={styles.professionalLinkText}>{t('Contributor requirements','Mga kinakailangan sa pag-aambag')}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#126946" />
              </Pressable>
              {contributorInfoOpen?<Text style={styles.hint}>{t('License verification, independent clinical review and privacy safeguards are required. Enrollment is not yet open; do not submit license or personal details here.','Kailangan ang beripikasyon ng lisensiya, pagsusuring medikal at proteksiyon sa privacy. Hindi pa bukas ang rehistrasyon; huwag magsumite ng personal na detalye rito.')}</Text>:null}
            </View>
          </View>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Could not open the requested link. Check your connection, or open the standalone website directly.
            Private consultation and professional registration may not yet be activated.
          </Text>
        ) : null}

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-lock-outline" size={21} color="#126946" />
          <Text style={styles.noticeText}>
            Privacy: This screen does not save your answers or share BUKLOD login tokens, concerns or medical records.
            The full Health Center has separate access controls.
          </Text>
        </View>

        {urgency === 'none' ? (
          <View style={styles.adPlacement} accessibilityLabel="Advertisement placement">
            <BuklodAdMobBanner
              placement="focus"
              placementId="health_consultation_safe_info_banner"
              compact
              format="adaptive"
              requireViewport
              showLabel
            />
          </View>
        ) : null}
        {urgency === 'none' ? (
          <Text style={styles.adNote}>
            Advertisement is separate from health guidance and does not determine recommendations or emergency access.
          </Text>
        ) : null}
        {BUKLOD_HEALTH_CONSULTATION_READY?<Text selectable style={styles.assistiveUrl}>Guide URL: {BUKLOD_HEALTH_CONSULTATION_URL}</Text>:null}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6FAF7' },
  content: { paddingHorizontal: 13, paddingTop: 14, paddingBottom: 28, gap: 12 },
  hero: { borderRadius: 15, backgroundColor: '#E4F3E9', padding: 16, gap: 9 },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconCircle: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  heroText: { flex: 1 },
  eyebrow: { color: '#126946', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  title: { color: '#173D2C', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  description: { color: '#315742', fontSize: 15, lineHeight: 22 },
  guideCard: { padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E0', borderRadius: 13, gap: 10 },
  sectionHeading: { color: '#193F30', fontSize: 16, fontWeight: '800' },
  hint: { color: '#4F6B5C', fontSize: 13, lineHeight: 19 },
  body: { color: '#385744', fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderColor: '#C8DED1', borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3FAF5' },
  selectedChip: { backgroundColor: '#126946', borderColor: '#126946' },
  chipText: { color: '#245F48', fontWeight: '700', fontSize: 13 },
  selectedChipText: { color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
  choiceRow: { flexDirection: 'row', gap: 9 },
  warningChoice: { flex: 1, borderWidth: 1, borderColor: '#E5BBBB', borderRadius: 10, minHeight: 45, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2F2' },
  warningChoiceSelected: { borderWidth: 2, borderColor: '#C62D2D', backgroundColor: '#FFE7E7' },
  warningChoiceText: { fontSize: 14, fontWeight: '800', color: '#A12121' },
  clearChoice: { flex: 1, borderWidth: 1, borderColor: '#A7D1B7', borderRadius: 10, minHeight: 45, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEFAF1' },
  clearChoiceSelected: { borderWidth: 2, borderColor: '#126946', backgroundColor: '#DDF3E4' },
  clearChoiceText: { fontSize: 14, fontWeight: '800', color: '#126946' },
  urgentPanel: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#DA7777', padding: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  urgentBody: { flex: 1, gap: 8 },
  urgentTitle: { color: '#982222', fontSize: 16, fontWeight: '900' },
  urgentText: { color: '#792A2A', fontSize: 14, lineHeight: 21 },
  emergencyCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#9E1B1B', paddingHorizontal: 13, paddingVertical: 12, borderRadius: 9, gap: 8, alignSelf: 'flex-start' },
  emergencyCallText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  primaryButton: { borderRadius: 10, backgroundColor: '#126946', paddingVertical: 15, paddingHorizontal: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabledButton: { backgroundColor: '#849A8D' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  standaloneCard: { padding: 14, borderRadius: 13, backgroundColor: '#EAF4ED', gap: 10 },
  standaloneHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  standaloneText: { flex: 1, gap: 3 },
  standaloneButton: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#8BC4A2', minHeight: 50, padding: 11, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 9 },
  standaloneButtonText: { color: '#126946', fontSize: 15, fontWeight: '800', flexShrink: 1 },
  url: { color: '#246349', fontSize: 12, textDecorationLine: 'underline' },
  professionalCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 12, borderColor: '#DCE9E0', borderWidth: 1, padding: 13, gap: 10 },
  professionalBody: { flex: 1, gap: 5 },
  professionalTitle: { fontWeight: '800', color: '#193F30', fontSize: 15 },
  professionalLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
  professionalLinkText: { fontSize: 14, fontWeight: '800', color: '#126946' },
  notice: { backgroundColor: '#F0F6F2', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noticeText: { color: '#3B584A', fontSize: 13, lineHeight: 19, flex: 1 },
  error: { color: '#AF2626', fontSize: 14, lineHeight: 20 },
  adPlacement: { marginTop: 10, alignSelf: 'stretch', alignItems: 'center', minHeight: 1 },
  adNote: { color: '#677C6C', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  assistiveUrl: { color: '#5F7467', fontSize: 11 },
});
