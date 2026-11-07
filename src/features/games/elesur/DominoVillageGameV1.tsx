import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import {
  DOMINO_ROUNDS, DOMINO_TILES, createDominoRound, dominoLegalMoves,
  drawDomino, passDomino, playDomino, takeDominoAiTurn,
  type DominoRound, type DominoSide,
} from './dominoRules';

const GAME_ID = 'elesur-domino-village';
type Phase = 'ready' | 'playing' | 'paused' | 'roundEnd' | 'won' | 'lost';
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
const DOTS: readonly (readonly number[])[] = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8],
];

function DominoHalf({ value }: { value: number }) {
  return <View style={styles.half}>
    {Array.from({ length: 9 }, (_, i) => <View key={i} style={styles.dotSquare}>
      {DOTS[value]?.includes(i) && <View style={styles.dot} />}
    </View>)}
  </View>;
}

function DominoFace({ a, b, selected = false }: { a: number; b: number; selected?: boolean }) {
  return <View style={[styles.domino, selected && styles.dominoSelected]}>
    <DominoHalf value={a} />
    <View style={styles.centerLine} />
    <DominoHalf value={b} />
  </View>;
}

export function DominoVillageGameV1({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [roundNumber, setRoundNumber] = useState(0);
  const [round, setRound] = useState<DominoRound | null>(null);
  const roundRef = useRef<DominoRound | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [humanTotal, setHumanTotal] = useState(0);
  const [opponentTotal, setOpponentTotal] = useState(0);
  const humanRef = useRef(0);
  const opponentRef = useRef(0);
  const winsRef = useRef(0);
  const finishedRef = useRef(false);
  const sessionRef = useRef('');
  const [message, setMessage] = useState('');

  const setGamePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  const beginRound = useCallback((nextRound: number) => {
    let fresh = createDominoRound(nextRound);
    if (fresh.turn === 1) fresh = takeDominoAiTurn(fresh);
    roundRef.current = fresh;
    setRound(fresh);
    setRoundNumber(nextRound);
    selectedRef.current = null;
    setSelectedId(null);
    setGamePhase('playing');
    setMessage(t('Select one of your tiles and place it on the matching LEFT or RIGHT endpoint.', 'Pumili ng domino sa iyong kamay at ilagay sa tumutugmang KALIWA o KANANG dulo.'));
    void playBuklodGameFeedback('move');
  }, [t]);

  const start = useCallback(() => {
    sessionRef.current = 'dv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 13);
    finishedRef.current = false;
    humanRef.current = 0; opponentRef.current = 0; winsRef.current = 0;
    setHumanTotal(0); setOpponentTotal(0);
    beginRound(0);
  }, [beginRound]);

  const recordRound = useCallback((completed: DominoRound) => {
    if (!completed.winner) return;
    const nextHuman = humanRef.current + completed.award.human;
    const nextAi = opponentRef.current + completed.award.ai;
    humanRef.current = nextHuman;
    opponentRef.current = nextAi;
    setHumanTotal(nextHuman);
    setOpponentTotal(nextAi);
    if (completed.winner === 'human') winsRef.current++;
    setGamePhase('roundEnd');
    if (roundNumber === DOMINO_ROUNDS - 1 && !finishedRef.current) {
      finishedRef.current = true;
      const victory = nextHuman > nextAi;
      const stars = victory ? (winsRef.current === 3 ? 3 : winsRef.current >= 2 ? 2 : 1) : 0;
      setGamePhase(victory ? 'won' : 'lost');
      void playBuklodGameFeedback(victory ? 'success' : 'failure');
      onFinish?.({
        gameId: GAME_ID, status: victory ? 'won' : 'lost', score: nextHuman,
        stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
      }, sessionRef.current);
    } else {
      void playBuklodGameFeedback(completed.winner === 'human' ? 'success' : 'impact');
    }
  }, [onFinish, roundNumber]);

  const advance = useCallback((state: DominoRound) => {
    let next = state;
    if (!next.winner && next.turn === 1) next = takeDominoAiTurn(next);
    roundRef.current = next;
    setRound(next);
    selectedRef.current = null;
    setSelectedId(null);
    if (next.winner) recordRound(next);
    else setMessage(t('Your turn. Read the chain endpoints and choose a legal tile.', 'Ikaw naman. Tingnan ang mga dulo ng chain at pumili ng legal na piraso.'));
  }, [recordRound, t]);

  const play = useCallback((side: DominoSide) => {
    const current = roundRef.current;
    const id = selectedRef.current;
    if (!current || phaseRef.current !== 'playing' || current.turn !== 0 || id == null) return;
    if (!dominoLegalMoves(current, 0).some(move => move.id === id && move.side === side)) {
      setMessage(t('This tile cannot match that endpoint. Try the other side or tile.', 'Hindi tumutugma ang piraso sa dulong iyon. Pumili ng ibang panig o domino.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    const next = playDomino(current, 0, id, side);
    void playBuklodGameFeedback('collect');
    advance(next);
  }, [advance, t]);

  const drawOrPass = useCallback(() => {
    const current = roundRef.current;
    if (!current || phaseRef.current !== 'playing' || current.turn !== 0 || dominoLegalMoves(current, 0).length) return;
    const next = current.stock.length ? drawDomino(current, 0) : passDomino(current, 0);
    void playBuklodGameFeedback('move');
    if (next.turn === 0 && !next.winner) {
      roundRef.current = next;
      setRound(next);
      setMessage(t('Draw again until a tile fits, or continue once you can play.', 'Bumunot muli hangga’t walang kasya, o ilagay ang domino kung mayroon nang kasya.'));
    } else {
      advance(next);
    }
  }, [advance, t]);

  const selectedMoves = round && selectedId !== null
    ? dominoLegalMoves(round, 0).filter(m => m.id === selectedId) : [];
  const humanMoves = round ? dominoLegalMoves(round, 0) : [];
  const completed = phase === 'won' || phase === 'lost';
  const isDraw = completed && humanTotal === opponentTotal;

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ELESUR • HIGHLAND COMMUNITY</Text>
          <Text style={styles.title}>DOMINO VILLAGE</Text>
          <Text style={styles.sub}>{t('Classic double-six draw dominoes with a village opponent.', 'Double-six domino laban sa kalabang taga-pamayanan.')}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.score}>{humanTotal} : {opponentTotal}</Text>
          <Text style={styles.scoreLabel}>{t('YOU : VILLAGE', 'IKAW : KALABAN')}</Text>
        </View>
      </View>
      {phase === 'ready' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t('Three rounds. Build the strongest chain.', 'Tatlong round. Bumuo ng magandang domino chain.')}</Text>
          <Text style={styles.body}>{t('Double-six set: 28 unique tiles. Both players receive 7, while 14 remain in stock. The highest held double opens the chain. Match either end to place a tile. If you have no matching tile, draw until one fits; pass only when stock is empty. Empty your hand to win, or win a blocked round by holding fewer pips. Your round score is the other player’s remaining pip sum.', 'May 28 magkakaibang domino. Tig-7 ang bawat player at 14 sa stock. Ang may pinakamataas na double ang magbubukas. Itugma ang domino sa kaliwa o kanang dulo. Kapag walang kasya, bumunot hanggang may kasya; maaari lamang mag-pass kapag ubos ang stock. Magwawagi ang unang maubusan ng hawak o ang may mas kaunting puntos kapag parehong walang maigalaw.')}</Text>
          <Pressable style={styles.primary} onPress={start}><Text style={styles.primaryText}>{t('START DOMINOES', 'SIMULAN ANG DOMINO')}</Text></Pressable>
        </View>
      ) : completed ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{isDraw ? t('TOURNAMENT DRAW', 'TABLA ANG LARO') : phase === 'won' ? t('VILLAGE CHAMPION!', 'KAMPEON NG PAMAYANAN!') : t('THE VILLAGE WINS THIS TIME', 'PANALO ANG KALABAN NGAYON')}</Text>
          <Text style={styles.bigScore}>{humanTotal} : {opponentTotal}</Text>
          <Text style={styles.body}>{t('Game-only score. No automatic BUKLOD Character Points or redeemable rewards.', 'Score lamang ito ng laro. Walang awtomatikong Character Points o cash reward.')}</Text>
          <Pressable style={styles.primary} onPress={start}><Text style={styles.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'paused' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t('Game paused', 'Naka-pause ang laro')}</Text>
          <Pressable style={styles.primary} onPress={() => setGamePhase('playing')}><Text style={styles.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : phase === 'roundEnd' && round ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{round.winner === 'human' ? t('ROUND WON!', 'PANALO SA ROUND!') : round.winner === 'draw' ? t('BLOCKED ROUND DRAW', 'TABLA ANG ROUND') : t('OPPONENT WON THE ROUND', 'PANALO ANG KALABAN SA ROUND')}</Text>
          <Text style={styles.body}>{t('Round score', 'Puntos sa round')}: {round.award.human} : {round.award.ai}. {t('The three-round total decides the championship.', 'Sa kabuuan ng tatlong round nakabatay ang panalo.')}</Text>
          <Pressable style={styles.primary} onPress={() => beginRound(roundNumber + 1)}><Text style={styles.primaryText}>{t('NEXT ROUND', 'SUSUNOD NA ROUND')}</Text></Pressable>
        </View>
      ) : round ? (
        <>
          <View style={styles.stats}>
            <Text style={styles.statText}>{t('ROUND', 'ROUND')} {roundNumber + 1}/{DOMINO_ROUNDS}</Text>
            <Text style={styles.statText}>{t('STOCK', 'NATITIRANG DOMINO')}: {round.stock.length}</Text>
            <Text style={styles.statText}>{t('OPPONENT', 'KALABAN')}: {round.hands[1].length} {t('tiles', 'domino')}</Text>
            <Pressable style={styles.smallButton} onPress={() => setGamePhase('paused')}><Text style={styles.smallText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          <Text style={styles.boardTitle}>{t('VILLAGE CHAIN', 'DOMINO CHAIN')}</Text>
          <ScrollView horizontal style={styles.chainScroll} contentContainerStyle={styles.chain} showsHorizontalScrollIndicator>
            {round.chain.map((tile, index) => <View key={tile.id} style={styles.chainPiece}>
              {index === 0 ? <Text style={styles.endLabel}>{round.chain[0].left}</Text> : null}
              <DominoFace a={tile.left} b={tile.right} />
              {index === round.chain.length - 1 ? <Text style={styles.endLabel}>{tile.right}</Text> : null}
            </View>)}
          </ScrollView>
          <Text style={styles.endpoints}>{t('LEFT END', 'KALIWA')}: {round.chain[0].left}
            {'  •  '}{t('RIGHT END', 'KANAN')}: {round.chain[round.chain.length - 1].right}</Text>
          <Text style={styles.boardTitle}>{t('YOUR TILES', 'IYONG MGA DOMINO')} ({round.hands[0].length})</Text>
          <View style={styles.hand}>
            {round.hands[0].map(id => {
              const tile = DOMINO_TILES[id];
              const legal = humanMoves.some(move => move.id === id);
              return <Pressable key={id} accessibilityRole="button"
                accessibilityLabel={t('Domino tile', 'Domino') + ' ' + tile.a + '-' + tile.b}
                onPress={() => { selectedRef.current = id; setSelectedId(id); void playBuklodGameFeedback('move'); }}
                style={[styles.handPiece, selectedId === id && styles.handSelected, !legal && styles.handDisabled]}>
                <DominoFace a={tile.a} b={tile.b} selected={selectedId === id} />
              </Pressable>;
            })}
          </View>
          {humanMoves.length > 0 ? (
            <View style={styles.controls}>
              <Pressable disabled={!selectedMoves.some(move => move.side === 'left')}
                style={[styles.action, !selectedMoves.some(move => move.side === 'left') && styles.disabled]}
                onPress={() => play('left')}><Text style={styles.actionText}>{t('PLACE LEFT', 'ILAGAY SA KALIWA')}</Text></Pressable>
              <Pressable disabled={!selectedMoves.some(move => move.side === 'right')}
                style={[styles.action, !selectedMoves.some(move => move.side === 'right') && styles.disabled]}
                onPress={() => play('right')}><Text style={styles.actionText}>{t('PLACE RIGHT', 'ILAGAY SA KANAN')}</Text></Pressable>
            </View>
          ) : (
            <Pressable style={styles.primary} onPress={drawOrPass}><Text style={styles.primaryText}>{round.stock.length
              ? t('DRAW FROM STOCK', 'BUMUNOT NG DOMINO')
              : t('PASS TURN', 'IPASA ANG TURNO')}</Text></Pressable>
          )}
          <Text style={styles.message}>{message}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 14, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { color: '#b3e4d5', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  title: { color: '#f3f8e6', fontSize: 27, fontWeight: '900' },
  sub: { color: '#d7e3d5', fontSize: 12, lineHeight: 17, maxWidth: 252 },
  scoreCard: { backgroundColor: '#28463b', borderWidth: 1, borderColor: '#9eb9a6', borderRadius: 12, padding: 10, alignItems: 'center' },
  score: { color: '#f9e4b3', fontSize: 21, fontWeight: '900' },
  scoreLabel: { color: '#d0e5d5', fontSize: 9, fontWeight: '900' },
  panel: { backgroundColor: '#1e3e37', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#739b86', gap: 12 },
  panelTitle: { color: '#f7ead0', fontSize: 22, fontWeight: '900' },
  body: { color: '#e0eddf', fontSize: 14, lineHeight: 22 },
  primary: { backgroundColor: '#d7e0aa', padding: 14, borderRadius: 11, alignItems: 'center' },
  primaryText: { color: '#234136', fontSize: 12, fontWeight: '900' },
  bigScore: { color: '#fff1be', fontSize: 39, fontWeight: '900' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 9 },
  statText: { color: '#d5f2e4', fontSize: 11, fontWeight: '900' },
  smallButton: { borderRadius: 8, borderWidth: 1, borderColor: '#abc3a9', paddingHorizontal: 11, paddingVertical: 9 },
  smallText: { color: '#edf5e5', fontWeight: '900', fontSize: 10 },
  boardTitle: { color: '#f3ebc8', fontSize: 12, fontWeight: '900', letterSpacing: .6 },
  chainScroll: { width: '100%', maxHeight: 115, backgroundColor: '#294a40', borderRadius: 14, borderWidth: 1, borderColor: '#789680' },
  chain: { minWidth: '100%', padding: 13, alignItems: 'center', gap: 4 },
  chainPiece: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  endLabel: { color: '#e3e8c0', fontSize: 15, fontWeight: '900' },
  endpoints: { color: '#d8e7d4', fontSize: 12, textAlign: 'center' },
  hand: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  handPiece: { padding: 4, borderRadius: 10, backgroundColor: '#23473d', borderWidth: 2, borderColor: 'transparent' },
  handSelected: { borderColor: '#f4e2a4', backgroundColor: '#466c55' },
  handDisabled: { opacity: .42 },
  domino: { flexDirection: 'row', backgroundColor: '#fcf7e5', padding: 3, borderRadius: 8, borderWidth: 2, borderColor: '#c8b99a', alignItems: 'center' },
  dominoSelected: { borderColor: '#e1b44e' },
  half: { width: 29, height: 31, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center' },
  dotSquare: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, backgroundColor: '#274438', borderRadius: 3 },
  centerLine: { width: 1, height: 27, backgroundColor: '#8c8874' },
  controls: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  action: { borderWidth: 1, borderColor: '#c7dcae', backgroundColor: '#416b50', padding: 13, borderRadius: 11 },
  actionText: { color: '#f5f9e1', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: .35 },
  message: { color: '#e2efdd', fontSize: 12, textAlign: 'center', lineHeight: 19 },
});
