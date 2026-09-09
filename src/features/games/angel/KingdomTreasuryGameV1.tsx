import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type FundKey = 'relief' | 'infrastructure' | 'learning' | 'mission' | 'reserve';
type Phase = 'planning' | 'event' | 'response' | 'result';

type Allocation = Record<FundKey, number>;
type KingdomHealth = { welfare: number; stability: number; growth: number; trust: number };
type Emergency = {
  id: string;
  title: string;
  description: string;
  severity: 1 | 2 | 3;
  primary: FundKey;
  secondary: FundKey;
  minimumResponse: number;
};

const GAME_ID = 'angel-kingdom-treasury';
const STARTING_TREASURY = 1000;
const STEP = 50;

const FUND_META: Record<FundKey, { label: string; purpose: string; accent: string }> = {
  relief: { label: 'People & Relief', purpose: 'Food, emergency help, vulnerable families', accent: '#d98469' },
  infrastructure: { label: 'Infrastructure', purpose: 'Roads, repairs, water access, community facilities', accent: '#7da6b6' },
  learning: { label: 'Learning', purpose: 'Education, formation, youth development', accent: '#b79ad6' },
  mission: { label: 'Mission & Service', purpose: 'Community outreach, care teams, mission support', accent: '#8fb37c' },
  reserve: { label: 'Emergency Reserve', purpose: 'Protection against unexpected kingdom-wide shocks', accent: '#d5b85a' },
};

const EMERGENCIES: Emergency[] = [
  {
    id: 'storm',
    title: 'Severe Storm Damage',
    description: 'Several homes were damaged and the eastern bridge is unsafe. Relief is urgent, but repairs are needed to keep supplies moving.',
    severity: 3,
    primary: 'relief',
    secondary: 'infrastructure',
    minimumResponse: 250,
  },
  {
    id: 'water',
    title: 'Water System Failure',
    description: 'A major water line fails near the learning district. Repairs are costly and families need temporary support while access is restored.',
    severity: 2,
    primary: 'infrastructure',
    secondary: 'relief',
    minimumResponse: 200,
  },
  {
    id: 'displacement',
    title: 'Families Arrive at the Frontier',
    description: 'Displaced families arrive with immediate needs while local service teams are already stretched.',
    severity: 2,
    primary: 'relief',
    secondary: 'mission',
    minimumResponse: 200,
  },
];

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const starsForScore = (score: number): 1 | 2 | 3 => (score >= 1450 ? 3 : score >= 1125 ? 2 : 1);

