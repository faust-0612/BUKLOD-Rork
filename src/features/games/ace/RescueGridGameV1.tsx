import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type Phase = 'ready' | 'playing' | 'won' | 'lost';

type Cell = {
  index: number;
  row: number;
  col: number;
};

const GAME_ID = 'ace-rescue-grid';
const GRID_SIZE = 5;
const START = 20;
const EXIT = 4;
const STARTING_ENERGY = 13;
const BEACONS = [16, 12, 8] as const;
const BLOCKED = new Set([6, 7, 13, 18]);

const cells: Cell[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
  index,
  row: Math.floor(index / GRID_SIZE),
  col: index % GRID_SIZE,
}));

const isAdjacent = (a: number, b: number) => {
  const ar = Math.floor(a / GRID_SIZE);
  const ac = a % GRID_SIZE;
  const br = Math.floor(b / GRID_SIZE);
  const bc = b % GRID_SIZE;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
};

const starsForEnergy = (energy: number): 1 | 2 | 3 => {
  if (energy >= 4) return 3;
  if (energy >= 2) return 2;
  return 1;
};

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function RescueGridGameV1({ onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [position, setPosition] = useState(START);
  const [path, setPath] = useState<number[]>([START]);
  const [energy, setEnergy] = useState(STARTING_ENERGY);
  const [rescued, setRescued] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Plan a route through the district. Reach all three rescue beacons before extraction.');
  const flash = useRef(new Animated.Value(0)).current;
  const finishingRef = useRef(false);

  const rescuedCount = rescued.length;
  const allRescued = rescuedCount === BEACONS.length;

  const pathSet = useMemo(() => new Set(path), [path]);

  const pulseError = useCallback(() => {
    flash.setValue(0.62);
    Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  }, [flash]);

  const finish = useCallback(
    (finalEnergy: number, finalScore: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      const stars = starsForEnergy(finalEnergy);
      setPhase('won');
      setMessage('All rescue beacons secured. Extraction corridor is open.');
      playBuklodGameFeedback('success').catch(() => undefined);
      onFinish?.({
        gameId: GAME_ID,
        status: 'won',
        score: finalScore,
        stars,
        reward: {
          xp: 135 + stars * 45,
          kingdomXp: 60 + stars * 22,
          collectibleKey: stars === 3 ? 'ace-grid-command-emblem' : undefined,
        },
      });
    },
    [onFinish],
  );

  const fail = useCallback(
    (finalScore: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setPhase('lost');
      setMessage('Energy depleted before extraction. Re-route and use fewer moves.');
      playBuklodGameFeedback('failure').catch(() => undefined);
      onFinish?.({
        gameId: GAME_ID,
        status: 'lost',
        score: finalScore,
        stars: 0,
        reward: { xp: 20, kingdomXp: 5 },
      });
    },
    [onFinish],
  );

  const moveTo = useCallback(
    (target: number) => {
      if (phase !== 'playing') return;

      if (!isAdjacent(position, target) || BLOCKED.has(target)) {
        setMessage(BLOCKED.has(target) ? 'Route blocked. Find another corridor.' : 'Move only to an adjacent district tile.');
        pulseError();
        playBuklodGameFeedback('impact').catch(() => undefined);
        return;
      }

      const nextEnergy = energy - 1;
      const beacon = BEACONS.includes(target as (typeof BEACONS)[number]);
      const newlyRescued = beacon && !rescued.includes(target);
      const nextRescued = newlyRescued ? [...rescued, target] : rescued;
      const nextScore = score + 55 + (newlyRescued ? 320 : 0) + (!pathSet.has(target) ? 25 : 0);

      setPosition(target);
      setPath((current) => [...current, target]);
      setEnergy(nextEnergy);
      setRescued(nextRescued);
      setScore(nextScore);

      if (newlyRescued) {
        setMessage(`Rescue beacon ${nextRescued.length}/3 secured. Continue to extraction.`);
        playBuklodGameFeedback('collect').catch(() => undefined);
      } else {
        setMessage(nextRescued.length === 3 ? 'All beacons secured. Reach the extraction gate.' : 'Route clear. Keep energy in reserve.');
        playBuklodGameFeedback('move').catch(() => undefined);
      }

      if (target === EXIT && nextRescued.length === BEACONS.length) {
        finish(nextEnergy, nextScore + nextEnergy * 140);
        return;
      }

      if (target === EXIT && nextRescued.length < BEACONS.length) {
        setMessage('Extraction locked: rescue every beacon first.');
      }

      if (nextEnergy <= 0) {
        fail(nextScore);
      }
    },
    [energy, fail, finish, pathSet, phase, position, pulseError, rescued, score],
  );

  const start = useCallback(() => {
    finishingRef.current = false;
    setPhase('playing');
    setPosition(START);
    setPath([START]);
    setEnergy(STARTING_ENERGY);
    setRescued([]);
    setScore(0);
    setMessage('Mission live. Secure all rescue beacons, then reach extraction.');
    playBuklodGameFeedback('unlock').catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    finishingRef.current = false;
    setPhase('ready');
    setPosition(START);
    setPath([START]);
    setEnergy(STARTING_ENERGY);
    setRescued([]);
    setScore(0);
    setMessage('Plan a route through the district. Reach all three rescue beacons before extraction.');
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.cityGlow} />
      <View style={styles.gridFrame}>
        {cells.map((cell) => {
          const blocked = BLOCKED.has(cell.index);
          const beacon = BEACONS.includes(cell.index as (typeof BEACONS)[number]);
          const beaconDone = rescued.includes(cell.index);
          const current = position === cell.index;
          const visited = pathSet.has(cell.index);
          const exit = cell.index === EXIT;
          const startCell = cell.index === START;

          return (
            <Pressable
              key={cell.index}
              accessibilityRole="button"
              accessibilityLabel={`Grid row ${cell.row + 1} column ${cell.col + 1}`}
              disabled={phase !== 'playing'}
              onPress={() => moveTo(cell.index)}
              style={({ pressed }) => [
                styles.cell,
                blocked && styles.cellBlocked,
                visited && styles.cellVisited,
                beacon && !beaconDone && styles.cellBeacon,
                beaconDone && styles.cellBeaconDone,
                exit && styles.cellExit,
                current && styles.cellCurrent,
                pressed && phase === 'playing' && styles.cellPressed,
              ]}
            >
              {blocked ? <View style={styles.blockCross}><View style={styles.blockBarA} /><View style={styles.blockBarB} /></View> : null}
              {beacon ? <View style={[styles.beaconCore, beaconDone && styles.beaconCoreDone]} /> : null}
              {exit ? <Text style={styles.cellCode}>EXIT</Text> : null}
              {startCell ? <Text style={styles.cellCode}>START</Text> : null}
              {current ? <View style={styles.unit}><View style={styles.unitCore} /></View> : null}
            </Pressable>
          );
        })}
      </View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <View style={styles.topHud}>
        <View>
          <Text style={styles.kicker}>ACE • STRATEGY DISTRICT</Text>
          <Text style={styles.title}>Rescue Grid</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>ENERGY</Text><Text style={styles.statValue}>{energy}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>RESCUE</Text><Text style={styles.statValue}>{rescuedCount}/3</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>SCORE</Text><Text style={styles.statValue}>{score}</Text></View>
        </View>
      </View>

      <View style={styles.missionPanel} pointerEvents="none">
        <Text style={styles.message}>{message}</Text>
        {phase === 'playing' ? <Text style={styles.mode}>{allRescued ? 'EXTRACTION AVAILABLE' : 'TACTICAL ROUTE ACTIVE'}</Text> : null}
      </View>

      {phase === 'ready' ? (
        <View style={styles.overlay}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>BUKLOD KINGDOM • ADVENTURE 03</Text>
            <Text style={styles.heroTitle}>RESCUE GRID</Text>
            <Text style={styles.heroCopy}>Navigate a tactical city grid with limited energy. Secure all three rescue beacons, avoid blocked corridors, then reach extraction.</Text>
            <View style={styles.rulesRow}>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>ROUTE</Text><Text style={styles.ruleCopy}>adjacent tiles</Text></View>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>RESCUE</Text><Text style={styles.ruleCopy}>3 beacons</Text></View>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>SAVE</Text><Text style={styles.ruleCopy}>energy</Text></View>
            </View>
            <Pressable onPress={start} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>START MISSION</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'won' || phase === 'lost' ? (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.heroEyebrow}>{phase === 'won' ? 'MISSION CLEARED' : 'MISSION INCOMPLETE'}</Text>
            <Text style={styles.resultTitle}>{phase === 'won' ? 'EXTRACTION SUCCESS' : 'REPLAN THE GRID'}</Text>
            <Text style={styles.resultScore}>{score.toLocaleString()} pts</Text>
            <Text style={styles.resultMeta}>Energy {energy} • Rescue {rescuedCount}/3 {phase === 'won' ? `• ${'★'.repeat(starsForEnergy(energy))}` : ''}</Text>
            <Text style={styles.resultCopy}>{phase === 'won' ? 'Later this can unlock Ace’s next tactical district station and a visible city-state change.' : 'Replay without penalty and find a shorter, cleaner route.'}</Text>
            <Pressable onPress={reset} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>REPLAY MISSION</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 680, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  cityGlow: { position: 'absolute', top: '18%', left: '50%', marginLeft: -190, width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(91,139,172,0.10)' },
  gridFrame: { width: 390, maxWidth: '92%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 7, borderRadius: 28, backgroundColor: 'rgba(8,15,25,0.72)', borderWidth: 1, borderColor: 'rgba(174,210,232,0.16)' },
  cell: { width: '20%', height: '20%', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(173,207,226,0.12)', backgroundColor: 'rgba(44,65,81,0.42)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellBlocked: { backgroundColor: 'rgba(35,35,41,0.72)', borderColor: 'rgba(130,130,140,0.18)' },
  cellVisited: { backgroundColor: 'rgba(61,104,124,0.54)' },
  cellBeacon: { borderColor: '#e1bd68', backgroundColor: 'rgba(122,91,35,0.36)' },
  cellBeaconDone: { borderColor: '#85d9a7', backgroundColor: 'rgba(46,112,72,0.42)' },
  cellExit: { borderColor: '#8bc7e8' },
  cellCurrent: { borderWidth: 2, borderColor: '#eaf8ff', backgroundColor: 'rgba(101,166,196,0.45)' },
  cellPressed: { opacity: 0.78 },
  blockCross: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  blockBarA: { position: 'absolute', width: 34, height: 5, borderRadius: 4, backgroundColor: '#6f737a', transform: [{ rotate: '45deg' }] },
  blockBarB: { position: 'absolute', width: 34, height: 5, borderRadius: 4, backgroundColor: '#6f737a', transform: [{ rotate: '-45deg' }] },
  beaconCore: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#ffe19a', backgroundColor: 'rgba(255,218,126,0.24)' },
  beaconCoreDone: { borderColor: '#b4f1c8', backgroundColor: '#6dbb89' },
  cellCode: { color: '#cfe5f0', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  unit: { position: 'absolute', width: 35, height: 35, borderRadius: 18, backgroundColor: 'rgba(201,239,255,0.18)', borderWidth: 2, borderColor: '#eaf8ff', alignItems: 'center', justifyContent: 'center' },
  unitCore: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#dff5ff' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f2f7ff', zIndex: 5 },
  topHud: { position: 'absolute', top: 24, left: 22, right: 22, zIndex: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: '#b7d8e8', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 3 },
  stats: { flexDirection: 'row', gap: 7 },
  stat: { minWidth: 62, paddingVertical: 8, paddingHorizontal: 9, borderRadius: 15, backgroundColor: 'rgba(7,14,23,0.68)', borderWidth: 1, borderColor: 'rgba(194,224,240,0.13)', alignItems: 'center' },
  statLabel: { color: '#8fb6c9', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { color: '#ffffff', fontSize: 15, fontWeight: '900', marginTop: 1 },
  missionPanel: { position: 'absolute', left: 22, right: 22, bottom: 22, zIndex: 7, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: 'rgba(7,14,23,0.72)', borderWidth: 1, borderColor: 'rgba(194,224,240,0.12)' },
  message: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  mode: { color: '#a7c9d9', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center', marginTop: 4 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 12, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(5,10,17,0.64)' },
  heroCard: { width: '100%', maxWidth: 610, padding: 24, borderRadius: 28, backgroundColor: 'rgba(11,22,34,0.95)', borderWidth: 1, borderColor: 'rgba(199,226,241,0.16)' },
  heroEyebrow: { color: '#a8c8d7', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  heroTitle: { color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 6 },
  heroCopy: { color: '#d5e4eb', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  rulesRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  ruleChip: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(199,226,241,0.10)', alignItems: 'center' },
  ruleTitle: { color: '#d6eaf4', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ruleCopy: { color: '#9cb4bf', fontSize: 10, marginTop: 2 },
  primaryButton: { alignSelf: 'center', marginTop: 20, minWidth: 220, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 18, backgroundColor: '#c7e6f4', alignItems: 'center' },
  primaryPressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  primaryText: { color: '#10212a', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  resultCard: { width: '100%', maxWidth: 560, padding: 26, borderRadius: 28, backgroundColor: 'rgba(11,22,34,0.96)', borderWidth: 1, borderColor: 'rgba(199,226,241,0.17)', alignItems: 'center' },
  resultTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  resultScore: { color: '#d8eef8', fontSize: 40, fontWeight: '900', marginTop: 12 },
  resultMeta: { color: '#bfd1da', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  resultCopy: { color: '#9eb2bc', fontSize: 12, lineHeight: 18, marginTop: 13, textAlign: 'center' },
});
