import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import { useBuklodKingdomLevel } from '../runtime/BuklodGameLevelContext';
import type { BuklodGameResult } from '../types';

type Lane = 0 | 1 | 2;
type Phase = 'ready' | 'countdown' | 'playing' | 'won' | 'lost';

type Encounter = {
  id: number;
  obstacleLane: Lane;
  lightLane: Lane;
  name: string;
  intensity: 1 | 2 | 3;
};

const GAME_ID = 'jawo-forest-trail';
const STARTING_HEARTS = 3;
const TRAIL_LENGTH = 18;
const LANE_SPACING = 92;
const SWIPE_THRESHOLD = 26;

const ZONES = [
  'Forest Edge',
  'Fern Corridor',
  'Creek Bend',
  'Whispering Pines',
  'Moss Crossing',
  'Hidden Grove',
  'Old Ranger Trail',
  'Ancient Tree Path',
  'Firefly Hollow',
] as const;

const makeTrail = (): Encounter[] =>
  Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const obstacleLane = ((index * 2 + 1) % 3) as Lane;
    const lightLane = ((obstacleLane + (index % 2 === 0 ? 1 : 2)) % 3) as Lane;
    return {
      id: index,
      obstacleLane,
      lightLane,
      name: ZONES[index % ZONES.length],
      intensity: (1 + Math.floor(index / 6)) as 1 | 2 | 3,
    };
  });

const starsForScore = (score: number): 0 | 1 | 2 | 3 => {
  if (score >= 2250) return 3;
  if (score >= 1550) return 2;
  if (score >= 900) return 1;
  return 0;
};

const clampLane = (value: number): Lane => Math.max(0, Math.min(2, value)) as Lane;