const initialAllocation: Allocation = {
  relief: 150,
  infrastructure: 200,
  learning: 150,
  mission: 150,
  reserve: 250,
};

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meterBlock}>
      <View style={styles.meterLabelRow}>
        <Text style={styles.meterLabel}>{label}</Text>
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
          <Text style={styles.eyebrow}>ANGEL • KINGDOM TREASURY</Text>
          <Text style={styles.title}>Stewardship Council</Text>
        </View>
        <View style={styles.treasuryBadge}>
          <Text style={styles.treasuryValue}>{STARTING_TREASURY}</Text>
          <Text style={styles.treasuryLabel}>QUARTER TREASURY</Text>
        </View>
      </View>

      <Text style={styles.message}>{message}</Text>

      {phase === 'planning' ? (
        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>PHASE 1</Text>
              <Text style={styles.sectionTitle}>Build the Budget</Text>
            </View>
            <View style={[styles.unassignedPill, unassigned === 0 && styles.unassignedReady]}>
              <Text style={styles.unassignedText}>{unassigned} unassigned</Text>
            </View>
          </View>

          {(Object.keys(FUND_META) as FundKey[]).map((key) => {
            const meta = FUND_META[key];
            return (
              <View key={key} style={styles.fundRow}>
                <View style={[styles.fundAccent, { backgroundColor: meta.accent }]} />
                <View style={styles.fundCopy}>
                  <Text style={styles.fundLabel}>{meta.label}</Text>
                  <Text style={styles.fundPurpose}>{meta.purpose}</Text>
                </View>
                <View style={styles.controls}>
                  <Pressable onPress={() => adjustFund(key, -STEP)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable>
                  <Text style={styles.amount}>{allocation[key]}</Text>
                  <Pressable onPress={() => adjustFund(key, STEP)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
                </View>
              </View>
            );
          })}

          <Pressable onPress={evaluatePlan} style={styles.primaryButton}><Text style={styles.primaryText}>APPROVE QUARTER BUDGET</Text></Pressable>
        </View>
      ) : null}

      {phase === 'event' ? (
        <View style={[styles.panel, styles.eventPanel]}>
          <Text style={styles.sectionKicker}>PHASE 2 • UNEXPECTED EVENT</Text>
          <Text style={styles.eventTitle}>The quarter does not go as planned.</Text>
          <Text style={styles.eventCopy}>Your original allocation created strengths and weaknesses. The reserve now becomes meaningful.</Text>
          <Pressable onPress={revealEmergency} style={styles.dangerButton}><Text style={styles.dangerButtonText}>REVEAL EMERGENCY</Text></Pressable>
        </View>
      ) : null}

      {phase === 'response' ? (
        <View style={[styles.panel, styles.responsePanel]}>
          <View style={styles.severityRow}>
            <Text style={styles.sectionKicker}>PHASE 3 • RESPONSE</Text>
            <Text style={styles.severity}>{'●'.repeat(emergency.severity)} severity</Text>
          </View>
          <Text style={styles.eventTitle}>{emergency.title}</Text>
          <Text style={styles.eventCopy}>{emergency.description}</Text>

          <View style={styles.responseCard}>
            <Text style={styles.responseLabel}>RELEASE FROM RESERVE</Text>
            <Text style={styles.responseAmount}>{responseSpend}</Text>
            <Text style={styles.responseRemaining}>{reserveAvailable} reserve remains</Text>
            <View style={styles.responseButtons}>
              <Pressable onPress={() => adjustResponse(-STEP)} style={styles.responseStep}><Text style={styles.responseStepText}>−50</Text></Pressable>
              <Pressable onPress={() => adjustResponse(STEP)} style={styles.responseStep}><Text style={styles.responseStepText}>+50</Text></Pressable>
            </View>
          </View>

          <View style={styles.contextRow}>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>PRIMARY FUND</Text>
              <Text style={styles.contextValue}>{FUND_META[emergency.primary].label}</Text>
              <Text style={styles.contextAmount}>{allocation[emergency.primary]}</Text>
            </View>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>SECONDARY FUND</Text>
              <Text style={styles.contextValue}>{FUND_META[emergency.secondary].label}</Text>
              <Text style={styles.contextAmount}>{allocation[emergency.secondary]}</Text>
            </View>
          </View>

          <Pressable onPress={finishQuarter} style={styles.primaryButton}><Text style={styles.primaryText}>COMMIT EMERGENCY RESPONSE</Text></Pressable>
        </View>
      ) : null}

      {phase === 'result' ? (
        <View style={[styles.panel, styles.resultPanel, quarterFailed && styles.failedPanel]}>
          <Text style={styles.sectionKicker}>QUARTER RESULT</Text>
          <Text style={[styles.resultTitle, quarterFailed && styles.failedTitle]}>{resultTitle}</Text>
          <Text style={styles.finalScore}>{score}</Text>
          <Text style={styles.finalScoreLabel}>STEWARDSHIP SCORE</Text>

          <View style={styles.healthGrid}>
            <Meter label="Welfare" value={health.welfare} />
            <Meter label="Stability" value={health.stability} />
            <Meter label="Growth" value={health.growth} />
            <Meter label="Trust" value={health.trust} />
          </View>

          <View style={styles.resultSummary}>
            <Text style={styles.summaryLine}>Reserve left: {allocation.reserve - responseSpend}</Text>
            <Text style={styles.summaryLine}>Emergency release: {responseSpend}</Text>
            <Text style={styles.summaryLine}>{quarterFailed ? 'Quarter failed • no star awarded' : `Stars: ${'★'.repeat(resultStars)}`}</Text>
          </View>

          <Pressable onPress={reset} style={styles.primaryButton}><Text style={styles.primaryText}>NEW QUARTER</Text></Pressable>
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
