import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import BuklodSpecialCharacterArtV2 from '@/components/points/BuklodSpecialCharacterArtV2';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';
import {
  STARTING_HEARTS, advanceTrail, clampLane,
  encounterDelay, makeTrail, starsForScore,
  type Lane,
} from './forestTrailEngine';

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'won' | 'lost';
const GAME_ID = 'jawo-forest-trail';
const SWIPE_THRESHOLD = 26;

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function ForestTrailGameV2({ onFinish }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const gameHeight = Math.min(730, Math.max(510, Math.round(screenHeight * 0.72)));
  const [playWidth, setPlayWidth] = useState(screenWidth);
  const laneSpacing = Math.max(62, (playWidth - 24) / 3);
  const [runSeed, setRunSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const trail = useMemo(() => makeTrail(runSeed), [runSeed]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [, setLane] = useState<Lane>(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(STARTING_HEARTS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lights, setLights] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState('Swipe or tap to change trail. Stay alert.');
  const finishingRef = useRef(false);
  const laneRef = useRef<Lane>(1);
  const encounterCallbackRef = useRef<() => void>(() => undefined);

  const playerX = useRef(new Animated.Value(0)).current;
  const worldPulse = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const startOpacity = useRef(new Animated.Value(1)).current;
  const approach = useRef(new Animated.Value(0)).current;

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
      if (phase !== 'playing') return;
      laneRef.current = nextLane;
      setLane(nextLane);
      playBuklodGameFeedback('move').catch(() => undefined);
      Animated.spring(playerX, {
        toValue: (nextLane - 1) * laneSpacing,
        damping: 18,
        stiffness: 210,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    },
    [phase, playerX, laneSpacing],
  );

  const shiftLane = useCallback(
    (direction: -1 | 1) => {
      moveToLane(clampLane(laneRef.current + direction));
    },
    [moveToLane],
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

    const next = advanceTrail({ hearts, score, combo, bestCombo, lights }, laneRef.current, encounter);
    if (next.outcome === 'impact') {
      setMessage(`Impact at ${encounter.name}. Recover and change trail.`);
      playBuklodGameFeedback('impact').catch(() => undefined);
      flashScene(0.72);
    } else if (next.outcome === 'light') {
      setMessage(next.combo >= 4 ? `Light chain x${next.combo}. The forest is responding.` : `Trail Light secured at ${encounter.name}.`);
      playBuklodGameFeedback('collect').catch(() => undefined);
      flashScene(0.24);
      pulseWorld();
    } else {
      setMessage(next.combo >= 5 ? `Clean run x${next.combo}. Keep the rhythm.` : `Clear through ${encounter.name}.`);
      pulseWorld();
    }

    const nextStep = stepIndex + 1;
    setHearts(next.hearts);
    setScore(next.score);
    setCombo(next.combo);
    setBestCombo(next.bestCombo);
    setLights(next.lights);
    setStepIndex(nextStep);

    if (next.hearts <= 0) {
      finishGame('lost', next.score, next.bestCombo);
      return;
    }
    if (nextStep >= trail.length) finishGame('won', next.score, next.bestCombo);
  }, [bestCombo, combo, finishGame, flashScene, hearts, lights, phase, pulseWorld, score, stepIndex, trail]);
  // Lane presses update the ref without restarting the incoming hazard clock.
  encounterCallbackRef.current = resolveEncounter;

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
    const duration = encounterDelay(intensity);
    approach.setValue(0);
    Animated.timing(approach, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => encounterCallbackRef.current(), duration);
    return () => {
      clearTimeout(timer);
      approach.stopAnimation();
    };
  // Deliberately independent of lane, score, callback identity, and rerenders.
  }, [approach, intensity, phase, stepIndex]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setPhase((value) => value === 'playing' ? 'paused' : value);
    });
    return () => subscription.remove();
  }, []);

  const reset = useCallback(() => {
    finishingRef.current = false;
    setPhase('ready');
    setLane(1);
    laneRef.current = 1;
    setRunSeed(Math.floor(Math.random() * 0x7fffffff));
    setStepIndex(0);
    setHearts(STARTING_HEARTS);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLights(0);
    setCountdown(3);
    setMessage('Swipe or tap to change trail. Stay alert.');
    playerX.setValue(0);
    approach.setValue(0);
    startOpacity.setValue(1);
  }, [approach, playerX, startOpacity]);

  const start = useCallback(() => {
    finishingRef.current = false;
    setCountdown(3);
    laneRef.current = 1;
    setPhase('countdown');
    setMessage('Listen. Watch the path. Move only when needed.');
    playBuklodGameFeedback('unlock').catch(() => undefined);
  }, []);

  const worldScale = worldPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const worldShift = worldPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });
  const obstacleTravel = approach.interpolate({ inputRange: [0, 1], outputRange: [0, gameHeight * 0.39] });
  const obstacleScale = approach.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.32] });

  return (
    <View
      style={[styles.root, { height: gameHeight }]}
      onLayout={event => setPlayWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
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

        <Animated.View style={[styles.encounterLayer, { transform: [{ translateY: obstacleTravel }, { scale: obstacleScale }] }]} pointerEvents="none">
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
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <View style={styles.topHud}>
        <View style={styles.identityBlock}>
          <Text numberOfLines={1} style={styles.kicker}>JAWO • WHISPERING FOREST  •  ACT {Math.min(3, Math.floor(stepIndex / 8) + 1)}/3</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.zoneName}>{current?.name ?? 'Forest Trail'}</Text>
        </View>
        <View style={styles.hudRight}>
          <View style={styles.statPill}><Text style={styles.statLabel}>LIGHT</Text><Text style={styles.statValue}>{lights}</Text></View>
          <View style={styles.statPill}><Text style={styles.statLabel}>COMBO</Text><Text style={styles.statValue}>x{combo}</Text></View>
          <View style={styles.statPill}><Text style={styles.statLabel}>SCORE</Text><Text style={styles.statValue}>{score}</Text></View>
          {phase === 'playing' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Pause Forest Trail" onPress={() => setPhase('paused')} style={styles.pauseButton}>
              <Text style={styles.pauseText}>Ⅱ</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.progressShell} accessibilityLabel={`Trail progress ${progress} percent`}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.heartRow}>
        {Array.from({ length: STARTING_HEARTS }, (_, index) => (
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
          <BuklodSpecialCharacterArtV2 characterId="jawo" height={82} viewportWidth={70} />
          <Text style={styles.playerName}>JAWO</Text>
        </Animated.View>
      </View>

      {phase === 'playing' ? (
        <View style={styles.touchZones}>
          <Pressable accessibilityLabel="Move Jawo left" onPress={() => shiftLane(-1)} style={styles.touchZone} />
          <Pressable accessibilityLabel="Move Jawo right" onPress={() => shiftLane(1)} style={styles.touchZone} />
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <Text style={styles.heroEyebrow}>TRAIL PAUSED</Text>
            <Text style={styles.resultTitle}>READY WHEN YOU ARE</Text>
            <Text style={styles.resultCopy}>Your route and score are safe. Resume to restart the current obstacle's approach.</Text>
            <Pressable onPress={() => setPhase('playing')} style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
              <Text style={styles.startButtonText}>RESUME TRAIL</Text>
            </Pressable>
            <Pressable onPress={reset} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>RESTART RUN</Text>
            </Pressable>
          </View>
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
            <Text style={styles.resultScore}>{score.toLocaleString()}</Text>
            <Text style={styles.scoreCaption}>GAME SCORE • NOT REAL POINTS</Text>
            <Text style={styles.resultMeta}>Best combo x{bestCombo} • Trail Lights {lights} • {'★'.repeat(starsForScore(score)) || 'No star yet'}</Text>
            <Text style={styles.resultCopy}>{phase === 'won' ? 'Trail cleared. This game score is a local preview; only a separate verified Mastery Check can award real Points.' : 'No punishment. Replay, learn the rhythm, and push deeper into the forest.'}</Text>
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
  root: { width: '100%', flex: 0, overflow: 'hidden', position: 'relative', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(187,236,173,0.22)', backgroundColor: '#102a20' },
  world: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  skyGlow: { position: 'absolute', top: '10%', left: '32%', width: '36%', height: '26%', borderRadius: 240, backgroundColor: 'rgba(181,244,194,0.24)' },
  mistBandA: { position: 'absolute', top: '37%', left: '-10%', width: '120%', height: 90, borderRadius: 90, backgroundColor: 'rgba(218,255,229,0.07)', transform: [{ rotate: '-3deg' }] },
  mistBandB: { position: 'absolute', top: '50%', left: '-12%', width: '125%', height: 64, borderRadius: 64, backgroundColor: 'rgba(192,235,214,0.05)', transform: [{ rotate: '4deg' }] },
  treeLineBack: { position: 'absolute', left: 0, right: 0, top: '20%', height: 260, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  treeBack: { width: 56, alignItems: 'center' },
  treeBackCrown: { width: 54, height: 130, borderRadius: 50, backgroundColor: '#287449' },
  treeBackTrunk: { width: 10, height: 95, borderRadius: 6, marginTop: -22, backgroundColor: '#422f22' },
  treeLineFront: { position: 'absolute', left: -42, right: -42, top: '31%', height: 340, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  treeFront: { width: 88, alignItems: 'center', opacity: 0.74 },
  treeFrontCrown: { width: 84, height: 190, borderRadius: 70, backgroundColor: '#185b35' },
  treeFrontTrunk: { width: 16, height: 130, borderRadius: 7, marginTop: -28, backgroundColor: '#34271f' },
  horizon: { position: 'absolute', left: '44%', top: '41%', width: '12%', height: 5, borderRadius: 4, backgroundColor: 'rgba(220,255,220,0.35)' },
  trailPerspective: { position: 'absolute', left: '12%', right: '12%', bottom: -60, height: '70%', borderTopLeftRadius: 150, borderTopRightRadius: 150, backgroundColor: 'rgba(23,48,28,0.68)', borderWidth: 1, borderColor: 'rgba(191,231,170,0.33)', overflow: 'hidden' },
  trailGlow: { position: 'absolute', left: '47%', top: 0, width: '6%', height: '100%', backgroundColor: 'rgba(189,236,150,0.08)' },
  trailLineLeft: { position: 'absolute', left: '33%', top: 0, width: 2, height: '100%', backgroundColor: 'rgba(222,255,218,0.14)', transform: [{ rotate: '7deg' }] },
  trailLineRight: { position: 'absolute', right: '33%', top: 0, width: 2, height: '100%', backgroundColor: 'rgba(222,255,218,0.14)', transform: [{ rotate: '-7deg' }] },
  centerGuide: { position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.05)' },
  encounterLayer: { position: 'absolute', left: 12, right: 12, top: '31%', height: 90, flexDirection: 'row', justifyContent: 'space-between' },
  encounterLane: { flex: 1, height: 90, alignItems: 'center', justifyContent: 'flex-start' },
  rock: { marginTop: 12, width: 56, height: 43, borderRadius: 16, backgroundColor: '#7c7965', transform: [{ rotate: '-8deg' }], borderWidth: 2, borderColor: '#d6ad83', shadowColor: '#f0a178', shadowOpacity: 0.55, shadowRadius: 10 },
  rockFacet: { position: 'absolute', top: 7, left: 10, width: 30, height: 14, borderRadius: 10, backgroundColor: '#667065', opacity: 0.65 },
  lightOrb: { marginTop: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(225,255,159,0.55)', borderWidth: 2, borderColor: '#f8ffe2', alignItems: 'center', justifyContent: 'center', shadowColor: '#eaff8f', shadowOpacity: 0.95, shadowRadius: 18 },
  lightCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#f3ffb5' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e9ffd8', zIndex: 2 },
  topHud: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'column', gap: 8, zIndex: 5 },
  identityBlock: { width: '100%' },
  kicker: { color: '#bde9c6', fontSize: 10, fontWeight: '900', letterSpacing: 1.0 },
  zoneName: { color: '#ffffff', fontSize: 23, fontWeight: '900', marginTop: 3 },
  hudRight: { flexDirection: 'row', gap: 6, width: '100%' },
  statPill: { flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(4,14,9,0.80)', borderWidth: 1, borderColor: 'rgba(198,239,204,0.28)', alignItems: 'center' },
  statLabel: { color: '#8fc79b', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { color: '#ffffff', fontSize: 15, fontWeight: '900', marginTop: 1 },
  pauseButton: { width: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(4,14,9,0.85)', borderWidth: 1, borderColor: 'rgba(198,239,204,0.32)' },
  pauseText: { color: '#e8f5a7', fontSize: 19, fontWeight: '900' },
  progressShell: { position: 'absolute', top: 126, left: 14, right: 14, height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.17)', zIndex: 5 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#dff59b' },
  heartRow: { position: 'absolute', top: 140, left: 14, flexDirection: 'row', gap: 7, zIndex: 5 },
  heartMark: { width: 22, height: 8, borderRadius: 8, backgroundColor: '#dceca6' },
  heartEmpty: { backgroundColor: 'rgba(255,255,255,0.14)' },
  messagePanel: { position: 'absolute', left: 12, right: 12, bottom: 11, zIndex: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(3,11,7,0.87)', borderWidth: 1, borderColor: 'rgba(213,245,198,0.27)' },
  message: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  speedText: { color: '#98cda3', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 4 },
  playerArea: { position: 'absolute', left: 0, right: 0, bottom: 98, height: 103, alignItems: 'center', justifyContent: 'flex-end', zIndex: 4 },
  playerShadow: { position: 'absolute', bottom: 4, width: 62, height: 16, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.34)' },
  player: { width: 78, height: 102, alignItems: 'center', justifyContent: 'flex-end' },
  playerGlow: { position: 'absolute', bottom: 12, width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(202,244,174,0.10)' },
  playerName: { color: '#e7f4e8', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 4 },
  touchZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 3 },
  touchZone: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: 'rgba(2,9,6,0.70)' },
  heroCard: { width: '100%', maxWidth: 610, padding: 17, borderRadius: 22, backgroundColor: 'rgba(5,18,12,0.91)', borderWidth: 1, borderColor: 'rgba(213,244,203,0.19)' },
  heroEyebrow: { color: '#a7d4af', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  heroTitle: { color: '#ffffff', fontSize: 29, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 6 },
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
  resultCard: { width: '100%', maxWidth: 560, padding: 18, borderRadius: 22, backgroundColor: 'rgba(5,18,12,0.94)', borderWidth: 1, borderColor: 'rgba(213,244,203,0.20)', alignItems: 'center' },
  resultTitle: { color: '#ffffff', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  resultScore: { color: '#e8f5a7', fontSize: 40, fontWeight: '900', marginTop: 12 },
  scoreCaption: { color: '#d9e7ba', fontSize: 10, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  resultMeta: { color: '#c9dec9', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  resultCopy: { color: '#c4d9c6', fontSize: 12, lineHeight: 18, marginTop: 13, textAlign: 'center' },
  secondaryButton: { marginTop: 14, padding: 10 },
  secondaryText: { color: '#d8e5d5', fontSize: 12, fontWeight: '900' },
});
