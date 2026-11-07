import React, { useCallback, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { createMazeRun, moveMaze, MAZE_SPECS, type MazeDirection, type MazeRun } from './trailMazeRules';

const GAME_ID = 'jawo-trail-maze';
type Props = { onFinish?: (result: BuklodGameResult, sessionId: string) => void };
type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'won' | 'lost';
const dirs: { direction: MazeDirection; icon: 'arrow-up-bold' | 'arrow-down-bold' | 'arrow-left-bold' | 'arrow-right-bold' }[] = [
  { direction: 'left', icon: 'arrow-left-bold' },
  { direction: 'up', icon: 'arrow-up-bold' },
  { direction: 'down', icon: 'arrow-down-bold' },
  { direction: 'right', icon: 'arrow-right-bold' },
];
export function TrailMazeGameV1({ onFinish }: Props) {
  const { t } = useBuklodGameLanguage();
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [run, setRun] = useState<MazeRun>(() => createMazeRun(0));
  const runRef = useRef(run);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(0);
  const [movesAll, setMovesAll] = useState(0);
  const movesRef = useRef(0);
  const [message, setMessage] = useState('');
  const [memo, setMemo] = useState(false);
  const [visited, setVisited] = useState<string[]>(['1:1']);
  const finishedRef = useRef(false);
  const receiptRef = useRef('');
  const changePhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
  const startLevel = useCallback((index: number) => {
    const fresh = createMazeRun(index);
    runRef.current = fresh;
    setRun(fresh);
    setLevel(index);
    setVisited(['1:1']);
    setMemo(false);
    changePhase('playing');
    setMessage(t('Follow the trails, collect all relics, then reach the gate.', 'Sundan ang daan, hanapin lahat ng relikya, saka pumunta sa labasan.'));
    void playBuklodGameFeedback('move');
  }, [t]);
  const start = useCallback(() => {
    totalRef.current = 0;
    movesRef.current = 0;
    setTotal(0);
    setMovesAll(0);
    finishedRef.current = false;
    receiptRef.current = 'mz-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    startLevel(0);
  }, [startLevel]);
  const finish = useCallback((status: 'won' | 'lost', score: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    changePhase(status);
    const stars = status === 'lost' ? 0 : movesRef.current < 190 ? 3 : movesRef.current < 310 ? 2 : 1;
    onFinish?.({
      gameId: GAME_ID, status, score,
      stars: stars as 0 | 1 | 2 | 3, reward: { xp: 0, kingdomXp: 0 },
    }, receiptRef.current);
    void playBuklodGameFeedback(status === 'won' ? 'success' : 'failure');
  }, [onFinish]);
  const travel = useCallback((direction: MazeDirection) => {
    if (phaseRef.current !== 'playing') return;
    const previous = runRef.current;
    const next = moveMaze(previous, direction);
    if (next === previous) {
      setMessage(t('A rock blocks that path.', 'May nakaharang na bato.'));
      void playBuklodGameFeedback('impact');
      return;
    }
    runRef.current = next;
    setRun(next);
    setVisited(old => old.includes(next.position.row + ':' + next.position.col)
      ? old : [...old, next.position.row + ':' + next.position.col]);
    if (next.found.length > previous.found.length) {
      setMessage(t('Forest relic found!', 'Nakakuha ng relikya!'));
      void playBuklodGameFeedback('collect');
    } else {
      void playBuklodGameFeedback('move');
      if (next.position.row === next.board.exit.row && next.position.col === next.board.exit.col &&
          next.found.length < next.board.relics.length) {
        setMessage(t('Collect all relics before leaving the forest.', 'Kunin muna lahat ng relikya bago lumabas.'));
      }
    }
    if (next.status === 'won') {
      const newTotal = totalRef.current + next.score;
      totalRef.current = newTotal;
      movesRef.current += next.moves;
      setMovesAll(movesRef.current);
      setTotal(newTotal);
      if (level === MAZE_SPECS.length - 1) finish('won', newTotal);
      else { changePhase('levelClear'); void playBuklodGameFeedback('success'); }
    } else if (next.status === 'lost') finish('lost', totalRef.current);
  }, [finish, level, t]);
  const finished = phase === 'won' || phase === 'lost';
  return (
    <View style={s.shell}>
      <View style={s.header}>
        <View><Text style={s.eyebrow}>JAWO • EXPLORER FOREST</Text><Text style={s.title}>TRAIL MAZE</Text>
          <Text style={s.subtitle}>{t('Explore the enchanted forest trails.', 'Galugarin ang mahiwagang gubat.')}</Text>
        </View>
        <View style={s.scoreCard}><Text style={s.score}>{total}</Text><Text style={s.scoreCaption}>MASTERY</Text></View>
      </View>
      {phase === 'ready' ? (
        <View style={s.card}><Text style={s.cardTitle}>{t('Find the safe path', 'Hanapin ang ligtas na daan')}</Text>
          <Text style={s.body}>{t('Navigate three unique forest mazes. Collect every glowing relic before reaching the exit. You may revisit paths; walk efficiently to earn a high score. Use arrows to move and the trail-memory toggle to show where you have explored.', 'Tatlong maze ang lalakbayin. Kolektahin lahat ng relikya bago makalabas. Puwedeng balikan ang mga daan; mas magandang score kapag mas maikli ang ruta. Gamitin ang arrows at trail-memory button.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('ENTER THE FOREST', 'PASUKIN ANG GUBAT')}</Text></Pressable>
        </View>
      ) : finished ? (
        <View style={s.card}><Text style={s.cardTitle}>{phase === 'won' ? t('FOREST EXPLORER!', 'BAYANI NG KAGUBATAN!') : t('JOURNEY ENDED', 'TAPOS ANG PAGLALAKBAY')}</Text>
          <Text style={s.bigScore}>{total}</Text>
          <Text style={s.body}>{t('Offline game mastery only. No Character Points or cash were awarded.', 'Offline game mastery lamang. Walang Character Points o cash reward.')}</Text>
          <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN', 'ULITIN')}</Text></Pressable>
        </View>
      ) : phase === 'paused' ? (
        <View style={s.card}><Text style={s.cardTitle}>{t('Journey paused', 'Naka-pause ang laro')}</Text>
          <Pressable style={s.primary} onPress={() => changePhase('playing')}><Text style={s.primaryText}>{t('RESUME', 'ITULOY')}</Text></Pressable>
        </View>
      ) : phase === 'levelClear' ? (
        <View style={s.card}><Text style={s.cardTitle}>{t('FOREST CLEARED!', 'NATAPOS ANG LANDAS!')}</Text>
          <Text style={s.body}>{t('All relics were found. Continue toward the next forest.', 'Nakuha lahat ng relikya. Magpatuloy sa susunod na gubat.')}</Text>
          <Text style={s.body}>{t('Total moves', 'Kabuuang hakbang')}: {movesAll}</Text>
          <Pressable style={s.primary} onPress={() => startLevel(level + 1)}><Text style={s.primaryText}>{t('NEXT FOREST', 'SUSUNOD NA GUBAT')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={s.status}>
            <Text style={s.stat}>{t('FOREST', 'GUBAT')} {level + 1}/{MAZE_SPECS.length}</Text>
            <Text style={s.stat}>{t('RELICS', 'RELIKYA')}: {run.found.length}/{run.board.relics.length}</Text>
            <Text style={s.stat}>{t('STEPS', 'HAKBANG')}: {run.moves}</Text>
            <Pressable accessibilityRole="button" onPress={() => changePhase('paused')} style={s.buttonSecondary}><Text style={s.buttonText}>{t('PAUSE', 'IHINTO')}</Text></Pressable>
          </View>
          <View style={s.maze}>
            {run.board.grid.map((line, row) => (
              <View key={row} style={s.mazeRow}>{line.map((wall, col) => {
                const marker = row + ':' + col;
                const isPlayer = run.position.row === row && run.position.col === col;
                const isExit = run.board.exit.row === row && run.board.exit.col === col;
                const isRelic = run.board.relics.some(r => r.row === row && r.col === col) && !run.found.includes(marker);
                return <View key={col} style={[
                  s.cell, wall ? s.rock : s.ground,
                  !wall && memo && visited.includes(marker) && s.visited,
                  isExit && s.exit,
                ]}>{isPlayer
                  ? <MaterialCommunityIcons name="walk" color="#fff9d9" size={run.board.size === 21 ? 12 : 15} />
                  : isRelic ? <MaterialCommunityIcons name="star-four-points" color="#ffe0a1" size={run.board.size === 21 ? 10 : 13} />
                  : isExit ? <MaterialCommunityIcons name="door-open" color="#efdbc0" size={run.board.size === 21 ? 10 : 13}/>
                  : null}</View>;
              })}</View>
            ))}
          </View>
          <View style={s.controls}>
            {dirs.map(({ direction, icon }) => <Pressable
              key={direction} accessibilityRole="button"
              accessibilityLabel={t('Move', 'Umandar') + ' ' + direction}
              onPress={() => travel(direction)} style={s.arrow}>
              <MaterialCommunityIcons name={icon} size={24} color="#fff9e4" />
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={() => setMemo(value => !value)}
              style={[s.memory, memo && s.memoryActive]}>
              <MaterialCommunityIcons name="map-marker-path" color="#f0d69f" size={18}/>
              <Text style={s.memoryText}>{memo ? t('TRAIL ON', 'MAY BAKAS') : t('SHOW TRAIL', 'BAKAS')}</Text>
            </Pressable>
          </View>
          {!!message && <Text style={s.message}>{message}</Text>}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  shell: { maxWidth: 820, width: '100%', alignSelf: 'center', padding: 12, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 10, color: '#cfe9bd', fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 26, color: '#fcf8dc', fontWeight: '900' },
  subtitle: { color: '#d4e8d6', fontSize: 12 },
  scoreCard: { padding: 9, borderRadius: 11, borderWidth: 1, borderColor: '#b1ce97', alignItems: 'center', backgroundColor: '#23493d' },
  score: { color: '#f9e5b0', fontSize: 22, fontWeight: '900' },
  scoreCaption: { color: '#e2e9c7', fontSize: 9, fontWeight: '800' },
  card: { padding: 18, borderWidth: 1, borderColor: '#7da88c', borderRadius: 16, backgroundColor: '#234637', gap: 13 },
  cardTitle: { color: '#f7f3d9', fontSize: 22, fontWeight: '900' },
  body: { color: '#e3eee3', fontSize: 13, lineHeight: 21 },
  primary: { backgroundColor: '#dddda3', padding: 14, alignItems: 'center', borderRadius: 11 },
  primaryText: { color: '#214937', fontSize: 12, fontWeight: '900' },
  bigScore: { color: '#f5dfa0', fontSize: 43, fontWeight: '900' },
  status: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stat: { color: '#ddf1d5', fontSize: 11, fontWeight: '900' },
  buttonSecondary: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#a5cbab' },
  buttonText: { color: '#f1f7db', fontSize: 10, fontWeight: '900' },
  maze: { alignSelf: 'center', width: '100%', maxWidth: 480, borderRadius: 14, borderWidth: 3, borderColor: '#9cbb89', backgroundColor: '#1e3f39', padding: 5, gap: 1 },
  mazeRow: { flexDirection: 'row', gap: 1 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  rock: { backgroundColor: '#315956', borderTopWidth: 1, borderTopColor: '#60766a' },
  ground: { backgroundColor: '#a5bf81' },
  visited: { backgroundColor: '#739b71' },
  exit: { backgroundColor: '#ad8f64' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  arrow: { width: 55, height: 52, borderRadius: 11, borderWidth: 1, borderColor: '#a7ce9f', backgroundColor: '#2b6555', alignItems: 'center', justifyContent: 'center' },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 12, borderWidth: 1, borderColor: '#aeceac', borderRadius: 10, backgroundColor: '#315849' },
  memoryActive: { backgroundColor: '#4d7353' },
  memoryText: { color: '#f7f7e2', fontSize: 9, fontWeight: '900' },
  message: { color: '#cce3cf', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
