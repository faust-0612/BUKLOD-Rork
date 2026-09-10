import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type FragmentSpec = {
  id: string;
  label: string;
  labelTl: string;
  start: { x: number; y: number };
  target: { x: number; y: number };
  colors: readonly [string, string];
  motif: 'sun' | 'river' | 'mountain' | 'leaf' | 'flame' | 'path';
};

type PlacedFragment = { id: string; precision: number };

const GAME_ID = 'mitch-restore-mural';
const DROP_RADIUS = 58;

const FRAGMENTS: FragmentSpec[] = [
  { id: 'sunrise', label: 'Dawn', labelTl: 'Bukang-Liwayway', start: { x: 20, y: 390 }, target: { x: 74, y: 84 }, colors: ['#f1b94a', '#d96945'], motif: 'sun' },
  { id: 'ridge', label: 'Ridge', labelTl: 'Gulod', start: { x: 133, y: 390 }, target: { x: 172, y: 84 }, colors: ['#81556e', '#4c355d'], motif: 'mountain' },
  { id: 'canopy', label: 'Canopy', labelTl: 'Lilim', start: { x: 246, y: 390 }, target: { x: 74, y: 182 }, colors: ['#6a8b52', '#35573e'], motif: 'leaf' },
  { id: 'river', label: 'River', labelTl: 'Ilog', start: { x: 20, y: 500 }, target: { x: 172, y: 182 }, colors: ['#4a839c', '#30546f'], motif: 'river' },
  { id: 'ember', label: 'Ember', labelTl: 'Baga', start: { x: 133, y: 500 }, target: { x: 74, y: 280 }, colors: ['#c86f48', '#7d3d39'], motif: 'flame' },
  { id: 'journey', label: 'Journey', labelTl: 'Paglalakbay', start: { x: 246, y: 500 }, target: { x: 172, y: 280 }, colors: ['#d4b76d', '#7e6949'], motif: 'path' },
];

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const starsForScore = (score: number): 1 | 2 | 3 => (score >= 1450 ? 3 : score >= 1150 ? 2 : 1);

const localizeMessage = (message: string, language: 'en' | 'tl') => {
  if (language === 'en') return message;
  const exact: Record<string, string> = {
    'Drag each fragment into the faded mural. Precision builds your restoration score.': 'I-drag ang bawat piraso papunta sa kupas na mural. Mas eksaktong pagkakalagay, mas mataas ang restoration score.',
    'That fragment does not belong there. Read the shape and color flow, then try again.': 'Hindi roon nababagay ang pirasong iyon. Basahin ang hugis at daloy ng kulay, saka subukan muli.',
  };
  if (exact[message]) return exact[message];

  let match = message.match(/^Mural restored • (\d+)% average precision$/);
  if (match) return `Naibalik ang mural • ${match[1]}% karaniwang precision`;

  match = message.match(/^Clean restoration • (\d+)% precision • combo ×(\d+)$/);
  if (match) return `Malinis na restoration • ${match[1]}% precision • combo ×${match[2]}`;

  match = message.match(/^Fragment restored • (\d+)% precision$/);
  if (match) return `Naibalik ang piraso • ${match[1]}% precision`;

  return message;
};

function FragmentArt({ spec, muted = false }: { spec: FragmentSpec; muted?: boolean }) {
  const accent = muted ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.42)';
  return (
    <View style={[styles.fragmentArt, { backgroundColor: muted ? '#3b343a' : spec.colors[0] }]}>
      <View
        style={[
          styles.fragmentSweep,
          { backgroundColor: muted ? '#29252a' : spec.colors[1] },
          spec.motif === 'river' && styles.riverSweep,
          spec.motif === 'mountain' && styles.mountainSweep,
          spec.motif === 'leaf' && styles.leafSweep,
          spec.motif === 'flame' && styles.flameSweep,
          spec.motif === 'path' && styles.pathSweep,
        ]}
      />
      {spec.motif === 'sun' ? <View style={[styles.sunCore, { borderColor: accent }]} /> : null}
      <View style={[styles.artLineA, { backgroundColor: accent }]} />
      <View style={[styles.artLineB, { backgroundColor: accent }]} />
    </View>
  );
}

