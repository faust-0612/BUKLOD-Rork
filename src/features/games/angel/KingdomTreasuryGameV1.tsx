import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type FundKey = 'relief' | 'infrastructure' | 'learning' | 'mission' | 'reserve';
type Phase = 'planning' | 'event' | 'response' | 'result';

type Allocation = Record<FundKey, number>;
type KingdomHealth = { welfare: number; stability: number; growth: number; trust: number };
type Emergency = {
  id: string;
  title: string;
  titleTl: string;
  description: string;
  descriptionTl: string;
  severity: 1 | 2 | 3;
  primary: FundKey;
  secondary: FundKey;
  minimumResponse: number;
};

const GAME_ID = 'angel-kingdom-treasury';
const STARTING_TREASURY = 1000;
const STEP = 50;

const FUND_META: Record<FundKey, { label: string; labelTl: string; purpose: string; purposeTl: string; accent: string }> = {
  relief: {
    label: 'People & Relief',
    labelTl: 'Tao at Tulong',
    purpose: 'Food, emergency help, vulnerable families',
    purposeTl: 'Pagkain, agarang tulong, at mga pamilyang nangangailangan',
    accent: '#d98469',
  },
  infrastructure: {
    label: 'Infrastructure',
    labelTl: 'Imprastraktura',
    purpose: 'Roads, repairs, water access, community facilities',
    purposeTl: 'Kalsada, pagkukumpuni, tubig, at pasilidad ng komunidad',
    accent: '#7da6b6',
  },
  learning: {
    label: 'Learning',
    labelTl: 'Pagkatuto',
    purpose: 'Education, formation, youth development',
    purposeTl: 'Edukasyon, formation, at pag-unlad ng kabataan',
    accent: '#b79ad6',
  },
  mission: {
    label: 'Mission & Service',
    labelTl: 'Misyon at Paglilingkod',
    purpose: 'Community outreach, care teams, mission support',
    purposeTl: 'Community outreach, care teams, at suporta sa misyon',
    accent: '#8fb37c',
  },
  reserve: {
    label: 'Emergency Reserve',
    labelTl: 'Emergency Reserve',
    purpose: 'Protection against unexpected kingdom-wide shocks',
    purposeTl: 'Proteksiyon laban sa biglaang pangangailangan ng buong kaharian',
    accent: '#d5b85a',
  },
};

const EMERGENCIES: Emergency[] = [
  {
    id: 'storm',
    title: 'Severe Storm Damage',
    titleTl: 'Malubhang Pinsala ng Bagyo',
    description: 'Several homes were damaged and the eastern bridge is unsafe. Relief is urgent, but repairs are needed to keep supplies moving.',
    descriptionTl: 'Nasira ang ilang tahanan at delikado ang silangang tulay. Kailangan ang agarang tulong at pagkukumpuni para magpatuloy ang supplies.',
    severity: 3,
    primary: 'relief',
    secondary: 'infrastructure',
    minimumResponse: 250,
  },
  {
    id: 'water',
    title: 'Water System Failure',
    titleTl: 'Pagkasira ng Sistema ng Tubig',
    description: 'A major water line fails near the learning district. Repairs are costly and families need temporary support while access is restored.',
    descriptionTl: 'Nasira ang pangunahing linya ng tubig malapit sa learning district. Mahal ang pagkukumpuni at kailangan ng pansamantalang tulong ng mga pamilya.',
    severity: 2,
    primary: 'infrastructure',
    secondary: 'relief',
    minimumResponse: 200,
  },
  {
    id: 'displacement',
    title: 'Families Arrive at the Frontier',
    titleTl: 'Dumating ang mga Pamilya sa Frontier',
    description: 'Displaced families arrive with immediate needs while local service teams are already stretched.',
    descriptionTl: 'Dumating ang mga pamilyang lumikas na may agarang pangangailangan habang abala na ang local service teams.',
    severity: 2,
    primary: 'relief',
    secondary: 'mission',
    minimumResponse: 200,
  },
];

