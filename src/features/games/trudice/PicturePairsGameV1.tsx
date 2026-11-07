import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import {
  PAIR_LEVELS, PAIR_SYMBOLS, createPairRound, flipPair, settlePairMismatch,
  type PairRound,
} from './picturePairsRules';

const GAME_ID = 'trudice-picture-pairs';
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'won';
export function PicturePairsGameV1({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [round, setRound] = useState<PairRound>(() => createPairRound(0));
  const roundRef = useRef(round);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(0);
  const [totalMisses, setTotalMisses] = useState(0);
  const missesRef = useRef(0);
  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef('');
  const completedRef = useRef(false);

  const changePhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
  const clearPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  useEffect(() => clearPending, [clearPending]);
  const startLevel = useCallback((index: number) => {
    clearPending();
    const next = createPairRound(index);
    roundRef.current = next;
    setRound(next);
    setLevel(index);
    changePhase('playing');
    setMessage(t('Tap any two cards to find a pair. Remember their positions!', 'I-tap ang dalawang card upang makahanap ng pares. Tandaan ang mga lokasyon!'));
    void playBuklodGameFeedback('move');
  }, [clearPending, t]);
  const start = useCallback(() => {
    clearPending();
    totalRef.current = 0; missesRef.current = 0;
    setTotal(0); setTotalMisses(0);
    completedRef.current = false;
    sessionRef.current = 'pp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    startLevel(0);
  }, [clearPending, startLevel]);
  const finish = useCallback((score: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    changePhase('won');
    const stars = missesRef.current <= 4 ? 3 : missesRef.current <= 10 ? 2 : 1;
    onFinish?.({
      gameId: GAME_ID, status: 'won', score, stars: stars as 0 | 1 | 2 | 3,
      reward: { xp: 0, kingdomXp: 0 },
    }, sessionRef.current);
    void playBuklodGameFeedback('success');
  }, [onFinish]);
  const flip = useCallback((cardId: number) => {
    if (phaseRef.current !== 'playing') return;
    const previous = roundRef.current;
    const next = flipPair(previous, cardId);
    if (next === previous) return;
    roundRef.current = next;
    setRound(next);
    if (next.up.length === 2) {
      missesRef.current++;
      setTotalMisses(missesRef.current);
      setMessage(t('Try again. Remember where both pictures appeared.', 'Subukan ulit. Tandaan ang dalawang larawan.'));
      void playBuklodGameFeedback('impact');
      const faceIds = [...next.up];
      clearPending();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (phaseRef.current !== 'playing') return;
        const settled = settlePairMismatch(roundRef.current, faceIds);
        if (settled !== roundRef.current) {
          roundRef.current = settled;
          setRound(settled);
        }
      }, 750);
      return;
    }
    if (next.matched.length > previous.matched.length) {
      setMessage(t('Pair found!', 'May nahanap na pares!'));
      void playBuklodGameFeedback('collect');
    } else void playBuklodGameFeedback('move');
    if (next.status === 'won') {
      const newTotal = totalRef.current + next.score;
      totalRef.current = newTotal;
      setTotal(newTotal);
      if (level === PAIR_LEVELS.length - 1) finish(newTotal);
      else { changePhase('levelClear'); void playBuklodGameFeedback('success'); }
    }
  }, [clearPending, finish, level, t]);

  const played = phase !== 'ready';
  const finished = phase === 'won';
  return (
    <View style={s.shell}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>TRUDICE • WONDER GARDEN</Text>
          <Text style={s.title}>PICTURE PAIRS</Text>
          <Text style={s.subtitle}>{t('A world of little discoveries.', 'Mundo ng mumunting pagtuklas.')}</Text>
        </View>
        <View style={s.scoreBox}><Text style={s.score}>{total + (played && !finished ? round.score : 0)}</Text><Text style={s.scoreLabel}>MEMORY SCORE</Text></View>
      </View>
      {phase === 'ready' ? (
        <View style={s.panel}><Text style={s.panelTitle}>{t('Discover the hidden pairs', 'Hanapin ang mga nakatagong pares')}</Text>
          <Text style={s.body}>{t('Flip two picture cards. If the symbols match, the pair stays revealed. If not, both cards turn back after a short moment. Finish three larger gardens with fewer mistakes to earn more stars. No time pressure or paid moves.', 'Buksan ang dalawang picture cards. Mananatiling bukas ang pares na magkapareho. Kapag hindi, muling itatago ang mga card. Kumpletuhin ang tatlong lumalaking garden nang kaunti ang mali. Walang oras na hinahabol.')}</Text>
          <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY PICTURE PAIRS', 'SIMULAN ANG PICTURE PAIRS')}</Text></Pressable>
        </View>
      ) : phase === 'won' ? (
        <View style={s.panel}><Text style={s.panelTitle}>{t('ALL GARDENS RESTORED!', 'KUMPLETO ANG LAHAT NG GARDEN!')}</Text>
          <Text style={s.finalScore}>{total}</Text>
          <Text style={s.body}>{t('Memory game score only. No BUKLOD Character Points were awarded.', 'Score lamang ng memory game. Walang Character Points na nadagdag.')}</Text>
          <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'paused' ? (
        <View style={s.panel}><Text style={s.panelTitle}>{t('Taking a break', 'Naka-pause ang laro')}</Text>
          <Pressable onPress={() => changePhase('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : phase === 'levelClear' ? (
        <View style={s.panel}><Text style={s.panelTitle}>{t('GARDEN COMPLETED!', 'KUMPLETO ANG GARDEN!')}</Text>
          <Text style={s.body}>{t('Ready for another set of pictures?', 'Handa ka na ba sa susunod na mga larawan?')}</Text>
          <Pressable onPress={() => startLevel(level + 1)} style={s.primary}><Text style={s.primaryText}>{t('NEXT GARDEN', 'SUSUNOD NA GARDEN')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.stats}>
            <Text style={s.stat}>{t('GARDEN', 'GARDEN')} {level + 1}/{PAIR_LEVELS.length}</Text>
            <Text style={s.stat}>{t('PAIRS', 'PARES')}: {round.matched.length / 2}/{PAIR_LEVELS[level].pairs}</Text>
            <Text style={s.stat}>{t('MISSES', 'MALI')}: {totalMisses}</Text>
            <Pressable accessibilityRole="button" onPress={() => { clearPending(); const old = roundRef.current; const settled = settlePairMismatch(old, old.up); if (settled !== old) { roundRef.current = settled; setRound(settled); } changePhase('paused'); }}
              style={s.minor}><Text style={s.minorText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          <View style={s.board}>
            {round.deck.map(card => {
              const revealed = round.up.includes(card.id);
              const matched = round.matched.includes(card.id);
              return <Pressable key={card.id} accessibilityRole="button"
                accessibilityLabel={matched ? t('Matched picture', 'Nahanap na pares') : revealed
                  ? t('Face up picture', 'Bukas na larawan') : t('Hidden picture', 'Nakatagong larawan')}
                accessibilityState={{ disabled: matched }}
                disabled={matched || round.up.length === 2}
                onPress={() => flip(card.id)}
                style={[s.card, { width: PAIR_LEVELS[level].columns === 5 ? '18%' : '23%' },
                  (revealed || matched) && s.cardRevealed, matched && s.cardMatched]}>
                {revealed || matched ? <Text style={s.emoji}>{PAIR_SYMBOLS[card.symbol]}</Text>
                  : <MaterialCommunityIcons name="flower-tulip" size={25} color="#f8dfb6" />}
              </Pressable>;
            })}
          </View>
          {!!message && <Text style={s.message}>{message}</Text>}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { width: '100%', maxWidth: 810, alignSelf: 'center', padding: 12, gap: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#e8d5ff', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  title: { color: '#fff0ef', fontWeight: '900', fontSize: 25 },
  subtitle: { color: '#e5d8f1', fontSize: 12 },
  scoreBox: { padding: 9, backgroundColor: '#4b3665', borderWidth: 1, borderColor: '#c5a1c9', alignItems: 'center', borderRadius: 12 },
  score: { fontSize: 22, color: '#ffdd98', fontWeight: '900' },
  scoreLabel: { color: '#d5c4ea', fontSize: 9, fontWeight: '800' },
  panel: { padding: 18, borderRadius: 17, backgroundColor: '#372750', borderWidth: 1, borderColor: '#9c80b3', gap: 14 },
  panelTitle: { fontSize: 21, fontWeight: '900', color: '#fff3eb' },
  body: { fontSize: 13, lineHeight: 21, color: '#e5def0' },
  primary: { padding: 13, borderRadius: 11, alignItems: 'center', backgroundColor: '#e8c1d3' },
  primaryText: { color: '#482c52', fontWeight: '900', fontSize: 12 },
  finalScore: { fontSize: 42, color: '#ffe0a7', fontWeight: '900' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stat: { color: '#ffddf2', fontWeight: '900', fontSize: 11 },
  minor: { borderRadius: 9, paddingVertical: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: '#c6abcc' },
  minorText: { color: '#fbeaff', fontSize: 10, fontWeight: '900' },
  board: { width: '100%', maxWidth: 510, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, padding: 9, backgroundColor: '#382e50', borderRadius: 16, borderWidth: 1, borderColor: '#9d8dbd' },
  card: { aspectRatio: 1, maxWidth: 114, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: '#e0bbcf', backgroundColor: '#73518a', shadowColor: '#150b26', shadowOpacity: .4, shadowRadius: 4, elevation: 2 },
  cardRevealed: { backgroundColor: '#f3dfc8', borderColor: '#e6c58b' },
  cardMatched: { backgroundColor: '#c8e5c8', borderColor: '#79b896' },
  emoji: { fontSize: 28 },
  message: { color: '#e9d7f4', fontSize: 12, textAlign: 'center', lineHeight: 19 },
});