type DraggableFragmentProps = {
  spec: FragmentSpec;
  placed: boolean;
  resetKey: number;
  active: boolean;
  onActive: (id: string | null) => void;
  onPlaced: (id: string, precision: number) => void;
  onMiss: () => void;
};

function DraggableFragment({ spec, placed, resetKey, active, onActive, onPlaced, onMiss }: DraggableFragmentProps) {
  const { language } = useBuklodGameLanguage();
  const position = useRef(new Animated.ValueXY(spec.start)).current;

  useEffect(() => {
    if (!placed) position.setValue(spec.start);
  }, [placed, position, resetKey, spec.start]);

  const responder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => !placed,
      onMoveShouldSetPanResponder: () => !placed,
      onPanResponderGrant: () => {
        onActive(spec.id);
        position.stopAnimation();
        position.setOffset(spec.start);
        position.setValue({ x: 0, y: 0 });
        void playBuklodGameFeedback('move');
      },
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_event, gesture) => {
        position.flattenOffset();
        const current = { x: spec.start.x + gesture.dx, y: spec.start.y + gesture.dy };
        const dropDistance = distance(current, spec.target);

        if (dropDistance <= DROP_RADIUS) {
          const precision = Math.max(0, Math.round(100 - (dropDistance / DROP_RADIUS) * 100));
          Animated.spring(position, {
            toValue: spec.target,
            useNativeDriver: false,
            stiffness: 210,
            damping: 22,
            mass: 0.8,
          }).start(() => onPlaced(spec.id, precision));
        } else {
          Animated.spring(position, {
            toValue: spec.start,
            useNativeDriver: false,
            stiffness: 190,
            damping: 19,
          }).start();
          onMiss();
        }
        onActive(null);
      },
      onPanResponderTerminate: () => {
        position.flattenOffset();
        Animated.spring(position, { toValue: spec.start, useNativeDriver: false }).start();
        onActive(null);
      },
    }),
    [onActive, onMiss, onPlaced, placed, position, spec],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      pointerEvents={placed ? 'none' : 'auto'}
      style={[
        styles.dragPiece,
        {
          transform: position.getTranslateTransform(),
          opacity: placed ? 0 : 1,
          zIndex: active ? 50 : 10,
        },
      ]}
    >
      <FragmentArt spec={spec} />
      <Text style={styles.fragmentLabel}>{language === 'tl' ? spec.labelTl : spec.label}</Text>
    </Animated.View>
  );
}

type Props = { onFinish?: (result: BuklodGameResult) => void };