const RESULT_TL: Record<string, string> = {
  'BALANCED STEWARDSHIP': 'BALANSENG PAMAMAHALA',
  'STEWARDSHIP BREAKDOWN': 'BUMAGSAK ANG PAMAMAHALA',
  'KINGDOM THRIVES': 'UMUUNLAD ANG KAHARIAN',
  'KINGDOM UNDER STRAIN': 'NAHIHIRAPAN ANG KAHARIAN',
  'CRISIS SURVIVED • RESERVE EXHAUSTED': 'NALAMPASAN ANG KRISIS • UBOS ANG RESERVE',
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const starsForScore = (score: number): 1 | 2 | 3 => (score >= 1450 ? 3 : score >= 1125 ? 2 : 1);

const initialAllocation: Allocation = {
  relief: 150,
  infrastructure: 200,
  learning: 150,
  mission: 150,
  reserve: 250,
};

const localizeMessage = (message: string, language: 'en' | 'tl', emergency: Emergency) => {
  if (language === 'en') return message;

  const exact: Record<string, string> = {
    'Build a balanced first budget. A kingdom with no reserve is fragile; a kingdom with no investment stops growing.': 'Bumuo ng balanseng unang budget. Marupok ang kahariang walang reserve; hindi uunlad ang kahariang walang investment.',
    'Budget approved. The kingdom enters the quarter... then an emergency interrupts the plan.': 'Aprubado ang budget. Nagsimula ang quarter ng kaharian... ngunit may emergency na gumambala sa plano.',
    'The quarter failed: critical kingdom health dropped below a safe level. Rebuild the budget with stronger balance and emergency protection.': 'Bumagsak ang quarter: bumaba sa ligtas na antas ang mahahalagang sukatan ng kaharian. Buuin muli ang budget na mas balanse at may proteksiyon sa emergency.',
  };
  if (exact[message]) return exact[message];

  let match = message.match(/^Assign the remaining (-?\d+) treasury tokens before approving the budget\.$/);
  if (match) return `Ilaan muna ang natitirang ${match[1]} treasury token bago aprubahan ang budget.`;

  if (message.startsWith(`${emergency.title}: decide how much of the reserve to release.`)) {
    return `${emergency.titleTl}: magpasya kung gaano karaming reserve ang ilalabas. Kapag kulang, lalala ang krisis; kapag sobra, magiging lantad ang kaharian sa susunod na panganib.`;
  }

  match = message.match(/^Emergency covered\. (\d+) reserve remains for the next unknown challenge\.$/);
  if (match) return `Nasagot ang emergency. May ${match[1]} reserve pa para sa susunod na hindi inaasahang hamon.`;

  match = message.match(/^The emergency response fell short by (\d+) coverage points\. The kingdom absorbed the consequences\.$/);
  if (match) return `Kulang ng ${match[1]} coverage points ang emergency response. Hinarap ng kaharian ang epekto nito.`;

  return message;
};

function Meter({ label, labelTl, value }: { label: string; labelTl: string; value: number }) {
  const { language } = useBuklodGameLanguage();
  return (
    <View style={styles.meterBlock}>
      <View style={styles.meterLabelRow}>
        <Text style={styles.meterLabel}>{language === 'tl' ? labelTl : label}</Text>
        <Text style={styles.meterValue}>{Math.round(value)}</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${clamp(value)}%` }]} />
      </View>
    </View>
  );
}

type Props = { onFinish?: (result: BuklodGameResult) => void };

export function KingdomTreasuryGameV1({ onFinish }: Props) {
  const { language, t } = useBuklodGameLanguage();
  const [allocation, setAllocation] = useState<Allocation>(initialAllocation);
  const [phase, setPhase] = useState<Phase>('planning');
  const [emergencyIndex, setEmergencyIndex] = useState(0);
  const [responseSpend, setResponseSpend] = useState(0);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState<KingdomHealth>({ welfare: 50, stability: 50, growth: 50, trust: 50 });
  const [message, setMessage] = useState('Build a balanced first budget. A kingdom with no reserve is fragile; a kingdom with no investment stops growing.');
  const [resultTitle, setResultTitle] = useState('');
  const [quarterFailed, setQuarterFailed] = useState(false);

  const totalAllocated = useMemo(() => Object.values(allocation).reduce((sum, value) => sum + value, 0), [allocation]);
  const unassigned = STARTING_TREASURY - totalAllocated;
  const emergency = EMERGENCIES[emergencyIndex];
  const reserveAvailable = allocation.reserve - responseSpend;
  const resultStars = quarterFailed ? 0 : starsForScore(score);

  const adjustFund = useCallback((key: FundKey, delta: number) => {
    if (phase !== 'planning') return;
    setAllocation((current) => {
      const next = current[key] + delta;
      if (next < 0) return current;
      const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);
      if (delta > 0 && currentTotal + delta > STARTING_TREASURY) return current;
      void playBuklodGameFeedback('move');
      return { ...current, [key]: next };
    });
  }, [phase]);

  const evaluatePlan = useCallback(() => {
    if (phase !== 'planning') return;
    if (unassigned !== 0) {
      setMessage(`Assign the remaining ${unassigned} treasury tokens before approving the budget.`);
      void playBuklodGameFeedback('impact');
      return;
    }

    const welfare = clamp(30 + allocation.relief * 0.16 + allocation.mission * 0.05);
    const stability = clamp(25 + allocation.infrastructure * 0.15 + allocation.reserve * 0.08);
    const growth = clamp(25 + allocation.learning * 0.15 + allocation.infrastructure * 0.08 + allocation.mission * 0.04);
    const trust = clamp(30 + allocation.relief * 0.07 + allocation.learning * 0.06 + allocation.mission * 0.08);
    const balance = Math.min(allocation.relief, allocation.infrastructure, allocation.learning, allocation.mission);
    const reserveScore = allocation.reserve >= 200 ? 180 : allocation.reserve * 0.6;
    const planningScore = Math.round(welfare + stability + growth + trust + balance * 0.7 + reserveScore);

    setHealth({ welfare, stability, growth, trust });
    setScore(planningScore);
    setPhase('event');
    setMessage('Budget approved. The kingdom enters the quarter... then an emergency interrupts the plan.');
    void playBuklodGameFeedback('collect');
  }, [allocation, phase, unassigned]);

  const revealEmergency = useCallback(() => {
    if (phase !== 'event') return;
    setResponseSpend(0);
    setPhase('response');
    setMessage(`${emergency.title}: decide how much of the reserve to release. Too little worsens the crisis; too much leaves the kingdom exposed.`);
    void playBuklodGameFeedback('impact');
  }, [emergency, phase]);

  const adjustResponse = useCallback((delta: number) => {
    if (phase !== 'response') return;
    setResponseSpend((current) => {
      const next = Math.max(0, Math.min(allocation.reserve, current + delta));
      if (next !== current) void playBuklodGameFeedback('move');
      return next;
    });
  }, [allocation.reserve, phase]);

  const finishQuarter = useCallback(() => {
    if (phase !== 'response') return;

    const primaryFund = allocation[emergency.primary];
    const secondaryFund = allocation[emergency.secondary];
    const coverage = responseSpend + primaryFund * 0.55 + secondaryFund * 0.28;
    const shortfall = Math.max(0, emergency.minimumResponse - coverage);
    const reserveLeft = allocation.reserve - responseSpend;

    const nextHealth: KingdomHealth = {
      welfare: clamp(health.welfare + primaryFund * 0.025 + responseSpend * 0.05 - shortfall * 0.11),
      stability: clamp(health.stability + allocation.infrastructure * 0.018 + reserveLeft * 0.025 - shortfall * 0.08),
      growth: clamp(health.growth + allocation.learning * 0.022 + allocation.mission * 0.009 - responseSpend * 0.018),
      trust: clamp(health.trust + allocation.relief * 0.015 + allocation.mission * 0.018 + Math.min(18, responseSpend * 0.035) - shortfall * 0.1),
    };

    const healthAverage = (nextHealth.welfare + nextHealth.stability + nextHealth.growth + nextHealth.trust) / 4;
    const responseBonus = shortfall === 0 ? 320 : Math.max(0, 220 - shortfall * 1.4);
    const reserveBonus = reserveLeft >= 100 ? 180 : reserveLeft * 1.2;
    const diversityBonus = Math.min(allocation.relief, allocation.infrastructure, allocation.learning, allocation.mission) * 0.7;
    const finalScore = Math.round(score + healthAverage * 4.2 + responseBonus + reserveBonus + diversityBonus);
    const failed = healthAverage < 42 || nextHealth.welfare < 30 || nextHealth.stability < 30;
    const stars = failed ? 0 : starsForScore(finalScore);

    setHealth(nextHealth);
    setScore(finalScore);
    setQuarterFailed(failed);
    setPhase('result');

    let title = 'BALANCED STEWARDSHIP';
    if (failed) title = 'STEWARDSHIP BREAKDOWN';
    else if (healthAverage >= 78 && reserveLeft >= 100) title = 'KINGDOM THRIVES';
    else if (healthAverage < 55) title = 'KINGDOM UNDER STRAIN';
    else if (reserveLeft < 50) title = 'CRISIS SURVIVED • RESERVE EXHAUSTED';
    setResultTitle(title);

    setMessage(
      failed
        ? 'The quarter failed: critical kingdom health dropped below a safe level. Rebuild the budget with stronger balance and emergency protection.'
        : shortfall === 0
          ? `Emergency covered. ${reserveLeft} reserve remains for the next unknown challenge.`
          : `The emergency response fell short by ${Math.round(shortfall)} coverage points. The kingdom absorbed the consequences.`,
    );

    void playBuklodGameFeedback(failed ? 'failure' : stars >= 2 ? 'success' : 'impact');
    onFinish?.({
      gameId: GAME_ID,
      status: failed ? 'lost' : 'won',
      score: finalScore,
      stars,
      reward: failed
        ? { xp: 25, kingdomXp: 5 }
        : {
            xp: 135 + stars * 45,
            kingdomXp: 60 + stars * 22,
            collectibleKey: stars === 3 ? 'angel-balanced-steward-seal' : undefined,
          },
    });
  }, [allocation, emergency, health, onFinish, phase, responseSpend, score]);

  const reset = useCallback(() => {
    setAllocation(initialAllocation);
    setPhase('planning');
    setEmergencyIndex((value) => (value + 1) % EMERGENCIES.length);
    setResponseSpend(0);
    setScore(0);
    setHealth({ welfare: 50, stability: 50, growth: 50, trust: 50 });
    setMessage('Build a balanced first budget. A kingdom with no reserve is fragile; a kingdom with no investment stops growing.');
    setResultTitle('');
    setQuarterFailed(false);
  }, []);

  return (
    <View style={styles.shell}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>{t('ANGEL • KINGDOM TREASURY', 'ANGEL • INGAT-YAMAN NG KAHARIAN')}</Text>
          <Text style={styles.title}>{t('Stewardship Council', 'Konseho ng Pamamahala')}</Text>
        </View>
        <View style={styles.treasuryBadge}>
          <Text style={styles.treasuryValue}>{STARTING_TREASURY}</Text>
          <Text style={styles.treasuryLabel}>{t('QUARTER TREASURY', 'PONDO NG QUARTER')}</Text>
        </View>
      </View>

      <Text style={styles.message}>{localizeMessage(message, language, emergency)}</Text>

      {phase === 'planning' ? (
        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>{t('PHASE 1', 'YUGTO 1')}</Text>
              <Text style={styles.sectionTitle}>{t('Build the Budget', 'Bumuo ng Budget')}</Text>
            </View>
            <View style={[styles.unassignedPill, unassigned === 0 && styles.unassignedReady]}>
              <Text style={styles.unassignedText}>{unassigned} {t('unassigned', 'hindi pa nailalaan')}</Text>
            </View>
          </View>

          {(Object.keys(FUND_META) as FundKey[]).map((key) => {
            const meta = FUND_META[key];
            return (
              <View key={key} style={styles.fundRow}>
                <View style={[styles.fundAccent, { backgroundColor: meta.accent }]} />
                <View style={styles.fundCopy}>
                  <Text style={styles.fundLabel}>{language === 'tl' ? meta.labelTl : meta.label}</Text>
                  <Text style={styles.fundPurpose}>{language === 'tl' ? meta.purposeTl : meta.purpose}</Text>
                </View>
                <View style={styles.controls}>
                  <Pressable onPress={() => adjustFund(key, -STEP)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable>
                  <Text style={styles.amount}>{allocation[key]}</Text>
                  <Pressable onPress={() => adjustFund(key, STEP)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
                </View>
              </View>
            );
          })}

          <Pressable onPress={evaluatePlan} style={styles.primaryButton}><Text style={styles.primaryText}>{t('APPROVE QUARTER BUDGET', 'APRUBAHAN ANG BUDGET NG QUARTER')}</Text></Pressable>
        </View>
      ) : null}

      {phase === 'event' ? (
        <View style={[styles.panel, styles.eventPanel]}>
          <Text style={styles.sectionKicker}>{t('PHASE 2 • UNEXPECTED EVENT', 'YUGTO 2 • HINDI INAASAHANG PANGYAYARI')}</Text>
          <Text style={styles.eventTitle}>{t('The quarter does not go as planned.', 'Hindi nasunod ang plano ng quarter.')}</Text>
          <Text style={styles.eventCopy}>{t('Your original allocation created strengths and weaknesses. The reserve now becomes meaningful.', 'Ang unang allocation mo ay lumikha ng lakas at kahinaan. Ngayon mahalaga ang reserve.')}</Text>
          <Pressable onPress={revealEmergency} style={styles.dangerButton}><Text style={styles.dangerButtonText}>{t('REVEAL EMERGENCY', 'ILABAS ANG EMERGENCY')}</Text></Pressable>
        </View>
      ) : null}

      {phase === 'response' ? (
        <View style={[styles.panel, styles.responsePanel]}>
          <View style={styles.severityRow}>
            <Text style={styles.sectionKicker}>{t('PHASE 3 • RESPONSE', 'YUGTO 3 • TUGON')}</Text>
            <Text style={styles.severity}>{'●'.repeat(emergency.severity)} {t('severity', 'tindi')}</Text>
          </View>
          <Text style={styles.eventTitle}>{language === 'tl' ? emergency.titleTl : emergency.title}</Text>
          <Text style={styles.eventCopy}>{language === 'tl' ? emergency.descriptionTl : emergency.description}</Text>

          <View style={styles.responseCard}>
            <Text style={styles.responseLabel}>{t('RELEASE FROM RESERVE', 'ILABAS MULA SA RESERVE')}</Text>
            <Text style={styles.responseAmount}>{responseSpend}</Text>
            <Text style={styles.responseRemaining}>{reserveAvailable} {t('reserve remains', 'reserve ang natitira')}</Text>
            <View style={styles.responseButtons}>
              <Pressable onPress={() => adjustResponse(-STEP)} style={styles.responseStep}><Text style={styles.responseStepText}>−50</Text></Pressable>
              <Pressable onPress={() => adjustResponse(STEP)} style={styles.responseStep}><Text style={styles.responseStepText}>+50</Text></Pressable>
            </View>
          </View>

          <View style={styles.contextRow}>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>{t('PRIMARY FUND', 'PANGUNAHING PONDO')}</Text>
              <Text style={styles.contextValue}>{language === 'tl' ? FUND_META[emergency.primary].labelTl : FUND_META[emergency.primary].label}</Text>
              <Text style={styles.contextAmount}>{allocation[emergency.primary]}</Text>
            </View>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>{t('SECONDARY FUND', 'PANGALAWANG PONDO')}</Text>
              <Text style={styles.contextValue}>{language === 'tl' ? FUND_META[emergency.secondary].labelTl : FUND_META[emergency.secondary].label}</Text>
              <Text style={styles.contextAmount}>{allocation[emergency.secondary]}</Text>
            </View>
          </View>

          <Pressable onPress={finishQuarter} style={styles.primaryButton}><Text style={styles.primaryText}>{t('COMMIT EMERGENCY RESPONSE', 'KUMPIRMAHIN ANG EMERGENCY RESPONSE')}</Text></Pressable>
        </View>
      ) : null}

      {phase === 'result' ? (
        <View style={[styles.panel, styles.resultPanel, quarterFailed && styles.failedPanel]}>
          <Text style={styles.sectionKicker}>{t('QUARTER RESULT', 'RESULTA NG QUARTER')}</Text>
          <Text style={[styles.resultTitle, quarterFailed && styles.failedTitle]}>{language === 'tl' ? (RESULT_TL[resultTitle] ?? resultTitle) : resultTitle}</Text>
          <Text style={styles.finalScore}>{score}</Text>
          <Text style={styles.finalScoreLabel}>{t('STEWARDSHIP SCORE', 'ISKOR SA PAMAMAHALA')}</Text>

          <View style={styles.healthGrid}>
            <Meter label="Welfare" labelTl="Kapakanan" value={health.welfare} />
            <Meter label="Stability" labelTl="Katatagan" value={health.stability} />
            <Meter label="Growth" labelTl="Pag-unlad" value={health.growth} />
            <Meter label="Trust" labelTl="Tiwala" value={health.trust} />
          </View>

          <View style={styles.resultSummary}>
            <Text style={styles.summaryLine}>{t('Reserve left', 'Natitirang reserve')}: {allocation.reserve - responseSpend}</Text>
            <Text style={styles.summaryLine}>{t('Emergency release', 'Inilabas sa emergency')}: {responseSpend}</Text>
            <Text style={styles.summaryLine}>{quarterFailed ? t('Quarter failed • no star awarded', 'Bumagsak ang quarter • walang bituin') : `${t('Stars', 'Mga bituin')}: ${'★'.repeat(resultStars)}`}</Text>
          </View>

          <Pressable onPress={reset} style={styles.primaryButton}><Text style={styles.primaryText}>{t('NEW QUARTER', 'BAGONG QUARTER')}</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 22, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { color: '#ecd28a', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8e8', fontSize: 31, fontWeight: '900', marginTop: 3 },
  treasuryBadge: { alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(19,13,5,0.64)', borderWidth: 1, borderColor: 'rgba(227,193,94,0.28)' },
  treasuryValue: { color: '#ffe7a1', fontSize: 27, fontWeight: '900' },
  treasuryLabel: { color: '#cfb874', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  message: { color: '#eadcc1', fontSize: 14, lineHeight: 21 },
  panel: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(18,13,7,0.74)', borderWidth: 1, borderColor: 'rgba(229,198,111,0.22)', gap: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionKicker: { color: '#d8bd72', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#fff8e9', fontSize: 23, fontWeight: '900', marginTop: 2 },
  unassignedPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(128,73,47,0.72)' },
  unassignedReady: { backgroundColor: 'rgba(61,103,63,0.76)' },
  unassignedText: { color: '#fff4de', fontSize: 11, fontWeight: '900' },
  fundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12, backgroundColor: 'rgba(255,255,255,0.035)', flexWrap: 'wrap' },
  fundAccent: { width: 7, minHeight: 54, borderRadius: 999 },
  fundCopy: { flex: 1, minWidth: 190, gap: 2 },
  fundLabel: { color: '#fff7e7', fontSize: 15, fontWeight: '900' },
  fundPurpose: { color: '#c8bda7', fontSize: 11, lineHeight: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  stepText: { color: '#ffe6a1', fontSize: 21, fontWeight: '900' },
  amount: { minWidth: 40, textAlign: 'center', color: '#ffffff', fontSize: 17, fontWeight: '900' },
  primaryButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: '#b88a2f' },
  primaryText: { color: '#160f05', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  eventPanel: { minHeight: 280, justifyContent: 'center' },
  eventTitle: { color: '#fff5e3', fontSize: 27, fontWeight: '900' },
  eventCopy: { color: '#ddceb7', fontSize: 14, lineHeight: 22 },
  dangerButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7d4033' },
  dangerButtonText: { color: '#fff0e9', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  responsePanel: { gap: 16 },
  severityRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  severity: { color: '#de8c75', fontSize: 11, fontWeight: '900' },
  responseCard: { alignItems: 'center', gap: 5, borderRadius: 20, padding: 18, backgroundColor: 'rgba(228,190,92,0.08)', borderWidth: 1, borderColor: 'rgba(228,190,92,0.18)' },
  responseLabel: { color: '#d7c392', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  responseAmount: { color: '#fff0b5', fontSize: 44, fontWeight: '900' },
  responseRemaining: { color: '#c8bda3', fontSize: 12 },
  responseButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  responseStep: { minWidth: 90, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  responseStepText: { color: '#ffe5a0', fontWeight: '900' },
  contextRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  contextCard: { flex: 1, minWidth: 180, minHeight: 100, borderRadius: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.035)' },
  contextLabel: { color: '#ac9f88', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  contextValue: { color: '#fff7e8', fontSize: 13, fontWeight: '800', marginTop: 5 },
  contextAmount: { color: '#f1d27b', fontSize: 24, fontWeight: '900', marginTop: 4 },
  resultPanel: { alignItems: 'stretch' },
  failedPanel: { borderColor: 'rgba(205,93,70,0.48)' },
  resultTitle: { color: '#fff3c9', fontSize: 30, fontWeight: '900' },
  failedTitle: { color: '#ffb49d' },
  finalScore: { color: '#ffffff', fontSize: 46, fontWeight: '900', marginTop: 4 },
  finalScoreLabel: { color: '#bea96f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  healthGrid: { gap: 12, marginTop: 6 },
  meterBlock: { gap: 5 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { color: '#eadfc8', fontSize: 12, fontWeight: '800' },
  meterValue: { color: '#fff0b3', fontSize: 12, fontWeight: '900' },
  meterTrack: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)' },
  meterFill: { height: '100%', borderRadius: 999, backgroundColor: '#d5b85a' },
  resultSummary: { borderRadius: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.035)', gap: 4 },
  summaryLine: { color: '#d8ccb5', fontSize: 12 },
});
