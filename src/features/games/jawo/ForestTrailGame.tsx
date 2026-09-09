import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BuklodGameResult, BuklodGameStatus } from '../types';

type Lane = 0 | 1 | 2;

type TrailStep = {
  id: number;
  obstacleLane: Lane;
  lightLane: Lane;
  label: string;
};

const GAME_ID = 'jawo-forest-trail';
const STARTING_HEARTS = 3;
const STEP_MS = 1200;
const TRAIL_LENGTH = 12;

const FOREST_LABELS = [
  'Forest Edge',
  'Fern Path',
  'Creek Bend',
  'Whispering Pines',
  'Mossy Crossing',
  'Hidden Grove',
] as const;

const makeTrail = (): TrailStep[] =>
  Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const obstacleLane = (index % 3) as Lane;
    const lightLane = ((index + 1 + (index % 2)) % 3) as Lane;
    return {
      id: index,
      obstacleLane,
      lightLane,
      label: FOREST_LABELS[index % FOREST_LABELS.length],
    };
  });

const starsForScore = (score: number): 0 | 1 | 2 | 3 => {
  if (score >= 900) return 3;
  if (score >= 600) return 2;
  if (score >= 300) return 1;
  return 0;
};

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function ForestTrailGame({ onFinish }: Props) {
  const trail = useMemo(makeTrail, []);
  const [status, setStatus] = useState<BuklodGameStatus>('ready');
  const [lane, setLane] = useState<Lane>(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(STARTING_HEARTS);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Choose a lane, then start the trail.');
  const finishingRef = useRef(false);

  const finishGame = useCallback(
    (finalStatus: 'won' | 'lost', finalScore: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setStatus(finalStatus);

      const stars = starsForScore(finalScore);
      const result: BuklodGameResult = {
        gameId: GAME_ID,
        status: finalStatus,
        score: finalScore,
        stars,
        reward: {
          xp: finalStatus === 'won' ? 120 + stars * 40 : 20,
          kingdomXp: finalStatus === 'won' ? 50 + stars * 20 : 5,
          collectibleKey: finalStatus === 'won' && stars === 3 ? 'jawo-forest-first-light' : undefined,
        },
      };

      onFinish?.(result);
    },
    [onFinish],
  );

  const resolveStep = useCallback(() => {
    if (status !== 'playing') return;

    const current = trail[stepIndex];
    if (!current) {
      finishGame('won', score);
      return;
    }

    let nextHearts = hearts;
    let points = 35;
    let nextMessage = `Safe through ${current.label}. +35`;

    if (lane === current.obstacleLane) {
      nextHearts -= 1;
      points = 0;
      nextMessage = `Obstacle at ${current.label}. Move to another trail.`;
    } else if (lane === current.lightLane) {
      points = 110;
      nextMessage = `Trail Light collected at ${current.label}! +110`;
    }

    const nextScore = score + points;
    const nextStep = stepIndex + 1;

    setHearts(nextHearts);
    setScore(nextScore);
    setMessage(nextMessage);
    setStepIndex(nextStep);

    if (nextHearts <= 0) {
      finishGame('lost', nextScore);
      return;
    }

    if (nextStep >= trail.length) {
      finishGame('won', nextScore);
    }
  }, [finishGame, hearts, lane, score, status, stepIndex, trail]);

  useEffect(() => {
    if (status !== 'playing') return undefined;
    const timer = setTimeout(resolveStep, STEP_MS);
    return () => clearTimeout(timer);
  }, [resolveStep, status]);

  const reset = useCallback(() => {
    finishingRef.current = false;
    setStatus('ready');
    setLane(1);
    setStepIndex(0);
    setHearts(STARTING_HEARTS);
    setScore(0);
    setMessage('Choose a lane, then start the trail.');
  }, []);

  const start = useCallback(() => {
    finishingRef.current = false;
    setStatus('playing');
    setMessage('The forest trail is moving. Watch the next obstacle.');
  }, []);

  const progress = Math.min(100, Math.round((stepIndex / trail.length) * 100));
  const current = trail[Math.min(stepIndex, trail.length - 1)];
  const visibleSteps = trail.slice(stepIndex, stepIndex + 4);

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>JAWO • WHISPERING FOREST</Text>
          <Text style={styles.title}>Forest Trail</Text>
        </View>
        <View style={styles.hudBlock}>
          <Text style={styles.hudText}>{'❤'.repeat(Math.max(0, hearts))}</Text>
          <Text style={styles.hudText}>Score {score}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.forestFrame}>
        <View style={styles.canopyRow}>
          <Text style={styles.canopy}>🌲 🌿 🌲 🌳 🌿 🌲</Text>
        </View>

        <View style={styles.road}>
          {[0, 1, 2].map((rawLane) => {
            const laneIndex = rawLane as Lane;
            const isPlayer = lane === laneIndex;
            const hasObstacle = current && current.obstacleLane === laneIndex;
            const hasLight = current && current.lightLane === laneIndex;

            return (
              <Pressable
                key={laneIndex}
                accessibilityRole="button"
                accessibilityLabel={`Move to trail ${laneIndex + 1}`}
                onPress={() => status !== 'won' && status !== 'lost' && setLane(laneIndex)}
                style={({ pressed }) => [styles.lane, isPlayer && styles.activeLane, pressed && styles.pressedLane]}
              >
                <Text style={styles.laneNumber}>TRAIL {laneIndex + 1}</Text>
                <View style={styles.objectSlot}>
                  {hasObstacle ? <Text style={styles.object}>🪨</Text> : null}
                  {hasLight ? <Text style={styles.object}>✨</Text> : null}
                </View>
                <Text style={styles.player}>{isPlayer ? '🧭' : '·'}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.upcomingRow}>
          {visibleSteps.map((step, index) => (
            <View key={step.id} style={styles.upcomingCard}>
              <Text style={styles.upcomingLabel}>{index === 0 ? 'NOW' : `+${index}`}</Text>
              <Text style={styles.upcomingName}>{step.label}</Text>
              <Text style={styles.upcomingHint}>🪨 {step.obstacleLane + 1} · ✨ {step.lightLane + 1}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.moveButton} onPress={() => setLane((Math.max(0, lane - 1) as Lane))}>
          <Text style={styles.moveText}>← LEFT</Text>
        </Pressable>

        {status === 'ready' ? (
          <Pressable style={styles.primaryButton} onPress={start}>
            <Text style={styles.primaryText}>START TRAIL</Text>
          </Pressable>
        ) : status === 'playing' ? (
          <View style={styles.runningPill}>
            <Text style={styles.runningText}>RUNNING • {progress}%</Text>
          </View>
        ) : (
          <Pressable style={styles.primaryButton} onPress={reset}>
            <Text style={styles.primaryText}>PLAY AGAIN</Text>
          </Pressable>
        )}

        <Pressable style={styles.moveButton} onPress={() => setLane((Math.min(2, lane + 1) as Lane))}>
          <Text style={styles.moveText}>RIGHT →</Text>
        </Pressable>
      </View>

      {status === 'won' || status === 'lost' ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{status === 'won' ? 'TRAIL CLEARED' : 'TRAIL ENDED'}</Text>
          <Text style={styles.resultScore}>{score} points • {'★'.repeat(starsForScore(score)) || 'No star yet'}</Text>
          <Text style={styles.resultHint}>
            {status === 'won'
              ? 'This result is ready to connect later to Jawo XP, collectibles, and the Forest map station unlock.'
              : 'Replay is safe. No map or character progress is written yet in this standalone prototype.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    backgroundColor: '#0d2818',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  eyebrow: {
    color: '#9dd7a8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  hudBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hudText: {
    color: '#f4d97d',
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#173d27',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f1cb58',
  },
  message: {
    color: '#d9eadc',
    fontSize: 15,
    minHeight: 22,
  },
  forestFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#18462b',
    borderWidth: 1,
    borderColor: '#2c6841',
  },
  canopyRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#123c22',
  },
  canopy: {
    fontSize: 26,
    textAlign: 'center',
  },
  road: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    minHeight: 270,
  },
  lane: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#37724b',
    backgroundColor: '#245738',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  activeLane: {
    borderColor: '#f1cb58',
    backgroundColor: '#2e6741',
  },
  pressedLane: {
    opacity: 0.8,
  },
  laneNumber: {
    color: '#b9d9c1',
    fontSize: 11,
    fontWeight: '800',
  },
  objectSlot: {
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  object: {
    fontSize: 34,
  },
  player: {
    fontSize: 42,
  },
  upcomingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: '#102e1c',
  },
  upcomingCard: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: '#173d27',
    padding: 10,
  },
  upcomingLabel: {
    color: '#f1cb58',
    fontSize: 10,
    fontWeight: '900',
  },
  upcomingName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  upcomingHint: {
    color: '#a8cbb0',
    fontSize: 11,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  moveButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5e8a68',
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: '#173d27',
  },
  moveText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#f1cb58',
  },
  primaryText: {
    color: '#193321',
    fontWeight: '900',
  },
  runningPill: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#2d6640',
  },
  runningText: {
    color: '#e7f4ea',
    fontWeight: '900',
  },
  resultCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#173d27',
    borderWidth: 1,
    borderColor: '#557b5f',
    gap: 6,
  },
  resultTitle: {
    color: '#f4d97d',
    fontSize: 20,
    fontWeight: '900',
  },
  resultScore: {
    color: '#ffffff',
    fontWeight: '800',
  },
  resultHint: {
    color: '#b9d9c1',
    lineHeight: 20,
  },
});