export function RestoreMuralGameV1({ onFinish }: Props) {
  const { language, t } = useBuklodGameLanguage();
  const [placed, setPlaced] = useState<PlacedFragment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [message, setMessage] = useState('Drag each fragment into the faded mural. Precision builds your restoration score.');

  const placedIds = useMemo(() => new Set(placed.map((item) => item.id)), [placed]);
  const progress = placed.length / FRAGMENTS.length;

  const finishGame = useCallback((finalScore: number, finalPlaced: PlacedFragment[]) => {
    const averagePrecision = Math.round(finalPlaced.reduce((sum, item) => sum + item.precision, 0) / finalPlaced.length);
    const stars = starsForScore(finalScore);
    setFinished(true);
    setMessage(`Mural restored • ${averagePrecision}% average precision`);
    void playBuklodGameFeedback('success');
    onFinish?.({
      gameId: GAME_ID,
      status: 'won',
      score: finalScore,
      stars,
      reward: {
        xp: 130 + stars * 45,
        kingdomXp: 55 + stars * 20,
        collectibleKey: stars === 3 ? 'mitch-master-restorer-mark' : undefined,
      },
    });
  }, [onFinish]);

  const handlePlaced = useCallback((id: string, precision: number) => {
    if (placedIds.has(id) || finished) return;
    const nextCombo = combo + 1;
    const nextScore = score + 120 + precision + nextCombo * 20;
    const nextPlaced = [...placed, { id, precision }];
    setPlaced(nextPlaced);
    setCombo(nextCombo);
    setScore(nextScore);
    setMessage(precision >= 80 ? `Clean restoration • ${precision}% precision • combo ×${nextCombo}` : `Fragment restored • ${precision}% precision`);
    void playBuklodGameFeedback('collect');
    if (nextPlaced.length === FRAGMENTS.length) finishGame(nextScore, nextPlaced);
  }, [combo, finishGame, finished, placed, placedIds, score]);

  const handleMiss = useCallback(() => {
    if (finished) return;
    setMistakes((value) => value + 1);
    setCombo(0);
    setScore((value) => Math.max(0, value - 25));
    setMessage('That fragment does not belong there. Read the shape and color flow, then try again.');
    void playBuklodGameFeedback('impact');
  }, [finished]);

  const reset = useCallback(() => {
    setPlaced([]);
    setActiveId(null);
    setMistakes(0);
    setCombo(0);
    setScore(0);
    setFinished(false);
    setResetKey((value) => value + 1);
    setMessage('Drag each fragment into the faded mural. Precision builds your restoration score.');
  }, []);

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>{t('MITCH • ART VILLAGE', 'MITCH • PAMAYANAN NG SINING')}</Text>
          <Text style={styles.title}>{t('Restore the Mural', 'Ibalik ang Mural')}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>{t('RESTORE SCORE', 'ISKOR SA RESTORATION')}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{Math.round(progress * 100)}% {t('restored', 'naibalik')}</Text>
        <Text style={styles.statusText}>Combo ×{combo}</Text>
        <Text style={styles.statusText}>{t('Misses', 'Mga mali')} {mistakes}</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
      <Text style={styles.message}>{localizeMessage(message, language)}</Text>

      <View style={styles.board}>
        <View style={styles.wallGlow} />
        <View style={styles.muralFrame}>
          <View style={styles.muralGrid}>
            {FRAGMENTS.map((fragment) => {
              const restored = placedIds.has(fragment.id);
              return (
                <View key={fragment.id} style={styles.muralSlot}>
                  <FragmentArt spec={fragment} muted={!restored} />
                  {!restored ? <View style={styles.slotVeil} /> : null}
                </View>
              );
            })}
          </View>
          <View pointerEvents="none" style={[styles.revealGlow, { opacity: progress * 0.85 }]} />
        </View>

        <View style={styles.paletteLabel}><Text style={styles.paletteText}>{t('FRAGMENT TABLE • DRAG TO RESTORE', 'MESA NG MGA PIRASO • I-DRAG PARA IBALIK')}</Text></View>

        {FRAGMENTS.map((fragment) => (
          <DraggableFragment
            key={`${fragment.id}-${resetKey}`}
            spec={fragment}
            placed={placedIds.has(fragment.id)}
            resetKey={resetKey}
            active={activeId === fragment.id}
            onActive={setActiveId}
            onPlaced={handlePlaced}
            onMiss={handleMiss}
          />
        ))}

        {finished ? (
          <View style={styles.completionOverlay}>
            <Text style={styles.completeKicker}>{t('ART VILLAGE RESTORATION', 'RESTORATION NG PAMAYANAN NG SINING')}</Text>
            <Text style={styles.completeTitle}>{t('MURAL AWAKENED', 'MULING NABUHAY ANG MURAL')}</Text>
            <Text style={styles.completeCopy}>{t(
              'Your restoration is recorded. Return to the Kingdom Map to see Mitch’s Art Village progress reflected in the world.',
              'Naitala ang restoration mo. Bumalik sa Mapa ng Kaharian para makita ang progreso ng Art Village ni Mitch sa mundo.',
            )}</Text>
            <Pressable onPress={reset} style={styles.replayButton}><Text style={styles.replayText}>{t('RESTORE AGAIN', 'IBALIK MULI')}</Text></Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.tip}>{t(
        'Drag fragments directly. Near-center drops earn higher precision and stronger combo bonuses.',
        'I-drag nang direkta ang mga piraso. Mas malapit sa gitna ang bagsak, mas mataas ang precision at combo bonus.',
      )}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 18, gap: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  eyebrow: { color: '#f2c98a', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff8ed', fontSize: 30, fontWeight: '900', marginTop: 3 },
  scoreBlock: { alignItems: 'flex-end' },
  score: { color: '#fff3cf', fontSize: 28, fontWeight: '900' },
  scoreLabel: { color: '#d9b987', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statusText: { color: '#ead8c5', fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#e5b35c' },
  message: { minHeight: 38, color: '#f0dfcf', fontSize: 14, lineHeight: 20 },
  board: { width: 360, height: 610, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', backgroundColor: '#2b1d24', borderWidth: 1, borderColor: 'rgba(255,225,184,0.22)', position: 'relative' },
  wallGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(160,92,75,0.12)' },
  muralFrame: { position: 'absolute', left: 58, top: 68, width: 244, height: 316, borderRadius: 18, padding: 10, backgroundColor: '#5b403f', borderWidth: 2, borderColor: '#bd8e69', shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 9 } },
  muralGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  muralSlot: { width: 108, height: 94, borderRadius: 9, overflow: 'hidden', backgroundColor: '#3a3034', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  slotVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(24,20,23,0.56)' },
  revealGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,205,121,0.16)', borderRadius: 14 },
  paletteLabel: { position: 'absolute', top: 360, left: 0, right: 0, alignItems: 'center' },
  paletteText: { color: '#cda985', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  dragPiece: { position: 'absolute', left: 0, top: 0, width: 94, height: 94, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,239,215,0.75)', shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  fragmentArt: { flex: 1, overflow: 'hidden', position: 'relative' },
  fragmentSweep: { position: 'absolute', width: '150%', height: '58%', left: '-20%', bottom: '-10%', transform: [{ rotate: '-12deg' }], borderTopLeftRadius: 60, borderTopRightRadius: 60 },
  riverSweep: { height: '34%', bottom: '20%', transform: [{ rotate: '7deg' }] },
  mountainSweep: { width: '80%', height: '72%', left: '28%', bottom: '-18%', transform: [{ rotate: '42deg' }], borderRadius: 5 },
  leafSweep: { width: '82%', height: '78%', left: '11%', bottom: '2%', transform: [{ rotate: '32deg' }], borderRadius: 70 },
  flameSweep: { width: '62%', height: '94%', left: '26%', bottom: '-20%', transform: [{ rotate: '18deg' }], borderRadius: 70 },
  pathSweep: { width: '36%', height: '120%', left: '34%', bottom: '-10%', transform: [{ rotate: '22deg' }], borderRadius: 30 },
  sunCore: { position: 'absolute', width: 34, height: 34, borderRadius: 17, top: 18, left: 29, borderWidth: 4, backgroundColor: 'rgba(255,245,190,0.3)' },
  artLineA: { position: 'absolute', width: '70%', height: 2, top: '32%', left: '15%', transform: [{ rotate: '-18deg' }] },
  artLineB: { position: 'absolute', width: '58%', height: 2, bottom: '25%', right: '10%', transform: [{ rotate: '24deg' }] },
  fragmentLabel: { position: 'absolute', bottom: 5, left: 7, color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  completionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 90, backgroundColor: 'rgba(30,18,24,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  completeKicker: { color: '#f1c278', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  completeTitle: { color: '#fff8eb', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  completeCopy: { color: '#ead8c9', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  replayButton: { marginTop: 8, backgroundColor: '#d89a4d', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  replayText: { color: '#2b1a1d', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  tip: { color: '#d5c1ae', fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
