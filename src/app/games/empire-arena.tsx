/**
 * Empire Arena V2 — INSIDE the BUKLOD Android app.
 * Uses the single canonical offline Arena simulation in experiments/empire-arena-v2.
 * DEVELOPMENT PRACTICE ONLY: never writes BP, QMP, diamonds, inventory, ranks or PvP results.
 * Server-authoritative ranked/marketplace paths are intentionally not connected.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useAuth } from '@/providers/AuthProvider';
import {
  CHARACTER_DISPLAY_NAME, getCachedBuklodCharacterSelectionV2, getMyBuklodCharacterSelectionV2,
  type BuklodCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getRorkGameMedia } from '@/features/games/runtime/rorkMedia';
import { tryPlayRorkGameFeedback, useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';
import { ARENA_GENERATED_ART } from '@/features/games/empire/arenaGeneratedAssets';
// @ts-ignore — pure JS helper shares the deterministic mobile/web viewport contract.
import { arenaCamera, arenaVisualEffects, arenaNearby } from '@/features/games/empire/arenaPracticePresentation.mjs';
import { ARENA_HERO_ART, ARENA_SCENE_GAME_ID, ARENA_VISUAL_BASELINE, type ArenaSceneId } from '@/features/games/empire/arenaVisualBaseline';
// @ts-ignore — The canonical offline Arena engine is already .mjs. Metro bundles .mjs; native import is intentionally isolated.
import { createPractice, command, tick, STEP_MS, HEROES, ARENA_MAPS } from '../../../experiments/empire-arena-v2/arena-v2-engine.mjs';

type Mode = 'duel' | 'cluster' | 'grand';
type Team = 'A' | 'B';
type Position = { x: number; y: number };
type Actor = Position & { id: string; team?: Team | null; hp: number; maxHp: number; alive?: boolean; hero?: string; kind?: string; matchLevel?: number; mana?: number; maxMana?: number; bag?: Record<string, number>; stock?: number };
type ArenaState = {
  w: number; h: number; status: string; elapsed: number; mode?: Mode;
  map: { lanes: number[]; colors: string[] };
  players: Record<string, Actor>;
  towers: Actor[]; units: Actor[]; creatures: Actor[]; buildings: Actor[];
  nodes: (Position & { id: string; type: string; stock: number })[];
  loot: (Position & { id: string; expires?: number })[];
  teams: Record<Team, { resources: { wood: number; gold: number; stone: number }; kills: number }>;
  seals: Record<Team, { hp: number; maxHp: number; breached: boolean }>;
  cover: [number, number, number][]; events: { type: string; seq: number; time: number; actor?: string; to?: string; tower?: string }[];
  result?: { winner: Team | null; reason: string } | null;
  visualCue?: Position & { type: string; time: number; seq: number };
};
/** Typed bridge to the unchanged JavaScript-only deterministic practice engine. */
type OfflinePracticeSetup = {
  mode: Mode;
  mapId: ArenaSceneId;
  hero: BuklodCharacterId;
  snapshot: { characterLevel: number; bpEligibleLevel: number; itemVerifiedLevel: number; diamonds: number; verifiedItems: string[] };
};
const createArenaPractice = createPractice as unknown as (options: OfflinePracticeSetup) => ArenaState;
const MODE_LABELS: Record<Mode, string> = { duel: '1v1', cluster: '3v3', grand: '5v5' };
const SCENES: ArenaSceneId[] = ['genesis_rift', 'aurora_foundry', 'verdant_fracture'];
const MODES: Mode[] = ['duel', 'cluster', 'grand'];
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const near = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);
const life = (a: Actor) => a.alive !== false && a.hp > 0;

