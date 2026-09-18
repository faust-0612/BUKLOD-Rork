import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type ResourceKey = 'water' | 'food' | 'energy' | 'morale';

type Resources = Record<ResourceKey, number>;

type RouteChoice = {
  id: string;
  title: string;
  description: string;
  terrain: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  delta: Partial<Resources>;
  score: number;
  result: string;
};

type Leg = {
  id: string;
  name: string;
  distance: string;
  narrative: string;
  choices: readonly [RouteChoice, RouteChoice];
};

const GAME_ID = 'niel-mission-trail';
const STARTING_RESOURCES: Resources = {
  water: 72,
  food: 68,
  energy: 76,
  morale: 70,
};

const LEGS: Leg[] = [
  {
    id: 'river-pass',
    name: 'River Pass',
    distance: '4.2 km',
    narrative: 'The direct trail is flooded. A ridge detour is safer, but it will cost time and supplies.',
    choices: [
      {
        id: 'ford',
        title: 'Cross the ford',
        description: 'Fast route through knee-deep water. Save food, spend energy.',
        terrain: 'River crossing',
        risk: 'HIGH',
        delta: { water: 4, food: -4, energy: -18, morale: 5 },
        score: 250,
        result: 'The team crosses quickly and reaches higher ground before the current rises.',
      },
      {
        id: 'ridge',
        title: 'Take the ridge',
        description: 'Longer climb with dry footing and a good view of the next valley.',
        terrain: 'High ridge',
        risk: 'LOW',
        delta: { water: -10, food: -9, energy: -10, morale: 7 },
        score: 205,
        result: 'The ridge costs supplies, but the route ahead becomes easier to read.',
      },
    ],
  },
  {
    id: 'broken-bridge',
    name: 'Broken Bridge',
    distance: '3.1 km',
    narrative: 'A damaged footbridge blocks the shortest path. Nearby residents are trying to repair it.',
    choices: [
      {
        id: 'repair',
        title: 'Help repair the bridge',
        description: 'Spend energy now to open a safer route for everyone behind you.',
        terrain: 'Community crossing',
        risk: 'MEDIUM',
        delta: { water: -6, food: -5, energy: -15, morale: 18 },
        score: 285,
        result: 'The bridge is stabilized. The team leaves a safer crossing for the community.',
      },
      {
        id: 'ravine',
        title: 'Use the ravine path',
        description: 'Keep moving, but the narrow trail is slow and draining.',
        terrain: 'Ravine path',
        risk: 'MEDIUM',
        delta: { water: -9, food: -8, energy: -12, morale: -3 },
        score: 175,
        result: 'The ravine works, but the detour costs more strength than expected.',
      },
    ],
  },
  {
    id: 'storm-front',
    name: 'Storm Front',
    distance: '5.6 km',
    narrative: 'Dark clouds roll over the trail. A covered school building lies off-route while the open road remains passable.',
    choices: [
      {
        id: 'shelter',
        title: 'Shelter and regroup',
        description: 'Lose travel time, recover energy, and check supplies before continuing.',
        terrain: 'Mountain school',
        risk: 'LOW',
        delta: { water: -4, food: -6, energy: 14, morale: 12 },
        score: 235,
        result: 'The storm passes while the team rests. Everyone leaves stronger and organized.',
      },
      {
        id: 'push',
        title: 'Push through the rain',
        description: 'Maintain pace at the cost of energy and morale.',
        terrain: 'Open road',
        risk: 'HIGH',
        delta: { water: 5, food: -4, energy: -20, morale: -8 },
        score: 255,
        result: 'The team keeps its schedule, but the exposed march takes a toll.',
      },
    ],
  },
  {
    id: 'family-stop',
    name: 'Wayside Family',
    distance: '2.4 km',
    narrative: 'A family along the trail asks for drinking water. The village destination is still several kilometers away.',
    choices: [
      {
        id: 'share',
        title: 'Share supplies',
        description: 'Give part of the team reserve and continue with less margin.',
        terrain: 'Wayside settlement',
        risk: 'MEDIUM',
        delta: { water: -16, food: -6, energy: -3, morale: 22 },
        score: 320,
        result: 'The family is supplied, and the team leaves with renewed purpose despite a smaller reserve.',
      },
      {
        id: 'ration',
        title: 'Protect mission reserve',
        description: 'Keep critical supplies for the final climb and offer directions to the next water source.',
        terrain: 'Wayside settlement',
        risk: 'LOW',
        delta: { water: -5, food: -5, energy: -2, morale: -6 },
        score: 165,
        result: 'The team preserves its reserve, but morale dips after the difficult decision.',
      },
    ],
  },
  {
    id: 'final-climb',
    name: 'Final Climb',
    distance: '4.8 km',
    narrative: 'The remote village is visible across the final slope. There is a steep shortcut and a longer shaded trail.',
    choices: [
      {
        id: 'shortcut',
        title: 'Take the steep ascent',
        description: 'Fast finish with a heavy energy cost.',
        terrain: 'Stone ascent',
        risk: 'HIGH',
        delta: { water: -8, food: -7, energy: -22, morale: 8 },
        score: 310,
        result: 'The team crests the hill and reaches the village before sunset.',
      },
      {
        id: 'shaded',
        title: 'Use the shaded trail',
        description: 'Safer arrival, but consume more water and food during the longer approach.',
        terrain: 'Forest approach',
        risk: 'LOW',
        delta: { water: -13, food: -12, energy: -10, morale: 10 },
        score: 245,
        result: 'The team arrives steadily with enough strength left to begin serving immediately.',
      },
    ],
  },
];