const encounterDelay = (intensity: 1 | 2 | 3) => {
  if (intensity === 3) return 720;
  if (intensity === 2) return 860;
  return 1020;
};

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function ForestTrailGameV2({ onFinish }: Props) {
  const { level, speedMultiplier } = useBuklodKingdomLevel();
  const startingHearts = level >= 15 ? 2 : STARTING_HEARTS;
  const trail = useMemo(makeTrail, []);
  const [phase, setPhase] = useState<Phase>('ready');
  const [lane, setLane] = useState<Lane>(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(startingHearts);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lights, setLights] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState('Swipe or tap to change trail. Stay alert.');
  const finishingRef = useRef(false);

  const playerX = useRef(new Animated.Value(0)).current;
  const worldPulse = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const startOpacity = useRef(new Animated.Value(1)).current;

  const current = trail[Math.min(stepIndex, trail.length - 1)];
  const progress = Math.min(100, Math.round((stepIndex / trail.length) * 100));
  const intensity = current?.intensity ?? 1;

  const pulseWorld = useCallback(() => {
    worldPulse.setValue(0);
    Animated.timing(worldPulse, {
      toValue: 1,
      duration: 430,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [worldPulse]);

  const flashScene = useCallback(
    (strength: number) => {
      flash.stopAnimation();
      flash.setValue(strength);
      Animated.timing(flash, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [flash],
  );

  const moveToLane = useCallback(
    (nextLane: Lane) => {
      if (phase === 'won' || phase === 'lost') return;
      setLane(nextLane);
      playBuklodGameFeedback('move').catch(() => undefined);
      Animated.spring(playerX, {
        toValue: (nextLane - 1) * LANE_SPACING,
        damping: 18,
        stiffness: 210,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    },
    [phase, playerX],
  );

  const shiftLane = useCallback(
    (direction: -1 | 1) => {
      moveToLane(clampLane(lane + direction));
    },
    [lane, moveToLane],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          phase === 'playing' && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > SWIPE_THRESHOLD) shiftLane(1);
          if (gesture.dx < -SWIPE_THRESHOLD) shiftLane(-1);
        },
      }),
    [phase, shiftLane],
  );

  const finishGame = useCallback(
    (finalPhase: 'won' | 'lost', finalScore: number, finalBestCombo: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setPhase(finalPhase);
      setMessage(finalPhase === 'won' ? 'The trail opens into the Hidden Grove.' : 'The forest closes in. Regroup and try again.');

      const stars = starsForScore(finalScore);
      const result: BuklodGameResult = {
        gameId: GAME_ID,
        status: finalPhase,
        score: finalScore,
        stars,
        reward: {
          xp: finalPhase === 'won' ? 140 + stars * 45 + Math.min(80, finalBestCombo * 4) : 25,
          kingdomXp: finalPhase === 'won' ? 60 + stars * 25 : 8,
          collectibleKey: finalPhase === 'won' && stars === 3 ? 'jawo-forest-first-light' : undefined,
        },
      };

      playBuklodGameFeedback(finalPhase === 'won' ? 'success' : 'failure').catch(() => undefined);
      onFinish?.(result);
    },
    [onFinish],
  );

  const resolveEncounter = useCallback(() => {
    if (phase !== 'playing') return;
    const encounter = trail[stepIndex];
    if (!encounter) {
      finishGame('won', score, bestCombo);
      return;
    }

    let nextHearts = hearts;
    let nextScore = score;
    let nextCombo = combo;
    let nextLights = lights;

    if (lane === encounter.obstacleLane) {
      nextHearts -= 1;
      nextCombo = 0;
      nextScore = Math.max(0, nextScore - 70);
      setMessage(`Impact at ${encounter.name}. Recover and change trail.`);
      playBuklodGameFeedback('impact').catch(() => undefined);
      flashScene(0.72);
    } else if (lane === encounter.lightLane) {
      nextCombo += 1;
      nextLights += 1;
      const comboBonus = Math.min(160, nextCombo * 14);
      nextScore += 135 + comboBonus;
      setMessage(nextCombo >= 4 ? `Light chain x${nextCombo}. The forest is responding.` : `Trail Light secured at ${encounter.name}.`);
      playBuklodGameFeedback('collect').catch(() => undefined);
      flashScene(0.24);
      pulseWorld();
    } else {
      nextCombo += 1;
      nextScore += 55 + Math.min(75, nextCombo * 6);
      setMessage(nextCombo >= 5 ? `Clean run x${nextCombo}. Keep the rhythm.` : `Clear through ${encounter.name}.`);
      pulseWorld();
    }

    const nextBestCombo = Math.max(bestCombo, nextCombo);
    const nextStep = stepIndex + 1;

    setHearts(nextHearts);
    setScore(nextScore);
    setCombo(nextCombo);
    setBestCombo(nextBestCombo);
    setLights(nextLights);
    setStepIndex(nextStep);

    if (nextHearts <= 0) {
      finishGame('lost', nextScore, nextBestCombo);
      return;
    }

    if (nextStep >= trail.length) {
      finishGame('won', nextScore, nextBestCombo);
    }
  }, [bestCombo, combo, finishGame, flashScene, hearts, lane, lights, phase, pulseWorld, score, stepIndex, trail]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown <= 0) {
      setPhase('playing');
      setMessage('Run the trail. Read the forest, not the buttons.');
      Animated.timing(startOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start();
      return undefined;
    }

    const timer = setTimeout(() => setCountdown((value) => value - 1), 640);
    return () => clearTimeout(timer);
  }, [countdown, phase, startOpacity]);

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const timer = setTimeout(resolveEncounter, Math.max(420, encounterDelay(intensity) / speedMultiplier));
    return () => clearTimeout(timer);
  }, [intensity, phase, resolveEncounter, speedMultiplier]);

  const reset = useCallback(() => {
    finishingRef.current = false;
    setPhase('ready');
    setLane(1);
    setStepIndex(0);
    setHearts(startingHearts);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLights(0);
    setCountdown(3);
    setMessage('Swipe or tap to change trail. Stay alert.');
    playerX.setValue(0);
    startOpacity.setValue(1);
  }, [playerX, startOpacity, startingHearts]);

  const start = useCallback(() => {
    finishingRef.current = false;
    setCountdown(3);
    setPhase('countdown');
    setMessage('Listen. Watch the path. Move only when needed.');
    playBuklodGameFeedback('unlock').catch(() => undefined);
  }, []);

  const worldScale = worldPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const worldShift = worldPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <Animated.View style={[styles.world, { transform: [{ scale: worldScale }, { translateY: worldShift }] }]}>
        <View style={styles.skyGlow} />
        <View style={styles.mistBandA} />
        <View style={styles.mistBandB} />

        <View style={styles.treeLineBack} pointerEvents="none">
          {Array.from({ length: 11 }, (_, index) => (
            <View key={`back-${index}`} style={[styles.treeBack, { opacity: 0.24 + (index % 3) * 0.08 }]}>
              <View style={styles.treeBackCrown} />
              <View style={styles.treeBackTrunk} />
            </View>
          ))}
        </View>

        <View style={styles.treeLineFront} pointerEvents="none">
          {Array.from({ length: 7 }, (_, index) => (
            <View key={`front-${index}`} style={styles.treeFront}>
              <View style={styles.treeFrontCrown} />
              <View style={styles.treeFrontTrunk} />
            </View>
          ))}
        </View>

        <View style={styles.horizon} />
        <View style={styles.trailPerspective}>
          <View style={styles.trailGlow} />
          <View style={styles.trailLineLeft} />
          <View style={styles.trailLineRight} />
          <View style={styles.centerGuide} />
        </View>

        <View style={styles.encounterLayer} pointerEvents="none">
          {[0, 1, 2].map((rawLane) => {
            const laneIndex = rawLane as Lane;
            const obstacle = current && laneIndex === current.obstacleLane;
            const light = current && laneIndex === current.lightLane;
            return (
              <View key={laneIndex} style={styles.encounterLane}>
                {obstacle ? (
                  <View style={styles.rock}>
                    <View style={styles.rockFacet} />
                  </View>
                ) : null}
                {light ? (
                  <View style={styles.lightOrb}>
                    <View style={styles.lightCore} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <View style={styles.topHud}>
        <View style={styles.identityBlock}>
          <Text style={styles.kicker}>JAWO • WHISPERING FOREST</Text>
          <Text style={styles.zoneName}>{current?.name ?? 'Forest Trail'}</Text>
        </View>
        <View style={styles.hudRight}>
          <View style={styles.statPill}><Text style={styles.statLabel}>LIGHT</Text><Text style={styles.statValue}>{lights}</Text></View>
          <View style={styles.statPill}><Text style={styles.statLabel}>COMBO</Text><Text style={styles.statValue}>x{combo}</Text></View>
          <View style={styles.statPill}><Text style={styles.statLabel}>SCORE</Text><Text style={styles.statValue}>{score}</Text></View>
        </View>
      </View>

      <View style={styles.progressShell}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.heartRow}>
        {Array.from({ length: startingHearts }, (_, index) => (
          <View key={index} style={[styles.heartMark, index >= hearts && styles.heartEmpty]} />
        ))}
      </View>

      <View style={styles.messagePanel} pointerEvents="none">
        <Text style={styles.message}>{message}</Text>
        {phase === 'playing' ? <Text style={styles.speedText}>ZONE {intensity} • {progress}%</Text> : null}
      </View>

      <View style={styles.playerArea} pointerEvents="none">
        <Animated.View style={[styles.playerShadow, { transform: [{ translateX: playerX }] }]} />
        <Animated.View style={[styles.player, { transform: [{ translateX: playerX }] }]}>
          <View style={styles.playerGlow} />
          <View style={styles.playerHead} />
          <View style={styles.playerBody} />
          <Text style={styles.playerName}>JAWO</Text>
        </Animated.View>
      </View>

      {phase === 'playing' ? (
        <View style={styles.touchZones}>
          <Pressable accessibilityLabel="Move Jawo left" onPress={() => shiftLane(-1)} style={styles.touchZone} />
          <Pressable accessibilityLabel="Move Jawo right" onPress={() => shiftLane(1)} style={styles.touchZone} />
        </View>
      ) : null}

      {phase === 'ready' ? (
        <View style={styles.overlay}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>BUKLOD KINGDOM • ADVENTURE 01</Text>
            <Text style={styles.heroTitle}>FOREST TRAIL</Text>
            <Text style={styles.heroCopy}>Move across three forest trails. Avoid fallen rock, collect Trail Lights, and build a clean-run combo as the forest speeds up.</Text>
            <View style={styles.instructionRow}>
              <View style={styles.instructionChip}><Text style={styles.instructionTitle}>SWIPE</Text><Text style={styles.instructionCopy}>left / right</Text></View>
              <View style={styles.instructionChip}><Text style={styles.instructionTitle}>READ</Text><Text style={styles.instructionCopy}>rock + light</Text></View>
              <View style={styles.instructionChip}><Text style={styles.instructionTitle}>FLOW</Text><Text style={styles.instructionCopy}>keep combo</Text></View>
            </View>
            <Pressable onPress={start} style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
              <Text style={styles.startButtonText}>ENTER THE FOREST</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {phase === 'countdown' ? (
        <Animated.View style={[styles.countdownOverlay, { opacity: startOpacity }]} pointerEvents="none">
          <Text style={styles.countdownLabel}>TRAIL OPENS IN</Text>
          <Text style={styles.countdownNumber}>{countdown > 0 ? countdown : 'GO'}</Text>
        </Animated.View>
      ) : null}

      {phase === 'won' || phase === 'lost' ? (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.heroEyebrow}>{phase === 'won' ? 'STATION CLEARED' : 'TRAIL INTERRUPTED'}</Text>
            <Text style={styles.resultTitle}>{phase === 'won' ? 'HIDDEN GROVE FOUND' : 'RETURN TO THE TRAIL'}</Text>
            <Text style={styles.resultScore}>{score.toLocaleString()} pts</Text>
            <Text style={styles.resultMeta}>Best combo x{bestCombo} • Trail Lights {lights} • {'★'.repeat(starsForScore(score)) || 'No star yet'}</Text>
            <Text style={styles.resultCopy}>{phase === 'won' ? 'This station is ready to unlock a permanent map change once Kingdom persistence is connected.' : 'No punishment. Replay, learn the rhythm, and push deeper into the forest.'}</Text>
            <Pressable onPress={reset} style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
              <Text style={styles.startButtonText}>{phase === 'won' ? 'RUN AGAIN' : 'TRY AGAIN'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 680, overflow: 'hidden', position: 'relative' },
  world: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  skyGlow: { position: 'absolute', top: '10%', left: '32%', width: '36%', height: '26%', borderRadius: 240, backgroundColor: 'rgba(181,244,194,0.12)' },
  mistBandA: { position: 'absolute', top: '37%', left: '-10%', width: '120%', height: 90, borderRadius: 90, backgroundColor: 'rgba(218,255,229,0.07)', transform: [{ rotate: '-3deg' }] },
  mistBandB: { position: 'absolute', top: '50%', left: '-12%', width: '125%', height: 64, borderRadius: 64, backgroundColor: 'rgba(192,235,214,0.05)', transform: [{ rotate: '4deg' }] },
  treeLineBack: { position: 'absolute', left: 0, right: 0, top: '20%', height: 260, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  treeBack: { width: 56, alignItems: 'center' },
  treeBackCrown: { width: 54, height: 130, borderRadius: 50, backgroundColor: '#184f37' },
  treeBackTrunk: { width: 10, height: 95, borderRadius: 6, marginTop: -22, backgroundColor: '#422f22' },
  treeLineFront: { position: 'absolute', left: -42, right: -42, top: '31%', height: 340, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  treeFront: { width: 88, alignItems: 'center', opacity: 0.74 },
  treeFrontCrown: { width: 84, height: 190, borderRadius: 70, backgroundColor: '#0d3928' },
  treeFrontTrunk: { width: 16, height: 130, borderRadius: 7, marginTop: -28, backgroundColor: '#34271f' },
  horizon: { position: 'absolute', left: '44%', top: '41%', width: '12%', height: 5, borderRadius: 4, backgroundColor: 'rgba(220,255,220,0.35)' },
  trailPerspective: { position: 'absolute', left: '50%', bottom: -80, marginLeft: -185, width: 370, height: '63%', borderTopLeftRadius: 170, borderTopRightRadius: 170, backgroundColor: 'rgba(20,24,18,0.64)', borderWidth: 1, borderColor: 'rgba(191,231,170,0.12)', overflow: 'hidden' },
  trailGlow: { position: 'absolute', left: '47%', top: 0, width: '6%', height: '100%', backgroundColor: 'rgba(189,236,150,0.08)' },
  trailLineLeft: { position: 'absolute', left: '33%', top: 0, width: 2, height: '100%', backgroundColor: 'rgba(222,255,218,0.14)', transform: [{ rotate: '7deg' }] },
  trailLineRight: { position: 'absolute', right: '33%', top: 0, width: 2, height: '100%', backgroundColor: 'rgba(222,255,218,0.14)', transform: [{ rotate: '-7deg' }] },
  centerGuide: { position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.05)' },
  encounterLayer: { position: 'absolute', left: '50%', marginLeft: -150, top: '45%', width: 300, height: 150, flexDirection: 'row', justifyContent: 'space-between' },
  encounterLane: { width: 92, height: 150, alignItems: 'center', justifyContent: 'flex-start' },
  rock: { marginTop: 12, width: 64, height: 45, borderRadius: 20, backgroundColor: '#434b42', transform: [{ rotate: '-8deg' }], borderWidth: 1, borderColor: '#7c877a' },
  rockFacet: { position: 'absolute', top: 7, left: 10, width: 30, height: 14, borderRadius: 10, backgroundColor: '#667065', opacity: 0.65 },
  lightOrb: { marginTop: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(225,255,159,0.28)', borderWidth: 1, borderColor: 'rgba(241,255,190,0.72)', alignItems: 'center', justifyContent: 'center', shadowColor: '#eaff8f', shadowOpacity: 0.85, shadowRadius: 18 },
  lightCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#f3ffb5' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e9ffd8', zIndex: 2 },
  topHud: { position: 'absolute', top: 24, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 5 },
  identityBlock: { flexShrink: 1, paddingRight: 14 },
  kicker: { color: '#bde9c6', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  zoneName: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 3 },
  hudRight: { flexDirection: 'row', gap: 8 },
  statPill: { minWidth: 66, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(4,14,9,0.62)', borderWidth: 1, borderColor: 'rgba(198,239,204,0.18)', alignItems: 'center' },
  statLabel: { color: '#8fc79b', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { color: '#ffffff', fontSize: 15, fontWeight: '900', marginTop: 1 },
  progressShell: { position: 'absolute', top: 92, left: 22, right: 22, height: 5, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)', zIndex: 5 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#dff59b' },
  heartRow: { position: 'absolute', top: 110, left: 22, flexDirection: 'row', gap: 7, zIndex: 5 },
  heartMark: { width: 22, height: 8, borderRadius: 8, backgroundColor: '#dceca6' },
  heartEmpty: { backgroundColor: 'rgba(255,255,255,0.14)' },
  messagePanel: { position: 'absolute', left: 22, right: 22, bottom: 24, zIndex: 6, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 16, backgroundColor: 'rgba(3,11,7,0.58)', borderWidth: 1, borderColor: 'rgba(213,245,198,0.14)' },
  message: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  speedText: { color: '#98cda3', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 4 },
  playerArea: { position: 'absolute', left: 0, right: 0, bottom: 88, height: 132, alignItems: 'center', justifyContent: 'flex-end', zIndex: 4 },
  playerShadow: { position: 'absolute', bottom: 4, width: 62, height: 16, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.34)' },
  player: { width: 64, height: 108, alignItems: 'center', justifyContent: 'flex-end' },
  playerGlow: { position: 'absolute', bottom: 12, width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(202,244,174,0.10)' },
  playerHead: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#c3d6bf', borderWidth: 2, borderColor: '#eff8e6' },
  playerBody: { width: 42, height: 54, borderRadius: 14, marginTop: 2, backgroundColor: '#172c22', borderWidth: 2, borderColor: '#91ae98' },
  playerName: { color: '#e7f4e8', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  touchZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 3 },
  touchZone: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(2,9,6,0.56)' },
  heroCard: { width: '100%', maxWidth: 610, padding: 24, borderRadius: 26, backgroundColor: 'rgba(5,18,12,0.91)', borderWidth: 1, borderColor: 'rgba(213,244,203,0.19)' },
  heroEyebrow: { color: '#a7d4af', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  heroTitle: { color: '#ffffff', fontSize: 34, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 6 },
  heroCopy: { color: '#d4e6d7', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  instructionRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  instructionChip: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(175,220,177,0.08)', borderWidth: 1, borderColor: 'rgba(205,239,201,0.12)', alignItems: 'center' },
  instructionTitle: { color: '#dff2bc', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  instructionCopy: { color: '#9eb8a3', fontSize: 10, marginTop: 2 },
  startButton: { alignSelf: 'center', marginTop: 20, minWidth: 230, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 18, backgroundColor: '#dbe995', alignItems: 'center' },
  startButtonPressed: { transform: [{ scale: 0.98 }], opacity: 0.86 },
  startButtonText: { color: '#102115', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,10,6,0.48)' },
  countdownLabel: { color: '#bfd9c2', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  countdownNumber: { color: '#ffffff', fontSize: 84, fontWeight: '900', lineHeight: 92, marginTop: 8 },
  resultCard: { width: '100%', maxWidth: 560, padding: 26, borderRadius: 26, backgroundColor: 'rgba(5,18,12,0.94)', borderWidth: 1, borderColor: 'rgba(213,244,203,0.20)', alignItems: 'center' },
  resultTitle: { color: '#ffffff', fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  resultScore: { color: '#e8f5a7', fontSize: 40, fontWeight: '900', marginTop: 12 },
  resultMeta: { color: '#c9dec9', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  resultCopy: { color: '#9fb9a4', fontSize: 12, lineHeight: 18, marginTop: 13, textAlign: 'center' },
});