function ActorMark({ actor, friendly, selected }: { actor: Actor; friendly: boolean; selected?: boolean }) {
  if (!life(actor)) return null;
  const tint = friendly ? '#8ffce6' : '#ff9d8b';
  const r = actor.hero ? 2.6 : actor.kind === 'villager' ? 1.25 : 1.8;
  return <G>
    {selected ? <Circle cx={actor.x} cy={actor.y} r={r + 2.5} stroke="#f9dd8b" strokeWidth={0.75} fill="transparent" /> : null}
    <Circle cx={actor.x} cy={actor.y + 1} r={r + 1.0} fill="#07131b" opacity={0.45} />
    <Circle cx={actor.x} cy={actor.y} r={r} fill={tint} stroke="#122a38" strokeWidth={0.55} />
    {actor.hero ? <SvgText x={actor.x} y={actor.y + 0.85} textAnchor="middle" fontSize={2.6} fontWeight="bold" fill="#12202e">{actor.hero.slice(0, 1).toUpperCase()}</SvgText> : null}
    <Rect x={actor.x - r - 0.5} y={actor.y - r - 2.2} width={(r + 0.5) * 2} height={0.75} fill="#301b23" />
    <Rect x={actor.x - r - 0.5} y={actor.y - r - 2.2} width={(r + 0.5) * 2 * clamp(actor.hp / Math.max(1, actor.maxHp), 0, 1)} height={0.75} fill="#9effa7" />
  </G>;
}

