import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import {
  CODE_LEVELS, applyCodeGuess, applyCodeHint,
  codeGuessValid, createCodeRound, insertCodeGem, type CodeRound,
} from './codeBreakerRules';

const GAME_ID = 'quin-code-breaker';
const GEM_COLORS = ['#56c7d4', '#f5c469', '#bd85dc', '#8ad28c', '#e2809d', '#aac6ff', '#e29d7d'] as const;
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'won' | 'lost';

export function CodeBreakerGameV1({ onFinish }: Props) {
  const { t, language } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [round, setRound] = useState<CodeRound>(() => createCodeRound(0));
  const roundRef = useRef(round);
  const [draft, setDraft] = useState<(number | null)[]>([null, null, null]);
  const draftRef = useRef<(number | null)[]>([null, null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const slotRef = useRef(0);
  const explicitSlotRef = useRef(false);
  const [totalScore, setTotalScore] = useState(0);
  const scoreRef = useRef(0);
  const [errorCount, setErrorCount] = useState(0);
  const hintCountRef = useRef(0);
  const attemptsRef = useRef(0);
  const [message, setMessage] = useState('');
  const finishedRef = useRef(false);
  const sessionRef = useRef('');
  const spec = CODE_LEVELS[level];

  const switchPhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  const resetLevel = useCallback((nextLevel: number) => {
    const newRound = createCodeRound(nextLevel);
    roundRef.current = newRound;
    setRound(newRound);
    const fresh = Array<number | null>(CODE_LEVELS[nextLevel].digits).fill(null);
    draftRef.current = fresh;
    setDraft(fresh);
    slotRef.current = 0;
    explicitSlotRef.current = false;
    setActiveSlot(0);
    setLevel(nextLevel);
    switchPhase('playing');
    setMessage(t('Choose gems for each slot, then submit your code.', 'Pumili ng hiyas sa bawat puwesto, saka isumite ang code.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const start = useCallback(() => {
    sessionRef.current = 'cb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 13);
    scoreRef.current = 0;
    setTotalScore(0);
    setErrorCount(0);
    hintCountRef.current = 0;
    attemptsRef.current = 0;
    finishedRef.current = false;
    resetLevel(0);
  }, [resetLevel]);

  const finish = useCallback((status: 'won' | 'lost', score: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    switchPhase(status);
    const stars = status === 'lost' ? 0 : attemptsRef.current <= 5 && hintCountRef.current === 0 ? 3 :
      hintCountRef.current <= 1 && attemptsRef.current <= 12 ? 2 : 1;
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID, status, score, stars: stars as 0 | 1 | 2 | 3,
      reward: { xp: 0, kingdomXp: 0 },
    }, sessionRef.current);
  }, [onFinish]);

  function putGem(value: number) {
    if (phaseRef.current !== 'playing') return;
    try {
      const result = insertCodeGem(draftRef.current, slotRef.current, value, spec.palette, explicitSlotRef.current);
      // Commit both slot and code synchronously to avoid double-click state races.
      explicitSlotRef.current = false;
      draftRef.current = result.digits;
      setDraft(result.digits);
      slotRef.current = result.nextIndex;
      setActiveSlot(result.nextIndex);
      void playBuklodGameFeedback('move');
    } catch (error) {
      setMessage(t('Choose a valid, non-repeating gem for the selected slot.', 'Pumili ng wastong hiyas na hindi inuulit sa napiling puwesto.'));
      void playBuklodGameFeedback('impact');
    }
  }

  function clearSlot() {
    if (phaseRef.current !== 'playing') return;
    const changed = [...draftRef.current];
    changed[slotRef.current] = null;
    draftRef.current = changed;
    setDraft(changed);
    void playBuklodGameFeedback('move');
  }

  function submit() {
    if (phaseRef.current !== 'playing') return;
    const guess = draftRef.current;
    if (guess.some(d => d === null) || !codeGuessValid(guess as number[], spec)) {
      setMessage(t('Complete the code using distinct gems before submitting.', 'Kumpletuhin ang code gamit ang magkakaibang hiyas.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    const next = applyCodeGuess(roundRef.current, guess as number[]);
    roundRef.current = next;
    setRound(next);
    attemptsRef.current++;
    draftRef.current = Array<number | null>(spec.digits).fill(null);
    setDraft(draftRef.current);
    slotRef.current = 0;
    explicitSlotRef.current = false;
    setActiveSlot(0);
    if (next.status === 'won') {
      scoreRef.current += next.score;
      setTotalScore(scoreRef.current);
      if (level + 1 === CODE_LEVELS.length) finish('won', scoreRef.current);
      else {
        switchPhase('levelClear');
        void playBuklodGameFeedback('success');
      }
      return;
    }
    if (next.status === 'lost') {
      finish('lost', scoreRef.current);
      return;
    }
    const evaluation = next.history[next.history.length - 1].feedback;
    setMessage(t('Exact positions', 'Eksaktong puwesto') + ': ' + evaluation.exact +
      ' • ' + t('right gem, wrong place', 'tamang hiyas, maling puwesto') + ': ' + evaluation.displaced);
    void playBuklodGameFeedback(evaluation.exact ? 'collect' : 'impact');
  }

  function hint() {
    if (phaseRef.current !== 'playing') return;
    const previous = roundRef.current;
    const next = applyCodeHint(previous);
    if (next === previous) return;
    hintCountRef.current++;
    roundRef.current = next;
    setRound(next);
    setMessage(t('First gem revealed. This reduces game mastery stars.', 'Ipinakita ang unang hiyas. May bawas sa game mastery stars.'));
    void playBuklodGameFeedback('move');
  }

  return (
    <View style={s.shell}>
      <View style={s.top}>
        <View>
          <Text style={s.kicker}>QUIN • DISCOVERY WORLD</Text>
          <Text style={s.title}>CODE BREAKER</Text>
          <Text style={s.subtitle}>{t('Deduce the hidden relic combination.', 'Tuklasin ang nakatagong kumbinasyon ng relikya.')}</Text>
        </View>
        <View style={s.scoreBox}><Text style={s.score}>{totalScore}</Text><Text style={s.scoreText}>MASTERY SCORE</Text></View>
      </View>
      {phase === 'ready' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Three mysteries. One clear mind.', 'Tatlong misteryo. Isang malinaw na isip.')}</Text>
          <Text style={s.body}>{t('Guess the order of colored gems. No gem repeats. Each guess shows how many are exactly in place, and how many are in the code but at another position. Solve 3, 4, then 5-gem codes within the allowed attempts. A single hint reveals the first gem of a level.', 'Hulaan ang pagkakasunod ng makukulay na hiyas. Walang inuulit. Ipapakita kung ilang hiyas ang eksaktong nasa puwesto, at ilang tama ngunit nasa ibang puwesto. Lutasin ang code na may 3, 4, at 5 hiyas. Isang hint bawat level ang magpapakita ng unang hiyas.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START CODE BREAKER', 'SIMULAN ANG CODE BREAKER')}</Text></Pressable>
        </View>
      ) : phase === 'won' || phase === 'lost' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{phase === 'won' ? t('ALL RELICS DISCOVERED!', 'NATUKLASAN ANG LAHAT NG RELIKYA!') : t('ATTEMPTS EXHAUSTED', 'UBOS NA ANG MGA HULA')}</Text>
          <Text style={s.bigScore}>{totalScore}</Text>
          <Text style={s.body}>{t('Game-only mastery score. No Character Points or cash rewards were granted.', 'Game mastery score lamang ito. Walang Character Points o cash reward na ibinigay.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'paused' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
          <Pressable style={s.primary} onPress={() => switchPhase('playing')}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : phase === 'levelClear' ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{t('MYSTERY SOLVED!', 'NALUTAS ANG MISTERYO!')}</Text>
          <Text style={s.body}>{t('You unlocked the next chamber. Your mastery score carries forward.', 'Bukas na ang susunod na silid. Kasama ang naipong score.')}</Text>
          <Pressable style={s.primary} onPress={() => resetLevel(level + 1)}><Text style={s.primaryText}>{t('NEXT CHAMBER', 'SUSUNOD NA SILID')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.status}>
            <Text style={s.statusText}>{t('CHAMBER', 'SILID')} {level + 1}/3 • {language === 'tl' ? spec.tl : spec.en}</Text>
            <Text style={s.statusText}>{t('GUESSES', 'HULA')}: {round.history.length}/{spec.attempts}</Text>
            <Pressable style={s.control} onPress={() => switchPhase('paused')}><Text style={s.controlText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          <View style={s.history}>
            {round.history.length === 0 && <Text style={s.body}>{t('Your deduction history will appear here.', 'Dito makikita ang mga naunang hula.')}</Text>}
            {round.history.map((attempt, i) => <View style={s.historyRow} key={i}>
              <Text style={s.historyIndex}>{i + 1}.</Text>
              <View style={s.gemSequence}>
                {attempt.digits.map((gem, position) => <View key={position} style={[s.historyGem, { backgroundColor: GEM_COLORS[gem - 1] }]}/>)}
              </View>
              <Text style={s.historyFeedback}>{t('Exact', 'Eksakto')}: {attempt.feedback.exact} • {t('Other', 'Iba')}: {attempt.feedback.displaced}</Text>
            </View>)}
          </View>
          {round.hintedIndex !== null && (
            <Text style={s.hintText}>{t('FIRST GEM', 'UNANG HIYAS')}: {round.secret[round.hintedIndex]} • {t('Hint used', 'Nagamit ang hint')}</Text>
          )}
          <View style={s.draft}>
            {draft.map((value, i) => <Pressable key={i} accessibilityRole="button"
              accessibilityLabel={t('Slot', 'Puwesto') + ' ' + (i + 1)}
              style={[s.draftSlot, activeSlot === i && s.draftActive]}
              onPress={() => { slotRef.current = i; explicitSlotRef.current = true; setActiveSlot(i); }}>
              {value === null
                ? <Text style={s.slotNumber}>{i + 1}</Text>
                : <View style={[s.draftGem, { backgroundColor: GEM_COLORS[value - 1] }]}>
                    <Text style={s.gemNumber}>{value}</Text>
                  </View>}
            </Pressable>)}
          </View>
          <View style={s.palette}>
            {Array.from({ length: spec.palette }, (_, i) => i + 1).map(number => <Pressable
              key={number} style={[s.paletteGem, { backgroundColor: GEM_COLORS[number - 1] }]}
              accessibilityRole="button" accessibilityLabel={t('Gem', 'Hiyas') + ' ' + number}
              onPress={() => putGem(number)}>
              <Text style={s.gemNumber}>{number}</Text>
            </Pressable>)}
          </View>
          <View style={s.controls}>
            <Pressable style={s.control} onPress={clearSlot}><Text style={s.controlText}>{t('CLEAR SLOT', 'BURAHIN')}</Text></Pressable>
            <Pressable style={[s.control, round.hintedIndex !== null && s.disabled]} disabled={round.hintedIndex !== null} onPress={hint}>
              <Text style={s.controlText}>{t('REVEAL FIRST', 'PAKITA UNA')}</Text>
            </Pressable>
          </View>
          <Pressable style={s.primary} onPress={submit}><Text style={s.primaryText}>{t('SUBMIT CODE', 'ISUMITE ANG CODE')}</Text></Pressable>
          {!!message && <Text style={s.message}>{message}</Text>}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { maxWidth: 790, width: '100%', alignSelf: 'center', padding: 12, gap: 13 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  kicker: { color: '#c6c4fd', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  title: { fontSize: 26, fontWeight: '900', color: '#faf0ff' },
  subtitle: { fontSize: 12, lineHeight: 18, color: '#d2d5ee', maxWidth: 250 },
  scoreBox: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#9e8ec8', backgroundColor: '#35304c', alignItems: 'center' },
  score: { fontSize: 24, fontWeight: '900', color: '#f5d6a6' },
  scoreText: { fontSize: 9, fontWeight: '900', color: '#c2bdde' },
  panel: { padding: 18, borderRadius: 17, borderWidth: 1, borderColor: '#8678a6', backgroundColor: '#2b304a', gap: 13 },
  panelTitle: { fontSize: 21, fontWeight: '900', color: '#fcf2da' },
  body: { fontSize: 13, lineHeight: 21, color: '#e1e2f5' },
  primary: { backgroundColor: '#dec793', padding: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { fontSize: 13, color: '#302641', fontWeight: '900' },
  bigScore: { fontSize: 45, color: '#f2d49b', fontWeight: '900' },
  status: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  statusText: { fontSize: 11, fontWeight: '900', color: '#e0dffb' },
  history: { backgroundColor: '#292c47', borderRadius: 13, borderWidth: 1, borderColor: '#665e88', padding: 13, gap: 7 },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  historyIndex: { fontSize: 11, fontWeight: '900', color: '#c9c3e2' },
  historyGem: { width: 21, height: 21, borderRadius: 8, borderWidth: 2, borderColor: '#ffffff33' },
  gemSequence: { flexDirection: 'row', gap: 5 },
  historyFeedback: { color: '#dfe6ff', fontSize: 11, fontWeight: '900' },
  hintText: { color: '#f1d99d', fontSize: 12, fontWeight: '900' },
  draft: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  draftSlot: { width: 54, height: 58, borderWidth: 1, borderColor: '#797ca3', borderRadius: 10, backgroundColor: '#353654', alignItems: 'center', justifyContent: 'center' },
  draftActive: { borderColor: '#f3dfa9', borderWidth: 3 },
  draftGem: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  slotNumber: { color: '#8585aa', fontWeight: '900', fontSize: 16 },
  gemNumber: { fontSize: 15, fontWeight: '900', color: '#26324b' },
  palette: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', justifyContent: 'center' },
  paletteGem: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e6e4ff55' },
  controls: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  control: { borderWidth: 1, borderColor: '#9b92bc', backgroundColor: '#353650', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  disabled: { opacity: .4 },
  controlText: { color: '#f5e9ff', fontSize: 10, fontWeight: '900' },
  message: { color: '#e2e5fa', fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