const clampResource = (value: number) => Math.max(0, Math.min(100, value));

const starsFor = (score: number, resources: Resources): 1 | 2 | 3 => {
  const reserve = resources.water + resources.food + resources.energy + resources.morale;
  if (score >= 1250 && reserve >= 185) return 3;
  if (score >= 1000 && reserve >= 125) return 2;
  return 1;
};

const resourceLabel: Record<ResourceKey, string> = {
  water: 'WATER',
  food: 'FOOD',
  energy: 'ENERGY',
  morale: 'MORALE',
};

function ResourceMeter({ name, value }: { name: ResourceKey; value: number }) {
  return (
    <View style={styles.resourceMeter}>
      <View style={styles.resourceHeader}>
        <Text style={styles.resourceName}>{resourceLabel[name]}</Text>
        <Text style={styles.resourceValue}>{value}</Text>
      </View>
      <View style={styles.resourceTrack}>
        <View style={[styles.resourceFill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

type Props = {
  onFinish?: (result: BuklodGameResult) => void;
};

export function MissionTrailGameV1({ onFinish }: Props) {
  const [legIndex, setLegIndex] = useState(0);
  const [resources, setResources] = useState<Resources>(STARTING_RESOURCES);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('Plan the expedition. Every decision changes the team reserve and the road ahead.');
  const transition = useRef(new Animated.Value(1)).current;

  const leg = LEGS[Math.min(legIndex, LEGS.length - 1)];
  const progress = Math.round((legIndex / LEGS.length) * 100);

  const reset = useCallback(() => {
    setLegIndex(0);
    setResources(STARTING_RESOURCES);
    setScore(0);
    setHistory([]);
    setFinished(false);
    setFailed(false);
    setMessage('Plan the expedition. Every decision changes the team reserve and the road ahead.');
    transition.setValue(1);
  }, [transition]);

  const finishGame = useCallback(
    (finalScore: number, finalResources: Resources) => {
      const stars = starsFor(finalScore, finalResources);
      setFinished(true);
      setMessage('Remote village reached. Mission route complete.');
      void playBuklodGameFeedback('success');
      onFinish?.({
        gameId: GAME_ID,
        status: 'won',
        score: finalScore,
        stars,
        reward: {
          xp: 145 + stars * 50,
          kingdomXp: 65 + stars * 22,
          collectibleKey: stars === 3 ? 'niel-pathfinder-compass' : undefined,
        },
      });
    },
    [onFinish],
  );

  const chooseRoute = useCallback(
    (choice: RouteChoice) => {
      if (finished || failed) return;

      const nextResources = (Object.keys(resources) as ResourceKey[]).reduce<Resources>(
        (next, key) => {
          next[key] = clampResource(resources[key] + (choice.delta[key] ?? 0));
          return next;
        },
        { ...resources },
      );

      const depleted = (Object.keys(nextResources) as ResourceKey[]).some((key) => nextResources[key] <= 0);
      const reserveBonus = Math.round(
        (nextResources.water + nextResources.food + nextResources.energy + nextResources.morale) / 12,
      );
      const nextScore = score + choice.score + reserveBonus;
      const nextLegIndex = legIndex + 1;

      setResources(nextResources);
      setScore(nextScore);
      setHistory((items) => [...items, `${leg.name}: ${choice.title}`]);
      setMessage(choice.result);
      void playBuklodGameFeedback(choice.risk === 'HIGH' ? 'impact' : 'collect');

      transition.setValue(0.2);
      Animated.spring(transition, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 150,
        damping: 18,
        mass: 0.85,
      }).start();

      if (depleted) {
        setFailed(true);
        setMessage('The expedition reserve collapsed before the village. Replan the route and protect every critical resource.');
        void playBuklodGameFeedback('failure');
        onFinish?.({
          gameId: GAME_ID,
          status: 'lost',
          score: nextScore,
          stars: 0,
          reward: { xp: 25, kingdomXp: 8 },
        });
        return;
      }

      if (nextLegIndex >= LEGS.length) {
        setLegIndex(nextLegIndex);
        finishGame(nextScore, nextResources);
      } else {
        setLegIndex(nextLegIndex);
      }
    },
    [failed, finishGame, finished, leg.name, legIndex, onFinish, resources, score, transition],
  );

  const reserveScore = useMemo(
    () => resources.water + resources.food + resources.energy + resources.morale,
    [resources],
  );

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>NIEL • MISSION FRONTIER</Text>
          <Text style={styles.title}>Mission Trail</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>MISSION SCORE</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{finished ? 'ARRIVED' : `LEG ${Math.min(legIndex + 1, LEGS.length)} / ${LEGS.length}`}</Text>
        <Text style={styles.progressText}>{progress}% route</Text>
        <Text style={styles.progressText}>Reserve {reserveScore}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${finished ? 100 : progress}%` }]} />
      </View>

      <View style={styles.resourcesGrid}>
        {(Object.keys(resources) as ResourceKey[]).map((key) => (
          <ResourceMeter key={key} name={key} value={resources[key]} />
        ))}
      </View>

      <Text style={styles.message}>{message}</Text>

      {!finished && !failed ? (
        <Animated.View
          style={[
            styles.expeditionCard,
            {
              opacity: transition,
              transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
        >
          <View style={styles.terrainHeader}>
            <View>
              <Text style={styles.legName}>{leg.name}</Text>
              <Text style={styles.distance}>{leg.distance}</Text>
            </View>
            <Text style={styles.marker}>ROUTE {legIndex + 1}</Text>
          </View>

          <Text style={styles.narrative}>{leg.narrative}</Text>

          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeBar} />
            <View style={[styles.routeDot, styles.routeDotGoal]} />
          </View>

          <View style={styles.choices}>
            {leg.choices.map((choice) => (
              <Pressable
                key={choice.id}
                onPress={() => chooseRoute(choice)}
                style={({ pressed }) => [styles.choiceCard, pressed && styles.choicePressed]}
              >
                <View style={styles.choiceTop}>
                  <Text style={styles.choiceTitle}>{choice.title}</Text>
                  <View style={styles.riskBadge}>
                    <Text style={styles.riskText}>{choice.risk}</Text>
                  </View>
                </View>
                <Text style={styles.terrain}>{choice.terrain}</Text>
                <Text style={styles.choiceDescription}>{choice.description}</Text>
                <View style={styles.deltaRow}>
                  {(Object.keys(choice.delta) as ResourceKey[]).map((key) => {
                    const value = choice.delta[key] ?? 0;
                    return (
                      <Text key={key} style={styles.deltaText}>
                        {resourceLabel[key]} {value >= 0 ? '+' : ''}{value}
                      </Text>
                    );
                  })}
                </View>
                <Text style={styles.chooseText}>TAKE THIS ROUTE →</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.finishCard, failed && styles.failCard]}>
          <Text style={styles.finishKicker}>{failed ? 'EXPEDITION INTERRUPTED' : 'MISSION FRONTIER'}</Text>
          <Text style={styles.finishTitle}>{failed ? 'REPLAN THE TRAIL' : 'VILLAGE REACHED'}</Text>
          <Text style={styles.finishCopy}>
            {failed
              ? 'A critical reserve reached zero. Route choice matters more than raw speed.'
              : 'The route is complete. Later, this result can permanently open Niel’s next frontier station and change the Mission map.'}
          </Text>
          <View style={styles.historyBox}>
            {history.map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.historyText}>• {item}</Text>
            ))}
          </View>
          <Pressable onPress={reset} style={styles.replayButton}>
            <Text style={styles.replayText}>PLAN ANOTHER EXPEDITION</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 13,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { color: '#a9d8b6', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#f4fff7', fontSize: 31, fontWeight: '900', marginTop: 3 },
  scoreBlock: { alignItems: 'flex-end' },
  score: { color: '#dff5c8', fontSize: 29, fontWeight: '900' },
  scoreLabel: { color: '#9ab7a0', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressText: { color: '#d0e6d6', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#a7d06f' },
  resourcesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resourceMeter: { flexBasis: 180, flexGrow: 1, gap: 4 },
  resourceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  resourceName: { color: '#b7cbbd', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  resourceValue: { color: '#effff2', fontSize: 11, fontWeight: '900' },
  resourceTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, overflow: 'hidden' },
  resourceFill: { height: '100%', backgroundColor: '#9bcf82', borderRadius: 999 },
  message: { color: '#e7f4ea', fontSize: 14, lineHeight: 21, minHeight: 42 },
  expeditionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(190,231,199,0.22)',
    backgroundColor: 'rgba(8,30,20,0.78)',
    padding: 18,
    gap: 14,
  },
  terrainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  legName: { color: '#ffffff', fontSize: 25, fontWeight: '900' },
  distance: { color: '#9ec5aa', fontSize: 12, fontWeight: '800', marginTop: 2 },
  marker: { color: '#d7ec9b', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  narrative: { color: '#d5e5d9', fontSize: 15, lineHeight: 22 },
  routeLine: { height: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  routeDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#dbeea4' },
  routeDotGoal: { backgroundColor: '#f0c870' },
  routeBar: { flex: 1, height: 2, backgroundColor: 'rgba(219,238,164,0.36)', marginHorizontal: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choiceCard: {
    flexBasis: 300,
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    padding: 15,
    gap: 7,
  },
  choicePressed: { transform: [{ scale: 0.985 }], backgroundColor: 'rgba(255,255,255,0.09)' },
  choiceTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  choiceTitle: { color: '#fffef4', fontSize: 18, fontWeight: '900', flex: 1 },
  riskBadge: { borderRadius: 999, backgroundColor: 'rgba(222,196,107,0.14)', paddingHorizontal: 8, paddingVertical: 4 },
  riskText: { color: '#f0d88e', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  terrain: { color: '#9fc8aa', fontSize: 11, fontWeight: '900' },
  choiceDescription: { color: '#d5e2d8', fontSize: 13, lineHeight: 19 },
  deltaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  deltaText: { color: '#dceccf', fontSize: 9, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.16)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999 },
  chooseText: { color: '#e7cf7b', fontSize: 11, fontWeight: '900', marginTop: 4 },
  finishCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: 'rgba(20,61,38,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(190,236,174,0.30)',
    gap: 10,
  },
  failCard: { backgroundColor: 'rgba(65,30,27,0.90)', borderColor: 'rgba(238,160,136,0.30)' },
  finishKicker: { color: '#d9e9a9', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  finishTitle: { color: '#ffffff', fontSize: 29, fontWeight: '900' },
  finishCopy: { color: '#e0eee3', fontSize: 14, lineHeight: 21 },
  historyBox: { gap: 4, marginVertical: 4 },
  historyText: { color: '#c8dbc9', fontSize: 12, lineHeight: 18 },
  replayButton: { alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, backgroundColor: '#d7e793', paddingHorizontal: 16, paddingVertical: 11 },
  replayText: { color: '#19321d', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
});
