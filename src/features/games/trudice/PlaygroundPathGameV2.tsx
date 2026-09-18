import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type Phase = 'ready' | 'watch' | 'input' | 'round-clear' | 'won' | 'lost';
type StationId = 0 | 1 | 2 | 3;

type Station = {
  id: StationId;
  name: string;
  short: string;
  accent: string;
  soft: string;
};

const GAME_ID = 'trudice-playground-memory';
const MAX_ROUND = 5;
const STARTING_HEARTS = 3;

const STATIONS: Station[] = [
  { id: 0, name: 'Story Tree', short: 'STORY', accent: '#f6c54a', soft: '#6f5421' },
  { id: 1, name: 'Sky Slide', short: 'SLIDE', accent: '#69d7ff', soft: '#25586b' },
  { id: 2, name: 'Hop Garden', short: 'HOP', accent: '#93ea88', soft: '#38643a' },
  { id: 3, name: 'Wonder Wheel', short: 'WONDER', accent: '#f69ad7', soft: '#6c3159' },
];

const buildSequence = (round: number): StationId[] => {
  const length = round + 2;
  return Array.from({ length }, (_, index) => ((round * 2 + index * 3 + (index % 2)) % 4) as StationId);
};

const starsForRun = (mistakes: number): 1 | 2 | 3 => {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
};

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function PlaygroundPathGameV2({ onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [watchIndex, setWatchIndex] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [litStation, setLitStation] = useState<StationId | null>(null);
  const [hearts, setHearts] = useState(STARTING_HEARTS);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Watch the playground come alive, then repeat the path.');
  const finishingRef = useRef(false);
  const flash = useRef(new Animated.Value(0)).current;
  const celebration = useRef(new Animated.Value(0)).current;

  const sequence = useMemo(() => buildSequence(round), [round]);
  const progress = Math.round(((round - 1) / MAX_ROUND) * 100);

  const flashScene = useCallback(
    (strength: number) => {
      flash.stopAnimation();
      flash.setValue(strength);
      Animated.timing(flash, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [flash],
  );

  const pulseCelebration = useCallback(() => {
    celebration.setValue(0);
    Animated.sequence([
      Animated.timing(celebration, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(celebration, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [celebration]);

  const finishGame = useCallback(
    (finalScore: number, finalMistakes: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      const stars = starsForRun(finalMistakes);
      setPhase('won');
      setMessage('Children’s Haven lights up. The path is remembered.');
      pulseCelebration();
      playBuklodGameFeedback('success').catch(() => undefined);
      onFinish?.({
        gameId: GAME_ID,
        status: 'won',
        score: finalScore,
        stars,
        reward: {
          xp: 125 + stars * 40,
          kingdomXp: 55 + stars * 20,
          collectibleKey: stars === 3 ? 'trudice-bright-memory-star' : undefined,
        },
      });
    },
    [onFinish, pulseCelebration],
  );

  const failGame = useCallback(
    (finalScore: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setPhase('lost');
      setMessage('The path faded. Replay it slowly and rebuild the pattern.');
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

  const beginWatch = useCallback(() => {
    setWatchIndex(0);
    setInputIndex(0);
    setLitStation(null);
    setPhase('watch');
    setMessage(`Round ${round}: watch the path. Do not tap yet.`);
  }, [round]);

  useEffect(() => {
    if (phase !== 'watch') return undefined;

    if (watchIndex >= sequence.length) {
      const readyTimer = setTimeout(() => {
        setLitStation(null);
        setPhase('input');
        setInputIndex(0);
        setMessage('Your turn. Repeat the glowing path.');
      }, 480);
      return () => clearTimeout(readyTimer);
    }

    setLitStation(sequence[watchIndex]);
    const offTimer = setTimeout(() => setLitStation(null), 390);
    const nextTimer = setTimeout(() => setWatchIndex((value) => value + 1), 650);

    return () => {
      clearTimeout(offTimer);
      clearTimeout(nextTimer);
    };
  }, [phase, sequence, watchIndex]);

  useEffect(() => {
    if (phase !== 'round-clear') return undefined;
    const timer = setTimeout(() => {
      if (round >= MAX_ROUND) {
        finishGame(score, mistakes);
        return;
      }
      setRound((value) => value + 1);
      setPhase('watch');
      setWatchIndex(0);
      setInputIndex(0);
      setLitStation(null);
      setMessage('The playground is adding one more step. Watch carefully.');
    }, 850);
    return () => clearTimeout(timer);
  }, [finishGame, mistakes, phase, round, score]);

  const chooseStation = useCallback(
    (stationId: StationId) => {
      if (phase !== 'input') return;
      const expected = sequence[inputIndex];

      setLitStation(stationId);
      setTimeout(() => setLitStation((current) => (current === stationId ? null : current)), 180);

      if (stationId !== expected) {
        const nextHearts = hearts - 1;
        const nextMistakes = mistakes + 1;
        setHearts(nextHearts);
        setMistakes(nextMistakes);
        setInputIndex(0);
        setMessage('Not that station. Watch the same round once more.');
        flashScene(0.58);
        playBuklodGameFeedback('impact').catch(() => undefined);

        if (nextHearts <= 0) {
          failGame(score);
          return;
        }

        setTimeout(() => {
          setWatchIndex(0);
          setLitStation(null);
          setPhase('watch');
        }, 620);
        return;
      }

      const nextIndex = inputIndex + 1;
      const nextScore = score + 120 + round * 22;
      setScore(nextScore);
      setInputIndex(nextIndex);
      playBuklodGameFeedback('collect').catch(() => undefined);

      if (nextIndex >= sequence.length) {
        setScore(nextScore + 180 + round * 35);
        setPhase('round-clear');
        setMessage(`Round ${round} complete. The playground grows brighter.`);
        pulseCelebration();
        playBuklodGameFeedback('unlock').catch(() => undefined);
      } else {
        setMessage(`${nextIndex}/${sequence.length} correct. Keep the path in mind.`);
      }
    },
    [failGame, flashScene, hearts, inputIndex, mistakes, phase, pulseCelebration, round, score, sequence],
  );

  const start = useCallback(() => {
    finishingRef.current = false;
    setRound(1);
    setHearts(STARTING_HEARTS);
    setMistakes(0);
    setScore(0);
    setWatchIndex(0);
    setInputIndex(0);
    setLitStation(null);
    setPhase('watch');
    setMessage('Round 1: watch the path.');
    playBuklodGameFeedback('unlock').catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    finishingRef.current = false;
    setPhase('ready');
    setRound(1);
    setHearts(STARTING_HEARTS);
    setMistakes(0);
    setScore(0);
    setWatchIndex(0);
    setInputIndex(0);
    setLitStation(null);
    setMessage('Watch the playground come alive, then repeat the path.');
  }, []);

  const celebrationScale = celebration.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.scene, { transform: [{ scale: celebrationScale }] }]}>
        <View style={styles.skyWash} />
        <View style={styles.sunGlow} />
        <View style={styles.ground} />
        <View style={styles.pathRingOuter} />
        <View style={styles.pathRingInner} />

        <View style={styles.stationField}>
          {STATIONS.map((station) => {
            const active = litStation === station.id;
            return (
              <Pressable
                key={station.id}
                accessibilityRole="button"
                accessibilityLabel={station.name}
                disabled={phase !== 'input'}
                onPress={() => chooseStation(station.id)}
                style={({ pressed }) => [
                  styles.station,
                  station.id === 0 && styles.stationTop,
                  station.id === 1 && styles.stationRight,
                  station.id === 2 && styles.stationBottom,
                  station.id === 3 && styles.stationLeft,
                  active && { borderColor: station.accent, backgroundColor: station.soft, transform: [{ scale: 1.08 }] },
                  pressed && phase === 'input' && styles.stationPressed,
                ]}
              >
                <View style={[styles.stationGlow, { backgroundColor: station.accent, opacity: active ? 0.38 : 0.06 }]} />
                <View style={[styles.stationMarker, { borderColor: station.accent, backgroundColor: active ? station.accent : 'rgba(255,255,255,0.06)' }]} />
                <Text style={[styles.stationName, active && { color: '#ffffff' }]}>{station.short}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.playgroundStructures} pointerEvents="none">
          <View style={styles.slideTower} />
          <View style={styles.slideRamp} />
          <View style={styles.swingFrame}>
            <View style={styles.swingSeat} />
          </View>
          <View style={styles.storyTree}>
            <View style={styles.storyTreeCrown} />
            <View style={styles.storyTreeTrunk} />
          </View>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <View style={styles.topHud}>
        <View>
          <Text style={styles.kicker}>TRUDICE • CHILDREN’S HAVEN</Text>
          <Text style={styles.title}>Wonder Path</Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statLabel}>ROUND</Text><Text style={styles.statValue}>{round}/{MAX_ROUND}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>SCORE</Text><Text style={styles.statValue}>{score}</Text></View>
        </View>
      </View>

      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${phase === 'won' ? 100 : progress}%` }]} /></View>

      <View style={styles.heartRow}>
        {Array.from({ length: STARTING_HEARTS }, (_, index) => (
          <View key={index} style={[styles.heartDot, index >= hearts && styles.heartDotEmpty]} />
        ))}
      </View>

      <View style={styles.messagePanel} pointerEvents="none">
        <Text style={styles.message}>{message}</Text>
        {phase === 'watch' ? <Text style={styles.mode}>WATCH</Text> : null}
        {phase === 'input' ? <Text style={styles.mode}>YOUR TURN • {inputIndex}/{sequence.length}</Text> : null}
      </View>

      {phase === 'ready' ? (
        <View style={styles.overlay}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>BUKLOD KINGDOM • ADVENTURE 02</Text>
            <Text style={styles.heroTitle}>WONDER PATH</Text>
            <Text style={styles.heroCopy}>The playground lights a route across four stations. Watch the full sequence, then repeat it. Every round adds another step.</Text>
            <View style={styles.rulesRow}>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>WATCH</Text><Text style={styles.ruleCopy}>follow the glow</Text></View>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>REPEAT</Text><Text style={styles.ruleCopy}>tap in order</Text></View>
              <View style={styles.ruleChip}><Text style={styles.ruleTitle}>GROW</Text><Text style={styles.ruleCopy}>5 rounds</Text></View>
            </View>
            <Pressable onPress={start} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>OPEN THE PLAYGROUND</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'round-clear' ? (
        <View pointerEvents="none" style={styles.roundBanner}>
          <Text style={styles.roundBannerLabel}>PATH REMEMBERED</Text>
          <Text style={styles.roundBannerTitle}>ROUND {round} CLEAR</Text>
        </View>
      ) : null}

      {phase === 'won' || phase === 'lost' ? (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.heroEyebrow}>{phase === 'won' ? 'STATION CLEARED' : 'PATH LOST'}</Text>
            <Text style={styles.resultTitle}>{phase === 'won' ? 'CHILDREN’S HAVEN GLOWS' : 'TRY THE PATH AGAIN'}</Text>
            <Text style={styles.resultScore}>{score.toLocaleString()} pts</Text>
            <Text style={styles.resultMeta}>Mistakes {mistakes} • {'★'.repeat(starsForRun(mistakes))}</Text>
            <Text style={styles.resultCopy}>{phase === 'won' ? 'Later, this clear can permanently brighten Trudice’s playground station on the Kingdom Map.' : 'The pattern is replayable with no penalty. Learn it visually and try again.'}</Text>
            <Pressable onPress={reset} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>PLAY AGAIN</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 680, overflow: 'hidden', position: 'relative' },
  scene: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  skyWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(55,27,95,0.18)' },
  sunGlow: { position: 'absolute', top: '12%', right: '12%', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,224,145,0.14)' },
  ground: { position: 'absolute', left: '-10%', right: '-10%', bottom: '-10%', height: '55%', borderTopLeftRadius: 260, borderTopRightRadius: 260, backgroundColor: 'rgba(40,34,58,0.50)', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pathRingOuter: { position: 'absolute', left: '50%', top: '50%', marginLeft: -180, marginTop: -150, width: 360, height: 300, borderRadius: 180, borderWidth: 18, borderColor: 'rgba(255,225,172,0.05)' },
  pathRingInner: { position: 'absolute', left: '50%', top: '50%', marginLeft: -128, marginTop: -104, width: 256, height: 208, borderRadius: 128, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  stationField: { ...StyleSheet.absoluteFillObject, zIndex: 4 },
  station: { position: 'absolute', width: 116, height: 82, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(21,14,38,0.70)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stationTop: { top: '29%', left: '50%', marginLeft: -58 },
  stationRight: { top: '49%', right: '9%' },
  stationBottom: { bottom: '18%', left: '50%', marginLeft: -58 },
  stationLeft: { top: '49%', left: '9%' },
  stationPressed: { opacity: 0.82 },
  stationGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  stationMarker: { width: 27, height: 27, borderRadius: 14, borderWidth: 3 },
  stationName: { color: '#d9cfe7', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 7 },
  playgroundStructures: { ...StyleSheet.absoluteFillObject, zIndex: 1, opacity: 0.46 },
  slideTower: { position: 'absolute', left: '24%', top: '32%', width: 34, height: 95, borderRadius: 12, backgroundColor: '#4d87a0' },
  slideRamp: { position: 'absolute', left: '27%', top: '39%', width: 110, height: 19, borderRadius: 14, backgroundColor: '#7bc5dc', transform: [{ rotate: '33deg' }] },
  swingFrame: { position: 'absolute', right: '22%', top: '33%', width: 100, height: 100, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderColor: '#8b6c9e' },
  swingSeat: { position: 'absolute', left: 25, bottom: 16, width: 34, height: 8, borderRadius: 6, backgroundColor: '#e2a3cf' },
  storyTree: { position: 'absolute', left: '44%', bottom: '25%', width: 90, alignItems: 'center' },
  storyTreeCrown: { width: 90, height: 75, borderRadius: 45, backgroundColor: '#59865b' },
  storyTreeTrunk: { width: 18, height: 56, marginTop: -10, borderRadius: 8, backgroundColor: '#644431' },
  flash: { ...StyleSheet.absoluteFillObject, zIndex: 6, backgroundColor: '#fff4d7' },
  topHud: { position: 'absolute', top: 24, left: 22, right: 22, zIndex: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { color: '#ead9ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 3 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { minWidth: 68, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(19,11,34,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', alignItems: 'center' },
  statLabel: { color: '#c5abd7', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { color: '#ffffff', fontSize: 15, fontWeight: '900', marginTop: 1 },
  progressTrack: { position: 'absolute', top: 92, left: 22, right: 22, height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', zIndex: 7 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#f4d884' },
  heartRow: { position: 'absolute', top: 109, left: 22, flexDirection: 'row', gap: 7, zIndex: 7 },
  heartDot: { width: 22, height: 8, borderRadius: 8, backgroundColor: '#f3bddf' },
  heartDotEmpty: { backgroundColor: 'rgba(255,255,255,0.13)' },
  messagePanel: { position: 'absolute', left: 22, right: 22, bottom: 22, zIndex: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(18,10,32,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  message: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  mode: { color: '#e8c6f2', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center', marginTop: 4 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 12, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(18,8,32,0.58)' },
  heroCard: { width: '100%', maxWidth: 610, padding: 24, borderRadius: 28, backgroundColor: 'rgba(27,14,48,0.93)', borderWidth: 1, borderColor: 'rgba(255,235,255,0.16)' },
  heroEyebrow: { color: '#d6b8e4', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  heroTitle: { color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 6 },
  heroCopy: { color: '#e2d9ea', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  rulesRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  ruleChip: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' },
  ruleTitle: { color: '#f1d695', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ruleCopy: { color: '#bdaec8', fontSize: 10, marginTop: 2 },
  primaryButton: { alignSelf: 'center', marginTop: 20, minWidth: 230, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 18, backgroundColor: '#f1d982', alignItems: 'center' },
  primaryPressed: { transform: [{ scale: 0.98 }], opacity: 0.87 },
  primaryText: { color: '#2a1735', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  roundBanner: { position: 'absolute', left: '50%', top: '45%', marginLeft: -145, width: 290, zIndex: 10, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(34,16,54,0.88)', borderWidth: 1, borderColor: 'rgba(255,235,255,0.18)', alignItems: 'center' },
  roundBannerLabel: { color: '#e7cbe9', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  roundBannerTitle: { color: '#ffffff', fontSize: 23, fontWeight: '900', marginTop: 3 },
  resultCard: { width: '100%', maxWidth: 560, padding: 26, borderRadius: 28, backgroundColor: 'rgba(27,14,48,0.95)', borderWidth: 1, borderColor: 'rgba(255,235,255,0.17)', alignItems: 'center' },
  resultTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  resultScore: { color: '#f3d77e', fontSize: 40, fontWeight: '900', marginTop: 12 },
  resultMeta: { color: '#d8c9df', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  resultCopy: { color: '#b5a9bd', fontSize: 12, lineHeight: 18, marginTop: 13, textAlign: 'center' },
});
