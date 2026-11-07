import React, { useCallback, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import {
  MATCH_LEVELS, createMatch3Round, match3LegalSwaps, performMatch3Swap,
  type MatchCell, type MatchGameId, type MatchRound,
} from './matchThreeRules';

type Props = { gameId: MatchGameId; onFinish?: (result: BuklodGameResult, sessionId: string) => void };
type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'retry' | 'won' | 'lost';
const SKINS: Record<MatchGameId, {
  character: string; title: string; introEn: string; introTl: string;
  missionEn: string; missionTl: string; items: readonly string[]; accent: string;
}> = {
  'phan-market-match': {
    character: 'PHAN', title: 'MARKET MATCH',
    introEn: 'Match market goods to fill customer orders and grow the town.',
    introTl: 'Pagparesin ang mga produkto upang makumpleto ang order sa bayan.',
    missionEn: 'Market shipments', missionTl: 'Mga ipinapadalang produkto',
    items: ['🥖', '🍎', '🧺', '🪵', '🪙'], accent: '#f7ce94',
  },
  'jawo-nature-match': {
    character: 'JAWO', title: 'NATURE MATCH',
    introEn: 'Restore forest habitats by matching plants and creatures.',
    introTl: 'Ibalik ang ganda ng gubat sa pagtutugma ng halaman at hayop.',
    missionEn: 'Habitat restoration', missionTl: 'Pagpapanumbalik ng gubat',
    items: ['🌿', '🌼', '🦋', '🍄', '🐝'], accent: '#c0e8ad',
  },
  'vhen-harvest-match': {
    character: 'VHEN', title: 'HARVEST MATCH',
    introEn: 'Harvest crops and fulfill village market orders.',
    introTl: 'Mag-ani ng pananim at kumpletuhin ang order sa palengke.',
    missionEn: 'Harvest orders', missionTl: 'Mga order sa ani',
    items: ['🌾', '🥕', '🍅', '🌽', '🍇'], accent: '#f2d896',
  },
};
const MAX_RETRY = 3;
const at = (cell: MatchCell) => cell.row + ':' + cell.col;

export function MatchThreeGameV1({ gameId, onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const skin = SKINS[gameId];
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [run, setRun] = useState<MatchRound>(() => createMatch3Round(gameId, 0));
  const runRef = useRef(run);
  const [selected, setSelected] = useState<MatchCell | null>(null);
  const selectedRef = useRef<MatchCell | null>(null);
  const [hintCells, setHintCells] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [hints, setHints] = useState(0);
  const hintsRef = useRef(0);
  const [retry, setRetry] = useState(0);
  const retryRef = useRef(0);
  const [notice, setNotice] = useState('');
  const [lastMatch, setLastMatch] = useState(0);
  const sessionRef = useRef('');
  const finishedRef = useRef(false);
  const changePhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
  const levelSetup = useCallback((index: number, keepRetry = false) => {
    const next = createMatch3Round(gameId, index);
    runRef.current = next; setRun(next);
    setLevel(index);
    selectedRef.current = null; setSelected(null); setHintCells([]);
    setLastMatch(0);
    if (!keepRetry) { retryRef.current = 0; setRetry(0); }
    changePhase('playing');
    setNotice(t('Tap two adjacent pieces to swap. Only swaps making a match are allowed.',
      'I-tap ang dalawang magkatabing piraso. Dapat makabuo ng 3 o higit pang magkatulad.'));
    void playBuklodGameFeedback('move');
  }, [gameId, t]);
  const start = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0; hintsRef.current = 0;
    setScore(0); setHints(0);
    sessionRef.current = 'm3-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    levelSetup(0);
  }, [levelSetup]);
  const finish = useCallback((status: 'won' | 'lost', points: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    changePhase(status);
    const stars = status === 'lost' ? 0 : hintsRef.current === 0 ? 3 : hintsRef.current <= 2 ? 2 : 1;
    onFinish?.({
      gameId, status, score: points,
      stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
    }, sessionRef.current);
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
  }, [gameId, onFinish]);
  const swap = useCallback((a: MatchCell, b: MatchCell) => {
    if (phaseRef.current !== 'playing') return;
    const before = runRef.current;
    const after = performMatch3Swap(before, a, b);
    selectedRef.current = null; setSelected(null);
    setHintCells([]);
    if (after === before) {
      setNotice(t('No match. Try a different adjacent swap.', 'Walang nabuo. Pumili ng ibang magkatabing piraso.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    runRef.current = after;
    setRun(after);
    const matched = after.collected.reduce((sum, value, i) => sum + value - before.collected[i], 0);
    setLastMatch(matched);
    void playBuklodGameFeedback('collect');
    if (after.status === 'won') {
      const final = scoreRef.current + after.score + after.movesLeft * 75;
      scoreRef.current = final; setScore(final);
      if (level === MATCH_LEVELS[gameId].length - 1) finish('won', final);
      else { changePhase('levelClear'); void playBuklodGameFeedback('success'); }
      return;
    }
    if (after.status === 'lost') {
      const nextRetry = retryRef.current + 1;
      retryRef.current = nextRetry; setRetry(nextRetry);
      if (nextRetry >= MAX_RETRY) finish('lost', scoreRef.current + after.score);
      else changePhase('retry');
      return;
    }
    setNotice(matched > 3 ? t('Great combo! Multiple pieces collected.', 'Ang galing! Maraming piraso ang nakolekta.')
      : t('Good match! Keep collecting the target goods.', 'Ayos! Ipagpatuloy ang pagkolekta ng mga target.'));
  }, [finish, gameId, level, t]);
  const pick = useCallback((cell: MatchCell) => {
    if (phaseRef.current !== 'playing') return;
    const first = selectedRef.current;
    if (!first || at(first) === at(cell)) {
      selectedRef.current = first && at(first) === at(cell) ? null : cell;
      setSelected(selectedRef.current);
      void playBuklodGameFeedback('move');
      return;
    }
    if (Math.abs(first.row - cell.row) + Math.abs(first.col - cell.col) !== 1) {
      selectedRef.current = cell;
      setSelected(cell);
      return;
    }
    swap(first, cell);
  }, [swap]);
  const hint = useCallback(() => {
    if (phaseRef.current !== 'playing' || hintCells.length) return;
    const first = match3LegalSwaps(runRef.current.board)[0];
    if (!first) return;
    hintsRef.current++;
    setHints(hintsRef.current);
    setHintCells([at(first.from), at(first.to)]);
    setNotice(t('Two highlighted cells can make a match.', 'Puwedeng pagpalitin ang dalawang naka-highlight na cell.'));
    void playBuklodGameFeedback('move');
  }, [hintCells.length, t]);
  const done = phase === 'won' || phase === 'lost';
  return <View style={s.root}>
    <View style={s.header}>
      <View><Text style={[s.eyebrow, { color: skin.accent }]}>{skin.character} • KINGDOM MATCH WORLD</Text>
        <Text style={s.title}>{skin.title}</Text>
        <Text style={s.subtitle}>{t(skin.introEn, skin.introTl)}</Text>
      </View>
      <View style={s.scoreCard}><Text style={s.score}>{score + (phase === 'playing' || phase === 'paused' ? run.score : 0)}</Text><Text style={s.scoreCaption}>MASTERY</Text></View>
    </View>
    {phase === 'ready' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t(skin.missionEn, skin.missionTl)}</Text>
        <Text style={s.body}>{t('Complete three levels of collection orders. Swap adjacent pieces to form three or more in a row or column. Chain reactions count, but only successful swaps spend moves. Aim to collect every target before the moves run out. A hint shows a possible move. You have up to three attempts per level.',
          'Kumpletuhin ang tatlong level. Pagpalitin ang magkatabing piraso upang makabuo ng tatlo o higit pang magkakapareho. Puwedeng magkadena ang matches. Ang matagumpay lang na swap ang bawas sa moves. May hint at hanggang tatlong subok bawat level.')}</Text>
        <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('START MATCH GAME', 'SIMULAN ANG LARO')}</Text></Pressable>
      </View>
    ) : done ? (
      <View style={s.panel}><Text style={s.panelTitle}>{phase === 'won' ? t('ALL ORDERS COMPLETE!', 'KUMPLETO ANG LAHAT!') : t('ROUND ENDED', 'TAPOS ANG ROUND')}</Text>
        <Text style={s.finalScore}>{score + (phase === 'lost' ? run.score : 0)}</Text>
        <Text style={s.body}>{t('Local game score only. No BUKLOD Character Points, cash or redeemable rewards were given.',
          'Lokal na score ng laro lamang. Walang Character Points, cash o redeemable reward.')}</Text>
        <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
      </View>
    ) : phase === 'paused' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
        <Pressable onPress={() => changePhase('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
      </View>
    ) : phase === 'levelClear' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('ORDER COMPLETED!', 'NAKUMPLETO ANG ORDER!')}</Text>
        <Text style={s.body}>{t('Your score carries forward into the next order.', 'Ang naipong score ay dala sa susunod na order.')}</Text>
        <Pressable onPress={() => levelSetup(level + 1)} style={s.primary}><Text style={s.primaryText}>{t('NEXT LEVEL', 'SUSUNOD NA LEVEL')}</Text></Pressable>
      </View>
    ) : phase === 'retry' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('NO MOVES LEFT', 'UBOS NA ANG GALAW')}</Text>
        <Text style={s.body}>{t('Try another strategy for the same target.', 'Subukan ang ibang diskarte sa parehong target.')} {retry}/{MAX_RETRY}</Text>
        <Pressable onPress={() => levelSetup(level, true)} style={s.primary}><Text style={s.primaryText}>{t('RETRY THIS ORDER', 'SUBUKAN MULI')}</Text></Pressable>
      </View>
    ) : (
      <>
        <View style={s.statBar}>
          <Text style={s.stat}>{t('LEVEL', 'LEVEL')} {level + 1}/3</Text>
          <Text style={s.stat}>{t('MOVES', 'GALAW')} {run.movesLeft}</Text>
          <Text style={s.stat}>{t('COMBOS', 'KADENA')} {run.cascades}</Text>
          <Pressable style={s.minorButton} onPress={() => changePhase('paused')}><Text style={s.minorText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
        </View>
        <View style={s.goalRow}>
          {run.goals.map((needed, index) => needed ? <View key={index} style={s.goal}>
            <Text style={s.goalEmoji}>{skin.items[index]}</Text>
            <Text style={[s.goalProgress, run.collected[index] >= needed && s.goalDone]}>
              {Math.min(needed, run.collected[index])}/{needed}
            </Text>
          </View> : null)}
        </View>
        <View style={s.board}>
          {run.board.map((row, r) => <View key={r} style={s.boardRow}>
            {row.map((tile, c) => {
              const key = r + ':' + c;
              const isSelected = selected && at(selected) === key;
              const isHint = hintCells.includes(key);
              return <Pressable key={c} accessibilityRole="button"
                accessibilityLabel={t('Row', 'Hanay') + ' ' + (r + 1) + ', ' + t('column', 'kolum') + ' ' + (c + 1) + ', ' + skin.items[tile]}
                accessibilityState={{ selected: !!isSelected }}
                onPress={() => pick({ row: r, col: c })}
                style={[s.cell, isSelected && s.selectedCell, isHint && s.hintedCell]}>
                <Text style={s.piece}>{skin.items[tile]}</Text>
              </Pressable>;
            })}
          </View>)}
        </View>
        <View style={s.controls}>
          <Pressable onPress={hint} disabled={hintCells.length > 0} style={[s.minorButton, hintCells.length > 0 && s.disabled]}>
            <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#ffe4a5" />
            <Text style={s.minorText}>{t('SHOW MOVE', 'PAKITA GALAW')} ({hints})</Text>
          </Pressable>
          {lastMatch > 3 && <Text style={s.combo}>+{lastMatch} {t('PIECES!', 'PIRASO!')}</Text>}
        </View>
        {!!notice && <Text style={s.notice}>{notice}</Text>}
      </>
    )}
  </View>;
}
const s = StyleSheet.create({
  root: { maxWidth: 790, width: '100%', alignSelf: 'center', padding: 12, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: .7 },
  title: { color: '#fff1d9', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#dde5d7', fontSize: 12, lineHeight: 18, maxWidth: 250 },
  scoreCard: { alignItems: 'center', padding: 9, borderRadius: 12, borderWidth: 1, borderColor: '#c5ae80', backgroundColor: '#2b4c4e' },
  score: { color: '#ffe4a8', fontSize: 23, fontWeight: '900' },
  scoreCaption: { color: '#d1d3bb', fontSize: 9, fontWeight: '900' },
  panel: { borderRadius: 16, padding: 18, backgroundColor: '#263f49', borderWidth: 1, borderColor: '#93b3a4', gap: 14 },
  panelTitle: { color: '#fff0c9', fontSize: 22, fontWeight: '900' },
  body: { color: '#dce8e3', fontSize: 13, lineHeight: 21 },
  primary: { borderRadius: 11, backgroundColor: '#e6d39d', padding: 14, alignItems: 'center' },
  primaryText: { color: '#294145', fontSize: 12, fontWeight: '900' },
  finalScore: { color: '#ffe4a8', fontSize: 43, fontWeight: '900' },
  statBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  stat: { color: '#e3edda', fontSize: 11, fontWeight: '900' },
  minorButton: { flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: '#bbc8ac', backgroundColor: '#274e55' },
  minorText: { color: '#fff0d1', fontSize: 10, fontWeight: '900' },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9 },
  goal: { flexDirection: 'row', gap: 5, alignItems: 'center', padding: 7, backgroundColor: '#234a4c', borderWidth: 1, borderColor: '#90b6a5', borderRadius: 8 },
  goalEmoji: { fontSize: 22 },
  goalProgress: { color: '#f7e7cb', fontSize: 12, fontWeight: '900' },
  goalDone: { color: '#b5ecb0' },
  board: { maxWidth: 493, alignSelf: 'center', width: '100%', gap: 3, padding: 7, borderRadius: 14, backgroundColor: '#1d3a49', borderWidth: 2, borderColor: '#b2c39f' },
  boardRow: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 7, backgroundColor: '#52746d', borderWidth: 1, borderColor: '#729383', justifyContent: 'center', alignItems: 'center' },
  selectedCell: { borderWidth: 3, borderColor: '#ffedab', backgroundColor: '#7a8356' },
  hintedCell: { borderWidth: 2, borderColor: '#a7ebf7', backgroundColor: '#387f8f' },
  piece: { fontSize: 24 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  disabled: { opacity: .48 },
  combo: { color: '#ffe09e', fontWeight: '900', fontSize: 12 },
  notice: { textAlign: 'center', color: '#deefdc', fontSize: 12, lineHeight: 19 },
});