function ArenaField({ state, art, generatedArt, selectedId, onTarget, isPlaying }: {
  state: ArenaState; art: string | undefined; generatedArt?: React.ComponentProps<typeof Image>['source']; selectedId: string | null; onTarget: (id: string) => void; isPlaying: boolean;
}) {
  const lanes = state.map.lanes || [0.19, 0.5, 0.81];
  const [area, setArea] = useState({ width: 720, height: 360 });
  const player = state.players.A0;
  const camera = arenaCamera(state.w, state.h, player, area.width, area.height,
    state.w <= 160 ? 70 : state.w <= 240 ? 90 : 115);
  const effects = arenaVisualEffects(state.events, state.elapsed, 1100);
  return <View style={styles.field} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 5 && height > 5 && (Math.abs(width - area.width) > 1 || Math.abs(height - area.height) > 1)) {
      setArea({ width, height });
    }
  }}>
    {generatedArt || art ? <ExpoImage
      source={generatedArt ? (generatedArt as React.ComponentProps<typeof ExpoImage>['source']) : { uri: art! }}
      contentFit="cover" cachePolicy="disk" pointerEvents="none"
      style={{
        position: 'absolute',
        width: area.width * (state.w / camera.width),
        height: area.height * (state.h / camera.height),
        left: -camera.x * (area.width / camera.width),
        top: -camera.y * (area.height / camera.height),
      }}
    /> : null}
    <LinearGradient colors={['rgba(4,10,26,0.70)', 'rgba(5,20,28,0.40)', 'rgba(4,12,24,0.76)']} style={StyleSheet.absoluteFill} />
    <Svg width="100%" height="100%" viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} preserveAspectRatio="xMidYMid meet">
      <Rect width={state.w} height={state.h} rx={4} fill="rgba(10,40,56,0.20)" />
      {lanes.map((y, i) => <Path key={'lane-' + i} d={`M 5 ${y * state.h} Q ${state.w / 2} ${y * state.h + (i - 1) * 3} ${state.w - 5} ${y * state.h}`} stroke="#ffe0a2" opacity={0.38} strokeWidth={1.9} fill="none" strokeDasharray="1 3" />)}
      <Line x1={state.w / 2} y1={6} x2={state.w / 2} y2={state.h - 6} stroke="#a9f8ea" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      {state.cover.map(([x, y, r], i) => <G key={'cover-' + i}><Circle cx={x} cy={y} r={r + 1.5} fill="#052624" opacity={0.6} /><Circle cx={x} cy={y} r={r} fill="#206b62" stroke="#74cbb8" strokeWidth={0.3} opacity={0.8} /></G>)}
      {state.nodes.map((n) => <G key={n.id}><Circle cx={n.x} cy={n.y} r={3.2} fill={n.type === 'gold' ? '#c68b38' : n.type === 'wood' ? '#276947' : '#738b9a'} stroke="#ffe9bc" strokeWidth={0.5} /><SvgText x={n.x} y={n.y + 0.75} fontSize={2.5} textAnchor="middle" fill="#fff">{n.type.slice(0, 1).toUpperCase()}</SvgText></G>)}
      {(['A', 'B'] as Team[]).map(team => <G key={team}>
        <Rect x={team === 'A' ? 9 : state.w - 19} y={state.h / 2 - 7} width={10} height={14} rx={2} fill={team === 'A' ? '#2d8d86' : '#9c4d59'} stroke="#ffdaa5" strokeWidth={0.7} />
        <SvgText x={team === 'A' ? 14 : state.w - 14} y={state.h / 2 + 0.7} fontSize={4} textAnchor="middle" fill="#fff">{team}</SvgText>
      </G>)}
      {state.towers.filter(life).map(t => <G key={t.id}><Rect x={t.x - 3} y={t.y - 3.5} width={6} height={7} rx={0.5} fill={t.team === 'A' ? '#497c9d' : '#a15f65'} stroke="#f9d68f" strokeWidth={0.5} /></G>)}
      {state.buildings.filter(life).map(b => <Rect key={b.id} x={b.x - 2.4} y={b.y - 2.4} width={4.8} height={4.8} rx={0.6} fill={b.team === 'A' ? '#6ebda9' : '#d48473'} stroke="#e8c989" strokeWidth={0.4} />)}
      {state.creatures.filter(life).map(c => <G key={c.id}><Circle cx={c.x} cy={c.y} r={3} fill="#b38ed6" stroke="#f2d6ff" strokeWidth={0.8} /><Circle cx={c.x} cy={c.y} r={1.1} fill="#f9e9b9" /></G>)}
      {state.units.map(u => <ActorMark key={u.id} actor={u} friendly={u.team === 'A'} />)}
      {Object.values(state.players).map(p => <G key={p.id} onPress={() => { if (p.id !== 'A0') onTarget(p.id); }}>
        <ActorMark actor={p} friendly={p.team === 'A'} selected={p.id === selectedId || p.id === 'A0'} />
        {p.hero && life(p) && (!isPlaying || !ARENA_GENERATED_ART['sprite:' + p.hero]) ? <G>
          <Defs><ClipPath id={'arena-portrait-' + p.id}><Circle cx={p.x} cy={p.y} r={2.7} /></ClipPath></Defs>
          <SvgImage href={ARENA_HERO_ART[p.hero as BuklodCharacterId] as any} x={p.x - 2.8} y={p.y - 2.8} width={5.6} height={5.6} preserveAspectRatio="xMidYMid slice" clipPath={'url(#arena-portrait-' + p.id + ')'} />
        </G> : null}
      </G>)}
      {state.visualCue && state.elapsed - state.visualCue.time < 650 ? (() => {
        const cue = state.visualCue;
        const age = Math.max(0, state.elapsed - cue.time);
        const alpha = 1 - age / 650;
        const radius = 2 + age / 75;
        return <G key={'feedback-' + cue.seq}>
          <Circle cx={cue.x} cy={cue.y} r={radius} fill="none"
            stroke={cue.type === 'attack' || cue.type === 'seal_attack' ? '#ffb3a0' : '#a2fbff'}
            strokeWidth={1.4 * alpha + 0.25} opacity={alpha} />
          <Path d={`M ${cue.x - radius * 0.8} ${cue.y - radius * 0.7}
            L ${cue.x + radius * 0.7} ${cue.y + radius * 0.75}
            M ${cue.x + radius * 0.25} ${cue.y - radius}
            L ${cue.x - radius * 0.3} ${cue.y + radius}`}
            stroke="#ffe9bb" strokeWidth={0.9 * alpha} opacity={alpha} />
        </G>;
      })() : null}
      {effects.map((effect: { seq: number; type: string; actor?: string; to?: string; tower?: string; strength: number }) => {
        const subject = state.players[effect.actor || ''] || state.players[effect.to || ''] ||
          state.towers.find(t => t.id === effect.tower);
        if (!subject) return null;
        const r = 3 + (1 - effect.strength) * (effect.type === 'defeat' ? 11 : 7);
        return <G key={'fx-' + effect.seq}>
          <Circle cx={subject.x} cy={subject.y} r={r} fill="none"
            stroke={effect.type === 'defeat' ? '#ff9d8b' : effect.type === 'dash' ? '#8ff8f0' : '#f9d77d'}
            strokeWidth={0.65 + effect.strength} opacity={effect.strength * 0.85} />
          <Circle cx={subject.x} cy={subject.y} r={r * 0.53} fill="#fce3a4"
            opacity={effect.strength * 0.14} />
        </G>;
      })}
    </Svg>
    {isPlaying ? Object.values(state.players)
      .filter(p => p.hero && life(p) && ARENA_GENERATED_ART['sprite:' + p.hero] &&
        p.x >= camera.x - 4 && p.x <= camera.x + camera.width + 4 &&
        p.y >= camera.y - 4 && p.y <= camera.y + camera.height + 4)
      .map(p => {
        const image = ARENA_GENERATED_ART['sprite:' + p.hero];
        const size = clamp(area.width * 8 / camera.width, 36, 106);
        return <ExpoImage key={'anim-' + p.id} source={image as React.ComponentProps<typeof ExpoImage>['source']}
          contentFit="contain" pointerEvents="none"
          style={{
            position: 'absolute', width: size, height: size,
            left: (p.x - camera.x) * area.width / camera.width - size / 2,
            top: (p.y - camera.y) * area.height / camera.height - size * 0.72,
          }} />;
      }) : null}
    <View pointerEvents="none" style={styles.minimap}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${state.w} ${state.h}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={state.w} height={state.h} fill="#102735" stroke="#e1c78e" strokeWidth={1} />
        {lanes.map((fraction, i) => <Line key={'m-' + i} x1={4} y1={fraction * state.h} x2={state.w - 4} y2={fraction * state.h} stroke="#5f8491" strokeWidth={0.75} />)}
        <Rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} fill="#c2e9fa" fillOpacity={0.12} stroke="#f1d48d" strokeWidth={0.9} />
        {Object.values(state.players).filter(life).map(p =>
          <Circle key={'p-' + p.id} cx={p.x} cy={p.y} r={2.4} fill={p.team === 'A' ? '#7ffce8' : '#ff9f90'} />)}
        <Circle cx={player?.x ?? 17} cy={player?.y ?? state.h / 2} r={3} fill="#f7e090" stroke="#122329" strokeWidth={1} />
      </Svg>
    </View>
    <View pointerEvents="none" style={styles.fieldLabel}><Text style={styles.labelText}>GENESIS • EMPIRE BATTLEFIELD</Text></View>
  </View>;
}

