import React, { useCallback, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import {
  VAULT_LEVELS, applyVaultMove, createVaultRound, type VaultOperator, type VaultRound,
} from './numberVaultRules';

const GAME_ID = 'angel-number-vault';
const MAX_RETRIES = 3;
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
type Phase = 'ready' | 'playing' | 'paused' | 'retry' | 'levelClear' | 'won' | 'lost';
const OPERATORS: VaultOperator[] = ['+', '-', '×', '÷'];

export function NumberVaultGameV1({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [run, setRun] = useState<VaultRound>(() => createVaultRound(0));
  const runRef = useRef(run);
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const stackRef = useRef<VaultRound[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const scoreRef = useRef(0);
  const [usedHints, setUsedHints] = useState(0);
  const hintsRef = useRef(0);
  const [showHint, setShowHint] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [notice, setNotice] = useState('');
  const receiptRef = useRef('');
  const completedRef = useRef(false);
  const setGamePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  const resetLevel = useCallback((nextLevel: number, keepRetries = false) => {
    const fresh = createVaultRound(nextLevel);
    runRef.current = fresh;
    setRun(fresh);
    setLevel(nextLevel);
    selectedRef.current = [];
    setSelected([]);
    stackRef.current = [];
    setUndoCount(0);
    setShowHint(false);
    if (!keepRetries) setRetryCount(0);
    setNotice(t('Choose two tiles in order, then combine them using an operation.', 'Pumili ng dalawang numero nang sunod, saka pag-isahin gamit ang operation.'));
    setGamePhase('playing');
    void playBuklodGameFeedback('move');
  }, [t]);

  const start = useCallback(() => {
    receiptRef.current = 'nv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    completedRef.current = false;
    scoreRef.current = 0; hintsRef.current = 0;
    setTotalScore(0); setUsedHints(0);
    resetLevel(0);
  }, [resetLevel]);

  const finish = useCallback((status: 'won' | 'lost', points: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setGamePhase(status);
    const stars = status === 'lost' ? 0 : hintsRef.current === 0 ? 3 : hintsRef.current <= 1 ? 2 : 1;
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
    onFinish?.({
      gameId: GAME_ID, status, score: points,
      stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
    }, receiptRef.current);
  }, [onFinish]);

  const pick = useCallback((id: number) => {
    if (phaseRef.current !== 'playing') return;
    const before = selectedRef.current;
    const next = before.includes(id) ? before.filter(x => x !== id) : before.length < 2 ? [...before, id] : [id];
    selectedRef.current = next;
    setSelected(next);
    void playBuklodGameFeedback('move');
  }, []);

  const apply = useCallback((operation: VaultOperator) => {
    if (phaseRef.current !== 'playing') return;
    const [a, b] = selectedRef.current;
    if (a == null || b == null) {
      setNotice(t('Select two different tiles first.', 'Pumili muna ng dalawang magkaibang numero.'));
      return;
    }
    const previous = runRef.current;
    let next: VaultRound;
    try { next = applyVaultMove(previous, a, b, operation); }
    catch {
      setNotice(t('That operation is not allowed. Division must have a whole-number result.', 'Hindi puwede ang operation na iyan. Dapat buong numero ang sagot sa division.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    stackRef.current.push(previous);
    setUndoCount(stackRef.current.length);
    runRef.current = next;
    setRun(next);
    selectedRef.current = [];
    setSelected([]);
    void playBuklodGameFeedback('collect');
    if (next.status === 'won') {
      const gained = Math.max(300, next.score - (showHint ? 120 : 0));
      scoreRef.current += gained;
      setTotalScore(scoreRef.current);
      setNotice(t('Vault unlocked! Your arithmetic is correct.', 'Nabuksan ang vault! Tama ang pagkukuwenta.'));
      if (level === VAULT_LEVELS.length - 1) finish('won', scoreRef.current);
      else setGamePhase('levelClear');
    } else if (next.status === 'lost') {
      const attempt = retryCount + 1;
      setRetryCount(attempt);
      setNotice(t('The final number missed the target.', 'Hindi naabot ng huling numero ang target.'));
      if (attempt >= MAX_RETRIES) finish('lost', scoreRef.current);
      else setGamePhase('retry');
      void playBuklodGameFeedback('impact');
    }
  }, [finish, level, retryCount, showHint, t]);

  const undo = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const previous = stackRef.current.pop();
    if (!previous) return;
    runRef.current = previous;
    setRun(previous);
    setUndoCount(stackRef.current.length);
    selectedRef.current = [];
    setSelected([]);
    void playBuklodGameFeedback('move');
  }, []);
  const revealHint = useCallback(() => {
    if (phaseRef.current !== 'playing' || showHint) return;
    hintsRef.current++;
    setUsedHints(hintsRef.current);
    setShowHint(true);
    void playBuklodGameFeedback('move');
  }, [showHint]);

  return <View style={s.shell}>
    <View style={s.heading}>
      <View><Text style={s.eyebrow}>ANGEL • TREASURY CITY</Text>
        <Text style={s.title}>NUMBER VAULT</Text>
        <Text style={s.subtitle}>{t('Crack the vault by combining numbers.', 'Buksan ang vault sa pamamagitan ng mga numero.')}</Text>
      </View>
      <View style={s.scoreBox}><Text style={s.score}>{totalScore}</Text><Text style={s.scoreLabel}>MASTERY</Text></View>
    </View>
    {phase === 'ready' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('Three sealed number vaults', 'Tatlong nakasarang number vault')}</Text>
        <Text style={s.body}>{t('Use every number tile exactly once. Select two tiles, then +, −, × or ÷ to combine them. Keep combining until only one number remains. That number must equal the vault target. Division is legal only for exact whole-number results. You can undo and reveal one solution hint per level. You get three attempts per vault.', 'Gamitin ang bawat numero nang eksaktong isang beses. Pumili ng dalawang tile at +, −, × o ÷. Pag-isahin hanggang isa na lang ang natira, na dapat katumbas ng target. Puwede lang ang division na buong numero ang resulta. May Undo at isang hint bawat level. May tatlong pagtatangka bawat vault.')}</Text>
        <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('OPEN NUMBER VAULT', 'BUKSAN ANG NUMBER VAULT')}</Text></Pressable>
      </View>
    ) : phase === 'won' || phase === 'lost' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{phase === 'won' ? t('ALL THREE VAULTS OPEN!', 'BUKAS NA ANG LAHAT NG VAULT!') : t('NO ATTEMPTS LEFT', 'UBOS NA ANG MGA PAGKAKATAON')}</Text>
        <Text style={s.finalScore}>{totalScore}</Text>
        <Text style={s.body}>{t('Game-only mastery. No redeemable points or cash were awarded.', 'Mastery score ng laro lamang. Walang redeemable points o cash reward.')}</Text>
        <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
      </View>
    ) : phase === 'paused' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
        <Pressable style={s.primary} onPress={() => setGamePhase('playing')}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
      </View>
    ) : phase === 'levelClear' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('VAULT UNLOCKED!', 'NABUKSAN ANG VAULT!')}</Text>
        <Text style={s.body}>{t('You solved this puzzle. Another locked chamber awaits.', 'Nalutas ang puzzle. May isa pang silid na naghihintay.')}</Text>
        <Pressable style={s.primary} onPress={() => resetLevel(level + 1)}><Text style={s.primaryText}>{t('NEXT VAULT', 'SUSUNOD NA VAULT')}</Text></Pressable>
      </View>
    ) : phase === 'retry' ? (
      <View style={s.panel}><Text style={s.panelTitle}>{t('NOT QUITE THE TARGET', 'HINDI PA TAMA ANG TARGET')}</Text>
        <Text style={s.body}>{t('Try a different sequence of operations.', 'Subukan ang ibang pagkakasunod ng operasyon.')} {retryCount}/{MAX_RETRIES}</Text>
        <Pressable style={s.primary} onPress={() => resetLevel(level, true)}><Text style={s.primaryText}>{t('TRY THIS VAULT AGAIN', 'SUBUKAN MULI ANG VAULT')}</Text></Pressable>
      </View>
    ) : (
      <>
        <View style={s.stats}>
          <Text style={s.stat}>{t('VAULT', 'VAULT')} {level + 1}/{VAULT_LEVELS.length}</Text>
          <Text style={s.stat}>{t('TRIES', 'SUBOK')}: {retryCount}/{MAX_RETRIES}</Text>
          <Text style={s.stat}>{t('HINTS', 'TULONG')}: {usedHints}</Text>
          <Pressable onPress={() => setGamePhase('paused')} style={s.minor}><Text style={s.minorText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
        </View>
        <View style={s.targetCard}>
          <Text style={s.targetCaption}>{t('TARGET NUMBER', 'TARGET NA NUMERO')}</Text>
          <Text style={s.target}>{run.target}</Text>
          <MaterialCommunityIcons name="safe" color="#f2d69f" size={37} />
        </View>
        <Text style={s.instruction}>{t('SELECT TWO TILES IN ORDER', 'PUMILI NG DALAWANG TILE NANG SUNOD')}</Text>
        <View style={s.tiles}>
          {run.tiles.map(tile => <Pressable key={tile.id} accessibilityRole="button"
            accessibilityLabel={t('Number', 'Numero') + ' ' + tile.value}
            accessibilityState={{ selected: selected.includes(tile.id) }}
            onPress={() => pick(tile.id)} style={[s.tile, selected.includes(tile.id) && s.tileSelected]}>
            <Text style={s.number}>{tile.value}</Text>
          </Pressable>)}
        </View>
        <View style={s.ops}>
          {OPERATORS.map(op => <Pressable key={op} accessibilityRole="button"
            accessibilityLabel={t('Calculate', 'Kuwentahin') + ' ' + op}
            onPress={() => apply(op)} style={s.opButton}>
            <Text style={s.opText}>{op}</Text>
          </Pressable>)}
        </View>
        <View style={s.actions}>
          <Pressable disabled={!undoCount} style={[s.minor, !undoCount && s.disabled]} onPress={undo}>
            <Text style={s.minorText}>{t('UNDO', 'BAWI')} ({undoCount})</Text>
          </Pressable>
          <Pressable disabled={showHint} style={[s.minor, showHint && s.disabled]} onPress={revealHint}>
            <Text style={s.minorText}>{t('HINT', 'TULONG')}</Text>
          </Pressable>
        </View>
        {showHint && <Text style={s.hint}>{t('One possible solution', 'Isang posibleng solusyon')}: {VAULT_LEVELS[level].hint}</Text>}
        {!!notice && <Text style={s.notice}>{notice}</Text>}
      </>
    )}
  </View>;
}
const s = StyleSheet.create({
  shell: { width: '100%', maxWidth: 810, alignSelf: 'center', padding: 12, gap: 13 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 9, alignItems: 'center' },
  eyebrow: { color: '#efdebc', fontSize: 10, letterSpacing: .8, fontWeight: '900' },
  title: { color: '#fff1d1', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#dcddcf', fontSize: 12 },
  scoreBox: { alignItems: 'center', padding: 10, borderRadius: 11, backgroundColor: '#3b393b', borderColor: '#dbbe85', borderWidth: 1 },
  score: { color: '#f6db9d', fontSize: 22, fontWeight: '900' },
  scoreLabel: { color: '#d5c8aa', fontSize: 9, fontWeight: '800' },
  panel: { borderWidth: 1, borderRadius: 15, borderColor: '#af9c76', backgroundColor: '#333b3c', padding: 18, gap: 13 },
  panelTitle: { fontSize: 21, color: '#fbeac1', fontWeight: '900' },
  body: { color: '#e1e4dc', fontSize: 13, lineHeight: 21 },
  primary: { borderRadius: 11, backgroundColor: '#e6ce9a', padding: 14, alignItems: 'center' },
  primaryText: { color: '#373a35', fontSize: 12, fontWeight: '900' },
  finalScore: { color: '#f9d989', fontSize: 42, fontWeight: '900' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stat: { color: '#f1e2bf', fontWeight: '900', fontSize: 11 },
  minor: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, borderColor: '#b9a47d', borderWidth: 1 },
  minorText: { color: '#f6e6c8', fontWeight: '900', fontSize: 10 },
  targetCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 21, padding: 15, borderRadius: 14, borderWidth: 2, borderColor: '#d4b57c', backgroundColor: '#394848' },
  targetCaption: { color: '#e9ddbc', fontSize: 11, fontWeight: '900' },
  target: { color: '#ffe09f', fontSize: 44, fontWeight: '900' },
  instruction: { color: '#eee0bf', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, minHeight: 81 },
  tile: { width: 69, height: 76, borderRadius: 12, borderWidth: 2, borderColor: '#d2bf96', backgroundColor: '#456369', alignItems: 'center', justifyContent: 'center' },
  tileSelected: { backgroundColor: '#9c8453', borderColor: '#fff5c5' },
  number: { fontSize: 30, fontWeight: '900', color: '#fff4db' },
  ops: { flexDirection: 'row', justifyContent: 'center', gap: 11 },
  opButton: { width: 58, height: 56, borderRadius: 13, borderWidth: 1, borderColor: '#e9d09f', backgroundColor: '#5a645e', alignItems: 'center', justifyContent: 'center' },
  opText: { color: '#fff2c9', fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 11, justifyContent: 'center' },
  disabled: { opacity: .35 },
  hint: { textAlign: 'center', color: '#f5ddae', fontSize: 13, fontWeight: '700' },
  notice: { color: '#d9e0ce', textAlign: 'center', fontSize: 12, lineHeight: 19 },
});