function Control({ icon, title, onPress, disabled }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[styles.control, disabled && styles.disabled]}>
    <MaterialCommunityIcons name={icon} size={20} color="#ffe8b5" /><Text style={styles.controlLabel}>{title}</Text>
  </Pressable>;
}

export default function EmpireArenaInApp() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [hero, setHero] = useState<BuklodCharacterId>('phan');
  const [mode, setMode] = useState<Mode>('duel');
  const [mapId, setMapId] = useState<ArenaSceneId>('genesis_rift');
  const [phase, setPhase] = useState<'menu' | 'playing' | 'paused' | 'result'>('menu');
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('Offline practice only • No BP, diamonds, XP, cash, or ranked effects.');
  const [target, setTarget] = useState<string | null>(null);
  const [joyVisual, setJoyVisual] = useState<Position>({ x: 0, y: 0 });
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const gameRef = useRef<ArenaState | null>(null);
  const directionRef = useRef<Position>({ x: 0, y: 0 });
  const focused = useRef(false);
  const selected = useRef<string | null>(null);
  useRorkGameAmbience(ARENA_SCENE_GAME_ID[mapId]);

  useEffect(() => {
    let alive = true;
    const id = user?.id;
    const cached = id ? getCachedBuklodCharacterSelectionV2(id) : null;
    if (cached?.active_character_id) setHero(cached.active_character_id);
    if (id) void getMyBuklodCharacterSelectionV2(id).then(value => {
      if (alive && value.active_character_id) setHero(value.active_character_id);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    let cancelled = false;
    // Prevent a slow landscape lock from re-locking the rest of the BUKLOD app after exit.
    if (Platform.OS !== 'web') void (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        if (cancelled) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
      } catch { /* Keep game accessible if a device disallows orientation locks. */ }
    })();
    return () => {
      cancelled = true;
      focused.current = false;
      directionRef.current = { x: 0, y: 0 };
      if (Platform.OS !== 'web') void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => undefined);
    };
  }, []));

  const joystick = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      const d = Math.max(1, Math.hypot(g.dx, g.dy));
      const v = { x: clamp(g.dx / Math.max(35, d), -1, 1), y: clamp(g.dy / Math.max(35, d), -1, 1) };
      directionRef.current = v;
      setJoyVisual(v);
    },
    onPanResponderRelease: () => {
      directionRef.current = { x: 0, y: 0 };
      setJoyVisual({ x: 0, y: 0 });
    },
    onPanResponderTerminate: () => {
      directionRef.current = { x: 0, y: 0 };
      setJoyVisual({ x: 0, y: 0 });
    },
  }), []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      if (!focused.current || AppState.currentState !== 'active') return;
      const state = gameRef.current;
      if (!state || state.status !== 'active') return;
      tick(state);
      const d = directionRef.current;
      if (Math.hypot(d.x, d.y) > 0.05) command(state, 'A0', { type: 'move', dx: d.x, dy: d.y });
      setRevision(v => v + 1);
      if (state.status !== 'active') {
        directionRef.current = { x: 0, y: 0 };
        setPhase('result');
      }
    }, STEP_MS as number);
    return () => clearInterval(timer);
  }, [phase]);

  const start = useCallback(() => {
    // Server-owned Diamond/item eligibility is NOT simulated with fabricated user data.
    // Level-1 equalized offline practice is separate from permanent profile progression.
    const state = createArenaPractice({
      mode, mapId, hero,
      snapshot: { characterLevel: 1, bpEligibleLevel: 1, itemVerifiedLevel: 1, diamonds: 0, verifiedItems: [] },
    });
    gameRef.current = state;
    selected.current = null;
    setTarget(null);
    setTacticsOpen(false);
    setMessage('Move, attack, gather, train and break the opposing seal. Practice grants no rewards.');
    setPhase('playing');
    setRevision(v => v + 1);
  }, [hero, mode, mapId]);

  const execute = useCallback((action: Record<string, unknown>, cue: 'impact' | 'collect' | 'move' = 'impact') => {
    const game = gameRef.current;
    if (!game || phase !== 'playing') return;
    const worked = command(game, 'A0', action);
    if (worked) {
      const actionType = typeof action.type === 'string' ? action.type : '';
      if (['attack', 'skill', 'seal_attack', 'mine', 'loot', 'build'].includes(actionType)) {
        const targetId = typeof action.targetId === 'string' ? action.targetId : '';
        const actors = [
          ...Object.values(game.players), ...game.towers, ...game.units, ...game.creatures,
        ];
        const actor = actors.find(a => a.id === targetId) ?? game.players.A0;
        if (actor) game.visualCue = { type: actionType, x: actor.x, y: actor.y,
          time: game.elapsed, seq: (game.visualCue?.seq || 0) + 1 };
      }
      tryPlayRorkGameFeedback(cue, 0.28);
      setRevision(v => v + 1);
    } else {
      setMessage('Action unavailable: get closer, check resources, level or cooldown.');
    }
  }, [phase]);

  const closestEnemy = (range: number) => {
    const game = gameRef.current;
    const player = game?.players.A0;
    if (!game || !player) return undefined;
    const foes = [...Object.values(game.players), ...game.units, ...game.creatures, ...game.towers]
      .filter(p => p.id !== 'A0' && life(p) && (p.team !== 'A' || !p.team));
    const active = selected.current ? foes.find(p => p.id === selected.current && near(p, player) <= range) : undefined;
    return active ?? foes.filter(p => near(p, player) <= range).sort((a, b) => near(a, player) - near(b, player))[0];
  };
  const attack = () => execute({ type: 'attack', targetId: closestEnemy(5.5)?.id });
  const skill = (slot: 'primary' | 'secondary' | 'ultimate') => {
    const game = gameRef.current, self = game?.players.A0;
    if (!self) return;
    const enemy = closestEnemy(slot === 'ultimate' ? 10 : 8);
    const d = directionRef.current;
    execute({
      type: 'skill', slot, targetId: enemy?.id,
      dx: enemy ? enemy.x - self.x : d.x || 1,
      dy: enemy ? enemy.y - self.y : d.y,
    });
  };
  const mine = () => {
    const game = gameRef.current, self = game?.players.A0;
    const node = game && self ? game.nodes.filter(n => near(n, self) <= 8).sort((a, b) => near(a, self) - near(b, self))[0] : null;
    execute({ type: 'mine', nodeId: node?.id }, 'collect');
  };
  const order = () => {
    execute({ type: 'order', order: 'push' }, 'move');
    setMessage('Allied units ordered to PUSH. Train near your base to reinforce.');
  };
  const siege = () => execute({ type: 'seal_attack' });
  const collectLoot = () => {
    const match = gameRef.current;
    const me = match?.players.A0;
    const nearby = arenaNearby(match, me);
    execute({ type: 'loot', id: nearby.loot?.id }, 'collect');
  };
  const buildTower = () => {
    const match = gameRef.current, player = match?.players.A0;
    if (!match || !player) return;
    const sign = player.team === 'A' ? 1 : -1;
    execute({ type: 'build', kind: 'watchtower',
      x: clamp(player.x + 6 * sign, 3, match.w - 3),
      y: clamp(player.y + 3, 3, match.h - 3) }, 'collect');
  };
  const towerAction = (type: 'tower_repair' | 'tower_upgrade') => {
    const match = gameRef.current, player = match?.players.A0;
    const nearby = arenaNearby(match, player);
    execute({ type, towerId: nearby.tower?.id }, 'collect');
  };
  const game = gameRef.current;
  const me = game?.players.A0;
  const opponent = game?.players.B0;
  const nearby = arenaNearby(game, me);
  const resources = game?.teams.A.resources;
  const media = getRorkGameMedia(ARENA_SCENE_GAME_ID[mapId]);
  void revision; // Intentionally render every bounded fixed simulation step.

  return <View style={[styles.root, { paddingTop: Math.max(4, insets.top), paddingBottom: Math.max(2, insets.bottom) }]}>
    <LinearGradient colors={['#060d1d', '#092b3a', '#071324']} style={StyleSheet.absoluteFill} />
    <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD Kingdom" onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={20} color="#ffdfa4" /></Pressable>
      <Image source={ARENA_GENERATED_ART['hero:' + hero] || ARENA_HERO_ART[hero]} style={styles.portrait} />
      <View style={styles.topText}>
        <Text numberOfLines={1} style={styles.header}>BUKLOD EMPIRE • ARENA</Text>
        <Text style={styles.sub}>{CHARACTER_DISPLAY_NAME[hero]} • {phase === 'playing' ? 'PRACTICE LIVE' : phase.toUpperCase()} • {ARENA_VISUAL_BASELINE}</Text>
      </View>
      {phase === 'playing' ? <Control icon="pause" title="PAUSE" onPress={() => setPhase('paused')} /> : phase === 'paused' ? <Control icon="play" title="RESUME" onPress={() => setPhase('playing')} /> : null}
    </View>

    {phase === 'menu' ? <View style={styles.menu}>
      <Text style={styles.title}>GENESIS WAR ARENA</Text>
      <Text style={styles.description}>Your official BUKLOD character enters this Arena inside the same app. Choose a battlefield and play an offline training match. Live ranked matchmaking and account-owned gear are disabled until trusted backend verification.</Text>
      <Text style={styles.groupLabel}>BATTLE MODE</Text>
      <View style={styles.options}>{MODES.map(m => <Pressable key={m} accessibilityRole="button" onPress={() => setMode(m)} style={[styles.option, mode === m && styles.optionActive]}><Text style={styles.optionText}>{MODE_LABELS[m]}</Text></Pressable>)}</View>
      <Text style={styles.groupLabel}>BATTLEFIELD</Text>
      <View style={styles.options}>{SCENES.map(m => <Pressable key={m} accessibilityRole="button" onPress={() => setMapId(m)} style={[styles.option, mapId === m && styles.optionActive]}><Text style={styles.optionText}>{ARENA_MAPS[m].name}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={start} style={styles.start}><MaterialCommunityIcons name="sword-cross" color="#102b31" size={20} /><Text style={styles.startText}>ENTER PRACTICE ARENA</Text></Pressable>
    </View> : null}

    {game && phase !== 'menu' ? <View style={styles.stage}>
      <View style={styles.hud}>
        <Text numberOfLines={1} style={styles.hudText}>HP {Math.ceil(me?.hp || 0)}/{Math.ceil(me?.maxHp || 1)}  •  MP {Math.ceil(me?.mana || 0)}  •  LV {me?.matchLevel || 1}</Text>
        <Text numberOfLines={1} style={styles.hudText}>WOOD {Math.floor(resources?.wood || 0)} · GOLD {Math.floor(resources?.gold || 0)} · STONE {Math.floor(resources?.stone || 0)}</Text>
        <Text numberOfLines={1} style={styles.hudText}>SEALS {Math.ceil(game.seals.A.hp)}:{Math.ceil(game.seals.B.hp)} · {Math.floor(game.elapsed / 60000)}:{String(Math.floor(game.elapsed / 1000) % 60).padStart(2, '0')}</Text>
      </View>
      <ArenaField state={game} art={media?.background} generatedArt={ARENA_GENERATED_ART['scene:' + mapId]} isPlaying={phase === 'playing'} selectedId={target} onTarget={id => { selected.current = id; setTarget(id); }} />
      <View style={styles.info} pointerEvents="none"><Text numberOfLines={1} style={styles.infoText}>{message} • Enemy {opponent ? Math.max(0, Math.ceil(opponent.hp)) : '—'} HP</Text></View>
      {phase === 'playing' ? <>
        <View style={styles.joystick} {...joystick.panHandlers}>
          <View style={styles.joyRing}><View style={[styles.joyHandle, { transform: [{ translateX: joyVisual.x * 25 }, { translateY: joyVisual.y * 25 }] }]} /></View>
          <Text style={styles.joyLabel}>MOVE</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.actionLine}>
            <Control icon="pickaxe" title="MINE" onPress={mine} disabled={!nearby.mine} />
            <Control icon="archive-arrow-down" title="BANK" onPress={() => execute({ type: 'deposit' }, 'collect')} disabled={!nearby.canBank} />
            <Control icon="account-multiple-plus" title="TRAIN" onPress={() => execute({ type: 'train', kind: 'warrior' }, 'collect')} disabled={!nearby.canBank} />
            <Control icon="tools" title={tacticsOpen ? 'CLOSE' : 'TACTICS'} onPress={() => setTacticsOpen(v => !v)} />
          </View>
          <View style={styles.actionLine}>
            <Control icon="lightning-bolt" title="SKILL" onPress={() => skill('primary')} />
            <Control icon="run-fast" title="DASH" onPress={() => skill('secondary')} disabled={(me?.matchLevel || 1) < 3} />
            <Control icon="fire" title="ULT" onPress={() => skill('ultimate')} disabled={(me?.matchLevel || 1) < 6} />
            <Control icon="sword" title="ATTACK" onPress={attack} />
          </View>
        </View>
        {tacticsOpen ? <View style={styles.tactics}>
          <Text style={styles.tacticsHeader}>FIELD COMMANDS • TAP TO USE</Text>
          <View style={styles.tacticsControls}>
            <Control icon="shield-sword" title="PUSH" onPress={order} />
            <Control icon="flag-variant" title="SIEGE" onPress={siege} disabled={!nearby.canSiege} />
            <Control icon="treasure-chest-outline" title="LOOT" onPress={collectLoot} disabled={!nearby.loot} />
            <Control icon="hammer-wrench" title="BUILD" onPress={buildTower} disabled={!nearby.canBuild} />
            <Control icon="wrench" title="REPAIR" onPress={() => towerAction('tower_repair')} disabled={!nearby.tower} />
            <Control icon="arrow-up-bold-hexagon-outline" title="UPGRADE" onPress={() => towerAction('tower_upgrade')} disabled={!nearby.tower} />
          </View>
          <Text style={styles.tacticsHint}>Siege unlocks after enemy towers fall. Build near home and repair allied towers. No real rewards.</Text>
        </View> : null}
      </> : <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{phase === 'paused' ? 'PAUSED' : game.result?.winner === 'A' ? 'VICTORY' : game.result?.winner === 'B' ? 'DEFEAT' : 'MATCH ENDED'}</Text>
        <Text style={styles.description}>{phase === 'paused' ? 'Match time is frozen. Return to gameplay or abandon this practice.' : 'Offline practice only. No BP, diamonds, rank or inventory changes.'}</Text>
        <View style={styles.options}>
          {phase === 'paused' ? <Control icon="play" title="RESUME" onPress={() => setPhase('playing')} /> : <Control icon="restart" title="REPLAY" onPress={start} />}
          <Control icon="home-map-marker" title="EXIT" onPress={() => { gameRef.current = null; setPhase('menu'); }} />
        </View>
      </View>}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071323' },
  top: { minHeight: 51, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 9, borderBottomColor: '#456570', borderBottomWidth: 1 },
  back: { padding: 7, minWidth: 35, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  portrait: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#b69a62' },
  topText: { flex: 1, minWidth: 0 },
  header: { color: '#ffe0a4', fontWeight: '900', fontSize: 14 },
  sub: { color: '#a7c4ce', fontSize: 9 },
  menu: { alignSelf: 'center', width: '100%', maxWidth: 720, flex: 1, paddingHorizontal: 18, justifyContent: 'center', gap: 11 },
  title: { color: '#ffe7ba', fontSize: 25, fontWeight: '900' },
  description: { color: '#d0e3df', lineHeight: 19, fontSize: 12 },
  groupLabel: { color: '#a2d9ce', fontSize: 11, fontWeight: '900', marginTop: 6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  option: { borderWidth: 1, borderColor: '#3d6c7e', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#102c40' },
  optionActive: { borderColor: '#f3c46f', backgroundColor: '#3d4651' },
  optionText: { color: '#f3e0b5', fontWeight: '800', fontSize: 11 },
  start: { borderRadius: 12, padding: 12, backgroundColor: '#eaca81', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, alignSelf: 'flex-start', marginTop: 8 },
  startText: { color: '#162f39', fontWeight: '900' },
  stage: { flex: 1, overflow: 'hidden' },
  hud: { zIndex: 1, minHeight: 26, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  hudText: { color: '#f8dfa8', fontSize: 10, fontWeight: '800', flexShrink: 1 },
  field: { flex: 1, overflow: 'hidden', borderColor: '#576d67', borderWidth: 1, marginHorizontal: 6, borderRadius: 5 },
  minimap: { position: 'absolute', top: 9, right: 9, width: 126, height: 74, borderWidth: 1,
    borderRadius: 7, borderColor: '#e4cc97', backgroundColor: '#081b2bd9', padding: 3 },
  fieldLabel: { position: 'absolute', top: 6, alignSelf: 'center', backgroundColor: '#09152099', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  labelText: { color: '#f8e6bd', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  info: { paddingHorizontal: 8, paddingVertical: 4, minHeight: 24, backgroundColor: '#051021' },
  infoText: { color: '#e4dbb9', fontSize: 10 },
  joystick: { position: 'absolute', left: 16, bottom: 31, width: 113, height: 110, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  joyRing: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#081d30bb', borderWidth: 2, borderColor: '#a8bcb9', alignItems: 'center', justifyContent: 'center' },
  joyHandle: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#d1a85cbb', borderWidth: 2, borderColor: '#ffe5b7' },
  joyLabel: { fontSize: 9, color: '#ffe7bd', fontWeight: '900' },
  actions: { position: 'absolute', right: 9, bottom: 32, zIndex: 5, gap: 6 },
  tactics: { position: 'absolute', right: 12, bottom: 141, zIndex: 6, width: 340, maxWidth: '66%',
    borderRadius: 11, borderWidth: 1, borderColor: '#f1ca86', backgroundColor: '#061e30ed', padding: 8, gap: 6 },
  tacticsHeader: { color: '#fff1c5', fontWeight: '900', fontSize: 10 },
  tacticsControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tacticsHint: { color: '#c1d3d1', fontSize: 9 },
  actionLine: { flexDirection: 'row', alignSelf: 'flex-end', gap: 5 },
  control: { minHeight: 47, minWidth: 46, borderRadius: 9, borderWidth: 1, borderColor: '#c5ac7d', backgroundColor: '#102a3ddd', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 4 },
  controlLabel: { color: '#ffe7b5', fontSize: 8, fontWeight: '900' },
  disabled: { opacity: 0.35 },
  overlay: { position: 'absolute', top: 25, bottom: 25, left: '22%', right: '22%', zIndex: 10, borderWidth: 1, borderColor: '#d3b477', backgroundColor: '#061727f2', borderRadius: 15, padding: 15, alignItems: 'center', justifyContent: 'center', gap: 14 },
  overlayTitle: { color: '#ffe8ae', fontWeight: '900', fontSize: 27 },
});
