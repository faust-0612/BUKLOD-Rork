/**
 * Empire Arena V2 — INSIDE the BUKLOD Android app.
 * Uses the single canonical offline Arena simulation in experiments/empire-arena-v2.
 * DEVELOPMENT PRACTICE ONLY: never writes BP, QMP, diamonds, inventory, ranks or PvP results.
 * Server-authoritative ranked/marketplace paths are intentionally not connected.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState, Image, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, G, Line, Path, Rect, Defs, RadialGradient as SvgRadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { useAuth } from '@/providers/AuthProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import { openBundledEmpireArena } from '../../../modules/buklod-genesis-godot';
import GenesisNativeWorldEntry, {isGenesis206NativeWorldEntry} from '@/features/season2/genesis/GenesisNativeWorldEntry';
import {
  CHARACTER_DISPLAY_NAME, getCachedBuklodCharacterSelectionV2, getMyBuklodCharacterSelectionV2,
  type BuklodCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getRorkGameMedia } from '@/features/games/runtime/rorkMedia';
import { tryPlayRorkGameFeedback, tryPlayArenaEventCue, playRorkSignatureSfx, useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';
import { ARENA_GENERATED_ART } from '@/features/games/empire/arenaGeneratedAssets';
import { ArenaRankedSocket, isArenaRankedConfigured } from '@/features/games/empire/rankedClient';
import { ArenaAnimatedActor } from '@/features/games/empire/ArenaAnimatedActor';
import { ArenaActionFx } from '@/features/games/empire/ArenaActionFx';
import { ArenaResourceHud, ArenaPickupTrails, ArenaRewardBanner } from '@/features/games/empire/ArenaMaterialFeedback';
import { ArenaTerrainArt } from '@/features/games/empire/ArenaTerrainArt';
import { ArenaBaseArt } from '@/features/games/empire/ArenaBaseArt';
import { setArenaVoiceFocus, playArenaVoiceAnnouncements, stopArenaVoiceAnnouncements } from '@/features/games/empire/ArenaVoiceRuntime';
import { ArenaStructureArt, ArenaWildlifeArt, ArenaResourceLootArt } from '@/features/games/empire/ArenaWorldArt';
import { ArenaCombatHud, type ArenaHudKey, type ArenaHudLayout, type HudPoint, type CombatAction } from '@/features/games/empire/ArenaCombatHud';
// @ts-ignore — pure, versioned, per-device preferences. Never a source of Arena game authority.
import { ARENA_HUD_DEFAULT, sanitizeArenaHudLayout, serializeArenaHudLayout } from '@/features/games/empire/arenaHudLayout.mjs';
// @ts-ignore — pure presentation helper, reads only server-authoritative snapshots.
import { arenaActorPose } from '@/features/games/empire/arenaActorPose.mjs';
// @ts-ignore — deterministic event-to-sound mapping; audio only, no remote dependency.
import { drainArenaSoundscape, nearbyArenaBuffCue } from '@/features/games/empire/arenaSoundscape.mjs';
// @ts-ignore - pure event-world geometry adapter, presentation only.
import { arenaActionVisuals } from '@/features/games/empire/arenaActionVisuals.mjs';
// @ts-ignore — pure event receipts, all positive quantities proved by Arena engine/server.
import { arenaFeedbackReceipts, arenaResourceCounts } from '@/features/games/empire/arenaFeedbackReceipts.mjs';
// @ts-ignore — offline-only commands, no microphone or unreviewed ranked transport.
import { ARENA_TACTICAL_CALLS, arenaCanSendLocalCall } from '@/features/games/empire/arenaTacticalCalls.mjs';
// @ts-ignore — pure JS helper shares the deterministic mobile/web viewport contract.
import { arenaCamera, arenaVisualEffects, arenaNearby } from '@/features/games/empire/arenaPracticePresentation.mjs';
import { ARENA_HERO_ART, ARENA_SCENE_GAME_ID, ARENA_VISUAL_BASELINE, type ArenaSceneId } from '@/features/games/empire/arenaVisualBaseline';
// @ts-ignore — The canonical offline Arena engine is already .mjs. Metro bundles .mjs; native import is intentionally isolated.
import { createPractice, command, tick, STEP_MS, HEROES, ARENA_MAPS, resolveGear, STARTER_HERO_KITS, starterAttack, starterSkillCooldown } from '../../../experiments/empire-arena-v2/arena-v2-engine.mjs';
// @ts-ignore — deterministic offline CPU duel; imports NO auth/network/store modules.
import { createOfflineSoloBattle, tickOfflineSolo, SOLO_CPU_DIFFICULTIES, SOLO_ROUND_MS } from '../../../experiments/empire-arena-v2/arena-v2-solo.mjs';

type Mode = 'duel' | 'cluster' | 'grand';
type Team = 'A' | 'B';
type Position = { x: number; y: number };
type Actor = Position & { id: string; team?: Team | null; hp: number; maxHp: number; alive?: boolean; hero?: string; kind?: string; matchLevel?: number; mana?: number; maxMana?: number; bag?: Record<string, number>; stock?: number; itemMastery?: number; cooldowns?: Record<'primary' | 'secondary' | 'ultimate', number>; gear?: Record<string, unknown>; lastMoveTick?: number; lastAttacked?: number };
type ArenaState = {
  w: number; h: number; status: string; elapsed: number; tick: number; mode?: Mode; kind?: string;
  solo?: { difficulty: string; round: number; wins: Record<Team, number>; draws: number;
    intermissionUntil: number; roundStartedAt: number; lastRoundWinner: Team | null;
    opponent: string; playerHero: string; };
  map: { lanes: number[]; colors: string[] };
  players: Record<string, Actor>;
  towers: Actor[]; units: Actor[]; creatures: Actor[]; buildings: Actor[];
  heroWalls?: (Actor & { expires: number })[];
  nodes: (Position & { id: string; type: string; stock: number })[];
  loot: (Position & { id: string; expires?: number })[];
  teams: Record<Team, { resources: { wood: number; gold: number; stone: number }; kills: number }>;
  seals: Record<Team, { hp: number; maxHp: number; breached: boolean }>;
  cover: [number, number, number, string?][]; events: { type: string; seq: number; time: number; actor?: string; to?: string; tower?: string }[];
  result?: { winner: Team | null; reason: string } | null;
  visualCue?: Position & { type: string; time: number; seq: number; actor?: string };
};
/** Typed bridge to the unchanged JavaScript-only deterministic practice engine. */
type OfflinePracticeSetup = {
  mode: Mode;
  mapId: ArenaSceneId;
  hero: BuklodCharacterId;
  snapshot: { characterLevel: number; bpEligibleLevel: number; itemVerifiedLevel: number; diamonds: number; verifiedItems: string[] };
};
const createArenaPractice = createPractice as unknown as (options: OfflinePracticeSetup) => ArenaState;
const createArenaSolo = createOfflineSoloBattle as unknown as (options: {
  hero:BuklodCharacterId; opponent:BuklodCharacterId; difficulty:'easy'|'normal'|'hard'; mapId:ArenaSceneId;
}) => ArenaState;
const MODE_LABELS: Record<Mode, string> = { duel: '1v1', cluster: '3v3', grand: '5v5' };
const SCENES: ArenaSceneId[] = ['genesis_rift', 'aurora_foundry', 'verdant_fracture'];
// Official hero archetypes select an original readable combat glyph, not a
// shared generic lightning sign or another game's copyrighted ability art.
const PRIMARY_GLYPH_BY_STYLE: Record<string, CombatAction['icon']> = {
  heal: 'heart-pulse', guard: 'shield-sword', supply: 'hand-heart',
  blink: 'flash', burst: 'sword-cross', disrupt: 'lightning-bolt',
};
const MODES: Mode[] = ['duel', 'cluster', 'grand'];
/** Six supplied starter kits; other seven characters intentionally use baseline skills. */
const starterKitFor = (id?: string) => id && Object.prototype.hasOwnProperty.call(STARTER_HERO_KITS, id)
  ? STARTER_HERO_KITS[id as keyof typeof STARTER_HERO_KITS] : undefined;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const near = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);
const life = (a: Actor) => a.alive !== false && a.hp > 0;
const ARENA_SCENE_LIGHT: Record<ArenaSceneId,{star:string;ground:string;accent:string;enemy:string}> = {
  genesis_rift:{star:'#f7d4ff',ground:'#482f72',accent:'#bf9aff',enemy:'#ffa6bf'},
  aurora_foundry:{star:'#d9fbff',ground:'#125d69',accent:'#89ddf2',enemy:'#f7c2a1'},
  verdant_fracture:{star:'#dcffe9',ground:'#195b46',accent:'#98ffb6',enemy:'#f7c88a'},
};
const ARENA_SPARKS=Array.from({length:34},(_,index)=>({
  x:((index*43+11)%97+1)/100,y:((index*29+23)%91+2)/100,phase:index%5,
}));

function ActorMark({ actor, friendly, selected }: { actor: Actor; friendly: boolean; selected?: boolean }) {
  if (!life(actor)) return null;
  const tint = friendly ? '#8ffce6' : '#ff9d8b';
  const r = actor.hero ? 2.6 : actor.kind === 'villager' ? 1.25 : 1.8;
  // The official full-body actor overlays hero markers. No enormous cheap
  // initial-letter badges: just a readable tactical selection circle below feet.
  return <G>
    {selected ? <Circle cx={actor.x} cy={actor.y} r={r + 2.5}
      stroke="#f9dd8b" strokeWidth={0.85} fill="none" strokeDasharray="2.2 1.5" /> : null}
    <Circle cx={actor.x} cy={actor.y + 1} r={r + 1.0} fill="#07131b" opacity={0.42} />
    <Circle cx={actor.x} cy={actor.y} r={r}
      fill={actor.hero ? '#0a2e31' : tint} stroke={tint} strokeWidth={actor.hero ? 0.95 : 0.55}
      fillOpacity={actor.hero ? 0.38 : 0.9} />
    {!actor.hero ? <G>
      <Rect x={actor.x - r - 0.5} y={actor.y - r - 2.2} width={(r + 0.5) * 2} height={0.75} fill="#301b23" />
      <Rect x={actor.x - r - 0.5} y={actor.y - r - 2.2}
        width={(r + 0.5) * 2 * clamp(actor.hp / Math.max(1, actor.maxHp), 0, 1)}
        height={0.75} fill="#9effa7" />
    </G> : null}
  </G>;
}

function ArenaField({ state, sceneId, art, generatedArt, selectedId, onTarget, isPlaying, localSeat, zoom, onPinchZoom, receipts }: {
  state: ArenaState; sceneId: ArenaSceneId; art: string | undefined; generatedArt?: React.ComponentProps<typeof Image>['source']; selectedId: string | null; onTarget: (id: string) => void; isPlaying: boolean; localSeat: string; zoom: number; onPinchZoom: (factor: number) => void; receipts: React.ComponentProps<typeof ArenaPickupTrails>['receipts'];
}) {
  const lanes = state.map.lanes || [0.19, 0.5, 0.81];
  const [area, setArea] = useState({ width: 720, height: 360 });
  const pinchDistance = useRef<number | null>(null);
  const touchDistance = (touches: readonly { pageX: number; pageY: number }[]) => touches.length === 2
    ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : null;
  const player = state.players[localSeat];
  const localTeam = player?.team ?? 'A';
  const camera = arenaCamera(state.w, state.h, player, area.width, area.height,
    (state.w <= 160 ? 70 : state.w <= 240 ? 90 : 115) / zoom);
  const actionFx = arenaActionVisuals(state, state.elapsed, 950, 16);
  const light = ARENA_SCENE_LIGHT[sceneId];
  return <View style={styles.field}
    onTouchStart={event => { pinchDistance.current = touchDistance(event.nativeEvent.touches); }}
    onTouchMove={event => {
      const distance = touchDistance(event.nativeEvent.touches);
      if (distance && pinchDistance.current && pinchDistance.current > 8) {
        const factor = distance / pinchDistance.current;
        if (factor > 1.06 || factor < 0.94) { onPinchZoom(factor); pinchDistance.current = distance; }
      }
    }}
    onTouchEnd={event => { pinchDistance.current = touchDistance(event.nativeEvent.touches); }}
    onTouchCancel={() => { pinchDistance.current = null; }}
    onLayout={event => {
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
    <LinearGradient colors={['rgba(4,10,26,0.31)', 'rgba(5,20,28,0.13)', 'rgba(4,12,24,0.43)']} style={StyleSheet.absoluteFill} />
    <Svg width="100%" height="100%" viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} preserveAspectRatio="xMidYMid meet">
      <Defs>
        <SvgRadialGradient id="arena-world-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={light.accent} stopOpacity=".55"/>
          <Stop offset="100%" stopColor={light.ground} stopOpacity="0"/>
        </SvgRadialGradient>
      </Defs>
      <Rect width={state.w} height={state.h} rx={4} fill="rgba(10,40,56,0.08)" />
      <Circle cx={state.w/2} cy={state.h/2} r={state.h*.31} fill="url(#arena-world-glow)" opacity=".55"/>
      {ARENA_SPARKS.map((star,i)=><Circle key={'spark-'+i} cx={star.x*state.w} cy={star.y*state.h}
        r={.17+(i%3)*.10} fill={light.star} opacity={.22 + .28*Math.abs(Math.sin(state.elapsed/950+star.phase))}/>)}
      {lanes.map((y, i) => <Path key={'lane-' + i} d={`M 5 ${y * state.h} Q ${state.w / 2} ${y * state.h + (i - 1) * 3} ${state.w - 5} ${y * state.h}`} stroke="#ffe0a2" opacity={0.38} strokeWidth={1.9} fill="none" strokeDasharray="1 3" />)}
      <Line x1={state.w / 2} y1={6} x2={state.w / 2} y2={state.h - 6} stroke="#a9f8ea" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />
      <ArenaTerrainArt cover={state.cover.map(c => [c[0], c[1], c[2]] as [number, number, number])} sceneId={sceneId} elapsed={state.elapsed}
        worldWidth={state.w} worldHeight={state.h} />
      <ArenaResourceLootArt nodes={state.nodes} loot={state.loot} elapsed={state.elapsed} />
      {!state.solo ? <ArenaBaseArt width={state.w} height={state.h} elapsed={state.elapsed}
        seals={state.seals} localTeam={localTeam} /> : null}
      <ArenaStructureArt towers={state.towers} buildings={state.buildings} elapsed={state.elapsed} />
       {(state.heroWalls || []).filter(w=>life(w)).map(w=><G key={w.id} onPress={()=>onTarget(w.id)}>
         <Rect x={w.x-2.2} y={w.y-2.2} width={4.4} height={4.4} rx={.6}
           stroke="#b3f9e2" strokeWidth={.75} fill="#1a686f" opacity={.9}/>
         <Path d={`M ${w.x-1.3} ${w.y-1.2} L ${w.x+1.3} ${w.y+1.2} M ${w.x+1.3} ${w.y-1.2} L ${w.x-1.3} ${w.y+1.2}`} stroke="#ebffb7" strokeWidth={.6}/>
       </G>)}
      <ArenaWildlifeArt creatures={state.creatures} elapsed={state.elapsed} />
      {state.units.map(u => <ActorMark key={u.id} actor={u} friendly={u.team === localTeam} />)}
      {Object.values(state.players).map(p => <G key={p.id} onPress={() => { if (p.id !== localSeat) onTarget(p.id); }}>
        <ActorMark actor={p} friendly={p.team === localTeam} selected={p.id === selectedId || p.id === localSeat} />

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
      <ArenaActionFx effects={actionFx} />
    </Svg>
    <ArenaPickupTrails receipts={receipts} width={area.width} height={area.height} camera={camera}/>
    {Object.values(state.players)
      .filter(p => p.hero && (life(p) || state.events.slice(-35).some(e =>
        ['defeat','unit_ko','tower_ko','trap_ko','hazard_ko','storm_defeat'].includes(e.type) &&
        (e.to===p.id || (e as {target?:string}).target===p.id || e.actor===p.id) &&
        state.elapsed-e.time>=0 && state.elapsed-e.time<640)) &&
        p.x >= camera.x - 5 && p.x <= camera.x + camera.width + 5 &&
        p.y >= camera.y - 5 && p.y <= camera.y + camera.height + 5)
      .map(p => {
        // Single source-owned hero identity across all four real full-body motion states.
        // No visual transition may modify the server-owned action, level, HP, or gear.
        const pose = arenaActorPose(state, p, state.visualCue);
        const lastDamage = state.events.slice(-40).reverse().find(e=>
          ['damage','unit_hit','tower_hit','boss_hit','trap_hit','map_hazard'].includes(e.type) &&
          (e.to===p.id||(e as {target?:string}).target===p.id||e.actor===p.id) &&
          state.elapsed-e.time>=0 && state.elapsed-e.time<450);
        const fullbody = ARENA_GENERATED_ART['fullbody:' + p.hero + '_' + pose] ||
          ARENA_GENERATED_ART['fullbody:' + p.hero + '_idle'];
        const sprite = ARENA_GENERATED_ART['sprite:' + p.hero];
        const image = fullbody || sprite || ARENA_GENERATED_ART['hero:' + p.hero] ||
          ARENA_HERO_ART[p.hero as BuklodCharacterId];
        const size = clamp(Math.min(area.width * 8 / camera.width, area.height * 0.36), 32, 80);
        return <ArenaAnimatedActor key={'actor-' + p.id} actorId={p.id} image={image}
          pose={pose} health={p.hp/Math.max(1,p.maxHp)} selected={p.id===selectedId || p.id===localSeat}
          sprite={Boolean(fullbody || sprite)} friendly={p.team === localTeam} active={isPlaying}
          hitSequence={lastDamage?.seq??0} knockedOut={!life(p)}
          moving={Boolean(p.lastMoveTick != null && p.lastMoveTick >= state.tick - 1)}
          x={(p.x - camera.x) * area.width / camera.width}
          y={(p.y - camera.y) * area.height / camera.height} size={size} />;
      })}
    <View pointerEvents="none" style={[styles.minimap, area.height < 240 && styles.minimapCompact]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${state.w} ${state.h}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={state.w} height={state.h} fill="#102735" stroke="#e1c78e" strokeWidth={1} />
        {lanes.map((fraction, i) => <Line key={'m-' + i} x1={4} y1={fraction * state.h} x2={state.w - 4} y2={fraction * state.h} stroke="#5f8491" strokeWidth={0.75} />)}
        <Rect x={camera.x} y={camera.y} width={camera.width} height={camera.height} fill="#c2e9fa" fillOpacity={0.12} stroke="#f1d48d" strokeWidth={0.9} />
        {Object.values(state.players).filter(life).map(p =>
          <Circle key={'p-' + p.id} cx={p.x} cy={p.y} r={2.4} fill={p.team === localTeam ? '#7ffce8' : '#ff9f90'} />)}
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

function EmpireArenaInApp() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [hero, setHero] = useState<BuklodCharacterId>('phan'); // verified profile/ranked selection
  const [soloHero,setSoloHero] = useState<BuklodCharacterId>('phan'); // local training selection only
  const soloHeroTouched = useRef(false);
  const [mode, setMode] = useState<Mode>('duel');
  const [cpuHero,setCpuHero] = useState<BuklodCharacterId>('ace');
  const [cpuDifficulty,setCpuDifficulty] = useState<'easy'|'normal'|'hard'>('normal');
  const [mapId, setMapId] = useState<ArenaSceneId>('genesis_rift');
  const [phase, setPhase] = useState<'menu' | 'queued' | 'playing' | 'paused' | 'result'>('menu');
  const [godotOpening, setGodotOpening] = useState(false);
  // New 2.0.5 uses native-first entry; old 2.0.4 keeps explicit opt-in.
  const godotNativeEnabled = Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED === 'true' &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 !== 'true';
  const launchNativeGodot = useCallback(async () => {
    if (!godotNativeEnabled || godotOpening) return;
    setGodotOpening(true);
    try {
      const started = await openBundledEmpireArena();
      if (!started) setMessage('Godot Arena pack unavailable. Existing practice remains accessible.');
    } catch {
      setMessage('Could not enter native Godot Arena. Existing practice remains accessible.');
    } finally {
      setGodotOpening(false);
    }
  }, [godotNativeEnabled, godotOpening]);
  const [arenaKind, setArenaKind] = useState<'practice' | 'ranked'>('practice');
  const [localSeat, setLocalSeat] = useState('A0');
  const localSeatRef = useRef('A0');
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('Offline practice only • No BP, diamonds, XP, cash, or ranked effects.');
  const [target, setTarget] = useState<string | null>(null);
  const [joyVisual, setJoyVisual] = useState<Position>({ x: 0, y: 0 });
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [teamCallsOpen, setTeamCallsOpen] = useState(false);
  const [lastTeamCall, setLastTeamCall] = useState<{label:string;at:number}|null>(null);
  const lastTeamCallAt = useRef(-100000);
  const [hudEditing, setHudEditing] = useState(false);
  const [hudPositions, setHudPositions] = useState<ArenaHudLayout>(() => sanitizeArenaHudLayout(null) as ArenaHudLayout);
  const [hudArea, setHudArea] = useState({width: 800, height: 280});
  const moveHudControl = useCallback((key: ArenaHudKey, point: HudPoint) => {
    setHudPositions(current => ({...current, [key]:point}));
  }, []);
  const [zoom, setZoom] = useState(1);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const compactLandscape = viewportHeight < 440;
  const changeZoom = useCallback((factor: number) => setZoom(z => clamp(z * factor, 0.65, 2.6)), []);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const gameRef = useRef<ArenaState | null>(null);
  const directionRef = useRef<Position>({ x: 0, y: 0 });
  const focused = useRef(false);
  const selected = useRef<string | null>(null);
  const rankedRef = useRef<ArenaRankedSocket | null>(null);
  const lastAudioEventSeq = useRef(0);
  const { musicEnabled, toggleMusic } = useRorkGameAmbience(ARENA_SCENE_GAME_ID[mapId], {arena:true});

  // Hydrate only device-local, per-account preferences. Malformed or old data
  // always falls back to a safe ergonomic default; no backend write or sync.
  useEffect(() => {
    let current = true;
    setHudPositions(sanitizeArenaHudLayout(null) as ArenaHudLayout);
    if (user?.id) {
      void AsyncStorage.getItem('@buklod_arena_hud_v2:' + user.id)
        .then(stored => { if (current) setHudPositions(sanitizeArenaHudLayout(stored) as ArenaHudLayout); })
        .catch(() => undefined);
    }
    return () => { current = false; };
  }, [user?.id]);

  const saveHudControls = useCallback(async () => {
    if (!user?.id) { setMessage('Sign in to save Arena controls.'); return; }
    try {
      await AsyncStorage.setItem('@buklod_arena_hud_v2:' + user.id, serializeArenaHudLayout(hudPositions));
      setHudEditing(false);
      setMessage('Custom combat controls saved on this device.');
    } catch {
      setHudEditing(false);
      setMessage('Could not save control positions; current session layout still works.');
    }
  }, [hudPositions, user?.id]);

  useEffect(() => {
    let alive = true;
    const id = user?.id;
    const cached = id ? getCachedBuklodCharacterSelectionV2(id) : null;
    if (cached?.active_character_id) {
      setHero(cached.active_character_id);
      if(!soloHeroTouched.current)setSoloHero(cached.active_character_id);
    }
    if (id) void getMyBuklodCharacterSelectionV2(id).then(value => {
      if (alive && value.active_character_id) {
        setHero(value.active_character_id);
        if(!soloHeroTouched.current)setSoloHero(value.active_character_id);
      }
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setArenaVoiceFocus(true);
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
      setArenaVoiceFocus(false);
      rankedRef.current?.close();
      rankedRef.current = null;
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
    if (phase !== 'playing' || (hudEditing && arenaKind === 'practice')) return;
    const timer = setInterval(() => {
      if (!focused.current || AppState.currentState !== 'active') return;
      const state = gameRef.current;
      if (!state || state.status !== 'active') return;
      if (arenaKind === 'ranked') {
        const d = directionRef.current;
        if (Math.hypot(d.x, d.y) > 0.05) rankedRef.current?.sendAction({type:'move',dx:d.x,dy:d.y});
        return;
      }
      if(state.solo) tickOfflineSolo(state);
      else tick(state);
      const drained = drainArenaSoundscape(state.events, lastAudioEventSeq.current,
        state.events[state.events.length - 1]?.seq ?? lastAudioEventSeq.current,
        {team:state.players[localSeat]?.team??'A',seat:localSeat,players:state.players,
          units:state.units,towers:state.towers,buildings:state.buildings});
      lastAudioEventSeq.current = drained.lastSeq;
      if (voiceEnabled) playArenaVoiceAnnouncements(drained.cues, true);
      if (sfxEnabled) {
        for (const cue of drained.cues) tryPlayArenaEventCue(cue, true);
        // Bounded proximity-only buff wildlife: one soft motif, never remote.
        if (state.tick % 10===0) {
          const wildlife = nearbyArenaBuffCue(state,localSeat);
          if (wildlife) tryPlayArenaEventCue(wildlife,true);
        }
      }
      const d = directionRef.current;
      if ((!state.solo || !state.solo.intermissionUntil) && Math.hypot(d.x, d.y) > 0.05) {
        command(state, localSeat, { type: 'move', dx: d.x, dy: d.y });
      }
      setRevision(v => v + 1);
      if (state.status !== 'active') {
        directionRef.current = { x: 0, y: 0 };
        setPhase('result');
      }
    }, STEP_MS as number);
    return () => clearInterval(timer);
  }, [phase, sfxEnabled, voiceEnabled, arenaKind, localSeat, hudEditing]);

  const start = useCallback(() => {
    // Server-owned Diamond/item eligibility is NOT simulated with fabricated user data.
    // Level-1 equalized offline practice is separate from permanent profile progression.
    const state = createArenaPractice({
      mode, mapId, hero,
      snapshot: { characterLevel: 1, bpEligibleLevel: 1, itemVerifiedLevel: 1, diamonds: 0, verifiedItems: [] },
    });
    gameRef.current = state;
    setLocalSeat('A0');
    localSeatRef.current = 'A0';
    setArenaKind('practice');
    lastAudioEventSeq.current = state.events[state.events.length - 1]?.seq ?? 0;
    if (sfxEnabled) playRorkSignatureSfx(ARENA_SCENE_GAME_ID[mapId], 0.24);
    selected.current = null;
    setTarget(null);
    setTacticsOpen(false);
    setTeamCallsOpen(false);setLastTeamCall(null);lastTeamCallAt.current=-100000;
    setHudEditing(false);
    setZoom(1);
    setMessage('Move, attack, gather, train and break the opposing seal. Practice grants no rewards.');
    setPhase('playing');
    setRevision(v => v + 1);
  }, [hero, mode, mapId, sfxEnabled]);

  const startSolo = useCallback(() => {
    // Pure local CPU match: no remote requests, account checks, sockets or reward grants.
    // The same canonical combat engine drives both player and CPU actions.
    rankedRef.current?.close();rankedRef.current=null;
    const state = createArenaSolo({hero:soloHero,opponent:cpuHero,difficulty:cpuDifficulty,mapId});
    gameRef.current=state;
    setLocalSeat('A0');localSeatRef.current='A0';
    setArenaKind('practice');
    lastAudioEventSeq.current=state.events[state.events.length-1]?.seq ?? 0;
    if(sfxEnabled)playRorkSignatureSfx(ARENA_SCENE_GAME_ID[mapId],.24);
    selected.current='B0';setTarget('B0');
    directionRef.current={x:0,y:0};setJoyVisual({x:0,y:0});
    setTacticsOpen(false);setTeamCallsOpen(false);setLastTeamCall(null);lastTeamCallAt.current=-100000;
    setHudEditing(false);setZoom(1);
    setMessage('OFFLINE CPU BATTLE • Best of 3 rounds • Real attacks, skills, HP and cooldowns • No rewards');
    setPhase('playing');setRevision(v=>v+1);
  },[soloHero,cpuHero,cpuDifficulty,mapId,sfxEnabled]);

  const startRanked = useCallback(async () => {
    if (!user?.id || !isArenaRankedConfigured()) {
      setMessage('Secure ranked backend is not available in this staging build.');
      return;
    }
    rankedRef.current?.close();
    const bridge = new ArenaRankedSocket({
      onPacket(packet) {
        if (packet.type === 'match_start' || packet.type === 'match_resume') {
          const seat = typeof packet.slot === 'string' && /^[AB][0-4]$/.test(packet.slot)
            ? packet.slot : null;
          if (!seat || !packet.state || typeof packet.state !== 'object') return;
          const match = packet.state as ArenaState;
          if (!match.players?.[seat]) return;
          gameRef.current = match;
          setLocalSeat(seat);
          localSeatRef.current = seat;
          lastAudioEventSeq.current = match.events?.at(-1)?.seq ?? 0;
          setPhase('playing');
          setMessage('Ranked match • server-authoritative actions • one earned Diamond at risk.');
          setRevision(v => v + 1);
        } else if (packet.type === 'snapshot' && packet.state && typeof packet.state === 'object') {
          const match = packet.state as ArenaState;
          if (gameRef.current && match.tick >= gameRef.current.tick) {
            gameRef.current = match;
            const latest = match.events?.at(-1)?.seq ?? lastAudioEventSeq.current;
            const seat = localSeatRef.current;
            const drain = drainArenaSoundscape(match.events,lastAudioEventSeq.current,latest,
              {team:match.players?.[seat]?.team??'A',seat,players:match.players,
                units:match.units,towers:match.towers,buildings:match.buildings});
            lastAudioEventSeq.current = drain.lastSeq;
            if (voiceEnabled) playArenaVoiceAnnouncements(drain.cues,true);
            if (sfxEnabled) for (const cue of drain.cues) tryPlayArenaEventCue(cue,true);
            setRevision(v => v + 1);
          }
        } else if (packet.type === 'match_end' && packet.confirmed === true) {
          if (gameRef.current) {
            const team = packet.winner === 'A' || packet.winner === 'B' ? packet.winner : null;
            gameRef.current.result = {winner:team, reason:'server_verified_ranked_outcome'};
          }
          setMessage('Ranked outcome confirmed by authoritative server and database.');
          setPhase('result');
          setRevision(v => v + 1);
          rankedRef.current?.close();
          rankedRef.current = null;
        } else if (packet.type === 'match_aborted') {
          setMessage('Match aborted by server. Reserved Diamond refunded by the backend.');
          setPhase('result');
          rankedRef.current?.close();
          rankedRef.current = null;
        } else if (packet.type === 'queued') {
          setMessage('Waiting for verified opponents. Ranked match starts after server reserve.');
        } else if (packet.type === 'error') {
          setMessage('Arena server: ' + String(packet.code ?? 'unavailable').slice(0,48));
        }
      },
      onError(message) { setMessage(message); }
    });
    rankedRef.current = bridge;
    gameRef.current = null;
    setArenaKind('ranked');
    setPhase('queued');
    setRevision(v => v + 1);
    try { await bridge.connectAndQueue(mode,mapId,user.id); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ranked connection unavailable');
      bridge.close();rankedRef.current=null;setPhase('menu');
    }
  }, [mode,mapId,user?.id,sfxEnabled,voiceEnabled]);

  const execute = useCallback((action: Record<string, unknown>, cue: 'impact' | 'collect' | 'move' = 'impact') => {
    const game = gameRef.current;
    if (!game || phase !== 'playing' || (game.solo && game.solo.intermissionUntil > game.elapsed)) return;
    if (arenaKind === 'ranked') {
      const accepted = rankedRef.current?.sendAction(action) ?? false;
      if (!accepted) setMessage('Command not sent: Arena connection unavailable.');
      return;
    }
    const worked = command(game, localSeat, action);
    if (worked) {
      const actionType = typeof action.type === 'string' ? action.type : '';
      if (['attack', 'skill', 'seal_attack', 'mine', 'loot', 'build'].includes(actionType)) {
        const targetId = typeof action.targetId === 'string' ? action.targetId : '';
        const actors = [
          ...Object.values(game.players), ...game.towers, ...game.units, ...game.creatures,
        ];
        const actor = actors.find(a => a.id === targetId) ?? game.players[localSeat];
        if (actor) game.visualCue = { type: actionType, actor: localSeat, x: actor.x, y: actor.y,
          time: game.elapsed, seq: (game.visualCue?.seq || 0) + 1 };
      }
      // A successful combat action is confirmed by engine events; the semantic
      // sound queue plays it once, with no duplicate generic button impact.
      void cue;
      setRevision(v => v + 1);
    } else {
      setMessage('Action unavailable: get closer, check resources, level or cooldown.');
    }
  }, [phase, arenaKind, localSeat]);

  const closestEnemy = (range: number) => {
    const game = gameRef.current;
    const player = game?.players[localSeat];
    if (!game || !player) return undefined;
    const foes = [...Object.values(game.players), ...game.units, ...game.creatures, ...game.towers, ...(game.heroWalls || [])]
      .filter(p => p.id !== localSeat && life(p) && (p.team !== player.team || !p.team));
    const active = selected.current ? foes.find(p => p.id === selected.current && near(p, player) <= range) : undefined;
    return active ?? foes.filter(p => near(p, player) <= range).sort((a, b) => near(a, player) - near(b, player))[0];
  };
  const attack = () => {
    const game=gameRef.current, me=game?.players[localSeat];
    const basic=arenaKind==='practice' && me?.hero ? starterAttack(me.hero) : null;
    execute({type: 'attack',targetId:closestEnemy(basic?.range ?? 5.5)?.id});
  };
  const skill = (slot: 'primary' | 'secondary' | 'ultimate') => {
    const game = gameRef.current, self = game?.players[localSeat];
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
    const game = gameRef.current, self = game?.players[localSeat];
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
    const me = match?.players[localSeat];
    const nearby = arenaNearby(match, me);
    execute({ type: 'loot', id: nearby.loot?.id }, 'collect');
  };
  const buildTower = () => {
    const match = gameRef.current, player = match?.players[localSeat];
    if (!match || !player) return;
    const sign = player.team === 'A' ? 1 : -1;
    execute({ type: 'build', kind: 'watchtower',
      x: clamp(player.x + 6 * sign, 3, match.w - 3),
      y: clamp(player.y + 3, 3, match.h - 3) }, 'collect');
  };
  const towerAction = (type: 'tower_repair' | 'tower_upgrade') => {
    const match = gameRef.current, player = match?.players[localSeat];
    const nearby = arenaNearby(match, player);
    execute({ type, towerId: nearby.tower?.id }, 'collect');
  };
  const sendLocalTeamCall = (key:string) => {
    const match=gameRef.current;
    if(!match || !arenaCanSendLocalCall(match,localSeat,key)){
      setMessage('Team calls are offline training only. Live ranked communication requires a secured match channel.');
      return;
    }
    if(match.elapsed-lastTeamCallAt.current<1600)return; // tactile anti-spam
    const call=ARENA_TACTICAL_CALLS[key as keyof typeof ARENA_TACTICAL_CALLS];
    if(!call || !command(match,localSeat,{type:'order',order:call.order})){
      setMessage('Team command unavailable in the current match.');
      return;
    }
    lastTeamCallAt.current=match.elapsed;
    setLastTeamCall({label:call.label,at:match.elapsed});
    setMessage('TEAM TRAINING • '+call.label+' • allied CPU units ordered');
    if(sfxEnabled)tryPlayRorkGameFeedback('move',.14);
    if(voiceEnabled)playArenaVoiceAnnouncements([{id:'tactical_'+key}],true);
    setRevision(v=>v+1);
    setTeamCallsOpen(false);
  };
  const game = gameRef.current;
  const me = game?.players[localSeat];
  const ownTeam = me?.team ?? 'A';
  const opponent = Object.values(game?.players ?? {}).find(p=>p.team && p.team !== ownTeam);
  const nearby = arenaNearby(game, me);
  // Material chips read exact snapshot stock and carry balances, never inferred loot.
  const arenaReceipts = game ? arenaFeedbackReceipts(game, localSeat) : [];
  const materialCounts = arenaResourceCounts(game, localSeat);
  const media = getRorkGameMedia(ARENA_SCENE_GAME_ID[mapId]);
  // Cooldown numbers are derived from the canonical engine snapshot; this HUD
  // never grants abilities or fabricates ready-state timers.
  const cooldownFor = (slot: 'primary'|'secondary'|'ultimate'): number => {
    if (!game || !me || !me.cooldowns) return 0;
    const base = (arenaKind==='practice' && me.hero ? starterSkillCooldown(me.hero,slot) : null)
       ?? {primary:5800, secondary:11000, ultimate:38000}[slot];
    const gear = me.hero ? resolveGear(me.hero, me.gear || {}) : {cooldown:0};
    const duration = base / (1 + Math.min(.2, (me.itemMastery || 0) * .04) + (gear.cooldown || 0));
    return Math.max(0, duration - (game.elapsed - (me.cooldowns[slot] ?? -1e8)));
  };
  const actions: CombatAction[] = [
    {id:'attack',label:'ATTACK',icon:'sword-cross',onPress:attack},
    {id:'primary',label:arenaKind==='practice' && me?.hero && starterKitFor(me.hero)?'SKILL 1':'SKILL',icon:PRIMARY_GLYPH_BY_STYLE[HEROES[game?.solo ? soloHero : hero]?.style] || 'lightning-bolt',onPress:()=>skill('primary'),
      disabled:(me?.mana || 0)<18,cooldownMs:cooldownFor('primary')},
    {id:'secondary',label:arenaKind==='practice' && me?.hero && starterKitFor(me.hero)?'SKILL 2':'DASH',icon:'run-fast',onPress:()=>skill('secondary'),
      disabled:(me?.matchLevel||1)<3 || (me?.mana||0)<14,cooldownMs:cooldownFor('secondary')},
    {id:'ultimate',label:'ULT',icon:'fire',onPress:()=>skill('ultimate'),
      disabled:(me?.matchLevel||1)<6 || (me?.mana||0)<55,cooldownMs:cooldownFor('ultimate')},
    ...(!game?.solo ? [
    {id:'mine' as const,label:'MINE',icon:'pickaxe' as const,onPress:mine,disabled:!nearby.mine},
    {id:'bank' as const,label:'BANK',icon:'archive-arrow-down' as const,onPress:()=>execute({type: 'deposit'},'collect'),disabled:!nearby.canBank},
    {id:'train' as const,label:'TRAIN',icon:'account-multiple-plus' as const,onPress:()=>execute({type: 'train',kind:'warrior'},'collect'),disabled:!nearby.canBank},
    {id:'tactics' as const,label:'TACTICS',icon:'chess-knight' as const,onPress:()=>setTacticsOpen(v=>!v)},
    ] : []),
  ];
  void revision; // Intentionally render every bounded fixed simulation step.

  return <View style={[styles.root, { paddingTop: Math.max(4, insets.top), paddingBottom: Math.max(2, insets.bottom) }]}>
    <LinearGradient colors={['#060d1d', '#092b3a', '#071324']} style={StyleSheet.absoluteFill} />
    <View style={[styles.top, compactLandscape && styles.topCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD Kingdom" onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={20} color="#ffdfa4" /></Pressable>
      <Image source={ARENA_GENERATED_ART['hero:' + (game?.solo ? soloHero : hero)] || ARENA_HERO_ART[game?.solo ? soloHero : hero]} style={styles.portrait} />
      <View style={styles.topText}>
        <Text numberOfLines={1} style={styles.header}>BUKLOD EMPIRE • ARENA</Text>
        <Text style={styles.sub}>{CHARACTER_DISPLAY_NAME[game?.solo ? soloHero : hero]} • {gameRef.current?.solo ? 'OFFLINE • VS CPU' : phase === 'playing' ? (arenaKind === 'ranked' ? 'RANKED LIVE' : 'PRACTICE LIVE') : phase.toUpperCase()} • {ARENA_VISUAL_BASELINE}</Text>
      </View>
      <Pressable onPress={toggleMusic} accessibilityRole="button" accessibilityLabel={musicEnabled ? 'Mute Arena music' : 'Enable Arena music'} style={styles.audioToggle}>
        <MaterialCommunityIcons name={musicEnabled ? 'music-note' : 'music-note-off'} size={17} color="#f9df9e" />
      </Pressable>
      <Pressable onPress={() => { if (voiceEnabled) stopArenaVoiceAnnouncements(); else setArenaVoiceFocus(true); setVoiceEnabled(!voiceEnabled); }} accessibilityRole="button"
        accessibilityLabel={voiceEnabled ? 'Mute Arena voice announcements' : 'Enable Arena voice announcements'}
        style={styles.audioToggle}>
        <MaterialCommunityIcons name={voiceEnabled ? 'account-voice' : 'microphone-off'}
          size={17} color="#f9df9e" />
      </Pressable>
      {(phase==='playing' || phase==='paused') ? <Pressable accessibilityRole="button"
        accessibilityLabel={arenaKind==='ranked'?'Team communication requires secure ranked server':
          'Offline team training commands'} onPress={() => {
          if(arenaKind==='ranked' || gameRef.current?.solo){
            setMessage('Live team voice and match pings are not available in this preview; no microphone is recorded.');
          } else {setTeamCallsOpen(v=>!v);setTacticsOpen(false);}
        }} style={styles.audioToggle}>
        <MaterialCommunityIcons name={arenaKind==='ranked'?'microphone-off':'bullhorn'}
          size={18} color="#b9f5dc"/>
      </Pressable> : null}
      <Pressable onPress={() => setSfxEnabled(value => !value)} accessibilityRole="button" accessibilityLabel={sfxEnabled ? 'Mute Arena effects' : 'Enable Arena effects'} style={styles.audioToggle}>
        <MaterialCommunityIcons name={sfxEnabled ? 'volume-high' : 'volume-off'} size={17} color="#f9df9e" />
      </Pressable>
      {phase === 'playing' ? <View style={styles.zoomControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out battlefield" onPress={() => changeZoom(1 / 1.25)} style={styles.zoomButton}><MaterialCommunityIcons name="minus" size={19} color="#ffe7b5" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset battlefield zoom" onPress={() => setZoom(1)} style={styles.zoomButton}><Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in battlefield" onPress={() => changeZoom(1.25)} style={styles.zoomButton}><MaterialCommunityIcons name="plus" size={19} color="#ffe7b5" /></Pressable>
      </View> : null}
      {phase === 'playing' && arenaKind === 'practice' ? <Pressable accessibilityRole="button"
        accessibilityLabel="Customize Arena controls" onPress={() => {
          directionRef.current={x:0,y:0};setJoyVisual({x:0,y:0});setTacticsOpen(false);setHudEditing(true);
        }} style={styles.audioToggle}>
        <MaterialCommunityIcons name="gesture-tap" size={19} color="#f9df9e" />
      </Pressable> : null}
      {phase === 'playing' && arenaKind === 'practice' && !hudEditing ? <Control icon="pause" title="PAUSE" onPress={() => setPhase('paused')} /> : phase === 'paused' ? <Control icon="play" title="RESUME" onPress={() => setPhase('playing')} /> : null}
    </View>

    {phase === 'menu' ? <ScrollView style={styles.menuScroll} contentContainerStyle={[styles.menu, compactLandscape && styles.menuCompact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>GENESIS WAR ARENA</Text>
      <Text style={styles.description}>Fight BUKLOD computer characters without signal. Real attacks, skills, knockouts and winner. No BP or Diamond change.</Text>
      {godotNativeEnabled ? <Pressable accessibilityRole="button"
        accessibilityLabel="Launch native Godot Empire Arena inside BUKLOD"
        disabled={godotOpening} onPress={() => void launchNativeGodot()}
        style={[styles.start, styles.soloStart, godotOpening && {opacity:0.6}]}>
        <MaterialCommunityIcons name="gamepad-variant" size={23} color="#0a2932" />
        <Text style={styles.startText}>{godotOpening ? 'OPENING GODOT...' : 'PLAY GODOT EMPIRE ARENA'}</Text>
      </Pressable> : null}
      <View style={styles.soloBanner}>
        <MaterialCommunityIcons name="wifi-off" color="#a6ffe0" size={20}/>
        <View style={{flex:1}}>
          <Text style={styles.soloBannerTitle}>OFFLINE SOLO • HERO VS CPU</Text>
          <Text style={styles.soloBannerNote}>No matchmaking, server or internet while playing • Best of 3 rounds</Text>
        </View>
      </View>
      <Text style={styles.groupLabel}>YOUR HERO • OFFLINE TEST ONLY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroPicker}>
        {(Object.keys(HEROES) as BuklodCharacterId[]).map(c=><Pressable key={'human-'+c}
          accessibilityRole="button" accessibilityLabel={'Use '+CHARACTER_DISPLAY_NAME[c]+' in offline Arena'}
          onPress={()=>{soloHeroTouched.current=true;setSoloHero(c);}} style={[styles.heroPick,soloHero===c&&styles.heroPickActive]}>
          <ExpoImage source={ARENA_GENERATED_ART['fullbody:'+c+'_idle']||ARENA_HERO_ART[c]}
            contentFit="contain" style={styles.heroPickImage}/>
          <Text numberOfLines={1} style={styles.heroPickText}>{CHARACTER_DISPLAY_NAME[c]}</Text>
        </Pressable>)}
      </ScrollView>
      <Text style={styles.groupLabel}>COMPUTER OPPONENT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroPicker}>
        {(Object.keys(HEROES) as BuklodCharacterId[]).map(c=><Pressable key={'cpu-'+c}
          accessibilityRole="button" accessibilityLabel={'Fight CPU '+CHARACTER_DISPLAY_NAME[c]}
          onPress={()=>setCpuHero(c)} style={[styles.heroPick,cpuHero===c&&styles.cpuPickActive]}>
          <ExpoImage source={ARENA_GENERATED_ART['fullbody:'+c+'_idle']||ARENA_HERO_ART[c]}
            contentFit="contain" style={styles.heroPickImage}/>
          <Text numberOfLines={1} style={styles.heroPickText}>{CHARACTER_DISPLAY_NAME[c]}</Text>
        </Pressable>)}
      </ScrollView>
      <Text style={styles.groupLabel}>CPU DIFFICULTY</Text>
      <View style={styles.options}>
        {(['easy','normal','hard'] as const).map(d=><Pressable key={d}
          accessibilityRole="button" accessibilityLabel={'CPU difficulty '+SOLO_CPU_DIFFICULTIES[d].label}
          onPress={()=>setCpuDifficulty(d)} style={[styles.option,cpuDifficulty===d&&styles.optionActive]}>
          <Text style={styles.optionText}>{SOLO_CPU_DIFFICULTIES[d].label}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.groupLabel}>BATTLEFIELD</Text>
      <View style={styles.sceneOptions}>{SCENES.map(m => <Pressable key={m} accessibilityRole="button" accessibilityLabel={'Battlefield ' + ARENA_MAPS[m].name}
        onPress={() => setMapId(m)} style={[styles.sceneCard, mapId === m && styles.sceneActive]}>
        <ExpoImage source={ARENA_GENERATED_ART['scene:' + m]} contentFit="cover" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(5,17,29,.1)','rgba(5,17,29,.94)']} style={StyleSheet.absoluteFill}/>
        <Text style={styles.sceneTitle}>{ARENA_MAPS[m].name}</Text>
        {mapId===m ? <MaterialCommunityIcons name="check-decagram" size={19} color="#fbe2a6" style={styles.sceneCheck}/> : null}
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Play offline against BUKLOD computer hero"
        onPress={startSolo} style={[styles.start,styles.soloStart]}>
        <MaterialCommunityIcons name="sword-cross" size={22} color="#0a2932"/>
        <Text style={styles.startText}>PLAY OFFLINE • VS CPU</Text>
      </Pressable>
      <View style={styles.menuHeroPreview}>
        <ExpoImage source={ARENA_GENERATED_ART['fullbody:' + soloHero + '_idle'] || ARENA_HERO_ART[soloHero]}
          contentFit="contain" style={styles.menuHeroImage} />
        <View style={styles.menuHeroText}><Text style={styles.heroName}>{CHARACTER_DISPLAY_NAME[soloHero]}</Text>
          <Text style={styles.heroCaption}>{HEROES[soloHero]?.role?.toUpperCase() ?? 'HERO'} • OFFLINE TRAINING CHARACTER</Text>
          <Text style={styles.heroCaption}>13 heroes • 3 realms • animated battle poses</Text>
          {starterKitFor(soloHero) ? <Text style={styles.heroCaption} numberOfLines={2}>
            {starterKitFor(soloHero)?.primary.id.replace(/_/g,' ')} • {starterKitFor(soloHero)?.secondary.id.replace(/_/g,' ')} • {starterKitFor(soloHero)?.ultimate.id.replace(/_/g,' ')}
          </Text> : null}</View>
      </View>
      <Text style={styles.groupLabel}>CLASSIC OFFLINE WAR PRACTICE</Text>
      <Text style={styles.soloBannerNote}>1v1, 3v3 or 5v5 • mining, towers, troops and seals</Text>
      <Text style={styles.groupLabel}>BATTLE MODE</Text>
      <View style={styles.options}>{MODES.map(m => <Pressable key={m} accessibilityRole="button" onPress={() => setMode(m)} style={[styles.option, mode === m && styles.optionActive]}><Text style={styles.optionText}>{MODE_LABELS[m]}</Text></Pressable>)}</View>

      <Pressable accessibilityRole="button" onPress={start} style={styles.start}><MaterialCommunityIcons name="shield-sword" color="#102b31" size={20} /><Text style={styles.startText}>ENTER CLASSIC WAR PRACTICE</Text></Pressable>
      {isArenaRankedConfigured() ? <Pressable accessibilityRole="button" onPress={() => void startRanked()}
        style={styles.start}><MaterialCommunityIcons name="shield-sword" color="#102b31" size={20} /><Text style={styles.startText}>SEARCH RANKED OPPONENTS</Text></Pressable>
        : <Text style={styles.groupLabel}>Ranked PvP: awaiting trusted staging server and verified Diamond ledger</Text>}
    </ScrollView> : null}

    {phase === 'queued' ? <View style={styles.menu}>
      <Text style={styles.title}>RANKED MATCHMAKING</Text>
      <Text style={styles.description}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        rankedRef.current?.leave();rankedRef.current=null;setPhase('menu');setArenaKind('practice');
      }} style={styles.start}><Text style={styles.startText}>CANCEL QUEUE</Text></Pressable>
    </View> : null}
    {game && phase !== 'menu' && phase !== 'queued' ? <View style={styles.stage} onLayout={event => {
      const {width,height}=event.nativeEvent.layout;
      if(Math.abs(width-hudArea.width)>1 || Math.abs(height-hudArea.height)>1) setHudArea({width,height});
    }}>
      {game.solo ? <View style={styles.soloScore}>
        <Text style={styles.soloScoreText}>YOU {game.solo.wins.A} — {game.solo.wins.B} CPU</Text>
        <Text style={styles.soloScoreText}>ROUND {game.solo.round} • {Math.max(0,Math.ceil((SOLO_ROUND_MS-(game.elapsed-game.solo.roundStartedAt))/1000))}s</Text>
        <Text style={styles.soloCpuName}>{CHARACTER_DISPLAY_NAME[game.solo.opponent as BuklodCharacterId]} • {SOLO_CPU_DIFFICULTIES[game.solo.difficulty as keyof typeof SOLO_CPU_DIFFICULTIES]?.label} • {Math.ceil(game.players.B0?.hp||0)} HP</Text>
      </View> : null}
      <View style={styles.hud}>
        <Text numberOfLines={1} style={styles.hudText}>HP {Math.ceil(me?.hp || 0)}/{Math.ceil(me?.maxHp || 1)}  •  MP {Math.ceil(me?.mana || 0)}  •  LV {me?.matchLevel || 1}</Text>
        {!game.solo ? <ArenaResourceHud stock={materialCounts.stock} carrying={materialCounts.carrying} receipts={arenaReceipts}/> : null}
        {!game.solo ? <Text numberOfLines={1} style={styles.hudText}>SEALS {Math.ceil(game.seals.A.hp)}:{Math.ceil(game.seals.B.hp)} · {Math.floor(game.elapsed / 60000)}:{String(Math.floor(game.elapsed / 1000) % 60).padStart(2, '0')}</Text> : null}
      </View>
      <ArenaField zoom={zoom} onPinchZoom={changeZoom} sceneId={mapId} state={game} localSeat={localSeat} art={media?.background} generatedArt={ARENA_GENERATED_ART['scene:' + mapId]} isPlaying={phase === 'playing'} selectedId={target} onTarget={id => { selected.current = id; setTarget(id); }} receipts={arenaReceipts} />
      <ArenaRewardBanner receipts={arenaReceipts}/>
      {lastTeamCall && phase==='playing' && game.elapsed-lastTeamCall.at<3000 ?
        <View pointerEvents="none" style={styles.teamCallToast}>
          <MaterialCommunityIcons name="bullhorn" size={17} color="#a9ffdc"/>
          <Text style={styles.teamCallToastText}>{lastTeamCall.label} • CPU TEAM</Text>
        </View> : null}
      {!compactLandscape ? <View style={styles.info} pointerEvents="none"><Text numberOfLines={1} style={styles.infoText}>{message} • Enemy {opponent ? Math.max(0, Math.ceil(opponent.hp)) : '—'} HP</Text></View> : null}
      {phase === 'playing' ? <>
        <ArenaCombatHud width={hudArea.width} height={hudArea.height} positions={hudPositions}
          editing={hudEditing} onMove={moveHudControl} joystickHandlers={joystick.panHandlers}
          joy={joyVisual} actions={game.solo?.intermissionUntil ? actions.map(a=>({...a,disabled:true})) : actions} />
        {hudEditing && arenaKind==='practice' ? <View style={styles.hudEditor}>
          <Text style={styles.hudEditorText}>DRAG ANY ICON TO MOVE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Play with current Arena controls" onPress={() => setHudEditing(false)} style={styles.hudEditorButton}>
            <Text style={styles.hudEditorAction}>PLAY</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset Arena controls" onPress={() => setHudPositions(sanitizeArenaHudLayout(null) as ArenaHudLayout)} style={styles.hudEditorButton}>
            <Text style={styles.hudEditorAction}>RESET</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Save Arena control positions" onPress={() => void saveHudControls()} style={[styles.hudEditorButton,styles.hudSave]}>
            <Text style={styles.hudEditorAction}>SAVE</Text></Pressable>
        </View> : null}
        {teamCallsOpen && !hudEditing && !game.solo && arenaKind==='practice' ?
          <View style={[styles.teamCallPanel,compactLandscape && styles.teamCallPanelCompact]}>
            <Text style={styles.teamCallHeader}>OFFLINE TEAM COMMANDS</Text>
            <Text style={styles.teamCallHint}>Speech on your device • CPU units follow orders • no microphone</Text>
            <View style={styles.teamCallGrid}>{Object.keys(ARENA_TACTICAL_CALLS).map(key=>{
              const call=ARENA_TACTICAL_CALLS[key as keyof typeof ARENA_TACTICAL_CALLS];
              return <Pressable key={key} accessibilityRole="button"
                accessibilityLabel={'Issue '+call.label+' CPU team order'}
                onPress={()=>sendLocalTeamCall(key)} style={styles.teamCallButton}>
                <MaterialCommunityIcons name={call.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                  size={16} color="#d9f6e8"/>
                <Text style={styles.teamCallButtonText}>{call.label}</Text>
              </Pressable>;
            })}</View>
          </View> : null}
        {tacticsOpen && !hudEditing && !game.solo ? <View style={[styles.tactics, compactLandscape && styles.tacticsCompact]}>
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
        {game.solo?.intermissionUntil && game.solo.intermissionUntil>game.elapsed ? <View pointerEvents="none" style={styles.roundBanner}>
          <Text style={styles.roundBannerText}>{game.solo.lastRoundWinner==='A'?'ROUND WON':game.solo.lastRoundWinner==='B'?'ROUND LOST':'ROUND DRAW'}</Text>
          <Text style={styles.roundBannerNote}>Next round • same heroes, full HP and mana</Text>
        </View> : null}
      </> : <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{phase === 'paused' ? 'PAUSED' : game.result?.winner === ownTeam ? 'VICTORY' : game.result?.winner && game.result.winner !== ownTeam ? 'DEFEAT' : 'MATCH ENDED'}</Text>
        <Text style={styles.description}>{phase === 'paused' ? 'Battle frozen. Resume or leave without penalties.' : arenaKind === 'ranked' ? 'Ranked outcome is settled by the server only. No BUKLOD BP or QMP is minted.' : game.solo ? 'Solo result: YOU '+game.solo.wins.A+' — '+game.solo.wins.B+' CPU • No BP, Diamond, rank or inventory changes.' : 'Offline practice only. No BP, diamonds, rank or inventory changes.'}</Text>
        <View style={styles.options}>
          {phase === 'paused' ? <Control icon="play" title="RESUME" onPress={() => setPhase('playing')} /> : arenaKind === 'ranked' ? <Control icon="home-map-marker" title="MENU" onPress={() => { gameRef.current=null;setArenaKind('practice');setPhase('menu'); }} /> : <Control icon="restart" title="REPLAY" onPress={game.solo ? startSolo : start} />}
          <Control icon="home-map-marker" title="EXIT" onPress={() => { gameRef.current = null; setPhase('menu'); }} />
        </View>
      </View>}
    </View> : null}
  </View>;
}

/**
 * Native-first on newly signed 2.0.5 only. A stored pending marker prevents
 * repeated auto-launch after process death or a fatal Android Godot exception.
 * The JS practice scene remains an explicit safe fallback, never the default.
 */
const GODOT_ARENA_PENDING_KEY = '@buklod/genesis-godot-v205/launch-pending';
function NativeGodotArenaPrimary() {
  const [stage, setStage] = useState<'launching' | 'opened' | 'returned' | 'failed' | 'recovery'>('launching');
  const [showPractice, setShowPractice] = useState(false);
  const launching = useRef(false);
  const wasBackgrounded = useRef(false);
  const alive = useRef(true);
  const launch = useCallback(async (explicitRetry = false) => {
    if (launching.current) return;
    launching.current = true;
    if (alive.current) setStage('launching');
    try {
      const pending = await AsyncStorage.getItem(GODOT_ARENA_PENDING_KEY);
      if (pending === 'pending' && !explicitRetry) {
        if (alive.current) setStage('recovery');
        return;
      }
      await AsyncStorage.setItem(GODOT_ARENA_PENDING_KEY, 'pending');
      const started = await openBundledEmpireArena();
      if (!started) {
        await AsyncStorage.removeItem(GODOT_ARENA_PENDING_KEY);
        if (alive.current) setStage('failed');
      } else if (alive.current) {
        setStage('opened');
      }
    } catch {
      await AsyncStorage.removeItem(GODOT_ARENA_PENDING_KEY).catch(() => {});
      if (alive.current) setStage('failed');
    } finally {
      launching.current = false;
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void launch();
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') wasBackgrounded.current = true;
      else if (wasBackgrounded.current) {
        wasBackgrounded.current = false;
        // Godot returned or its isolated Activity was destroyed.
        void AsyncStorage.removeItem(GODOT_ARENA_PENDING_KEY);
        if (alive.current) setStage(s =>
          s === 'opened' || s === 'launching' ? 'returned' : s);
      }
    });
    return () => { alive.current = false; sub.remove(); };
  }, [launch]);
  if (showPractice) return <EmpireArenaInApp/>;
  return <View style={{flex:1,backgroundColor:'#071523',justifyContent:'center',
    paddingHorizontal:24,gap:18}}>
    <Text style={{fontSize:23,fontWeight:'900',color:'#FFE4AA'}}>BUKLOD EMPIRE • ARENA</Text>
    <Text style={{color:'#CDE7E4',fontSize:15,lineHeight:22}}>
      {stage === 'launching' ? 'Binubuksan ang native Godot Arena…'
        : stage === 'opened' ? 'Native Godot Arena is running.'
        : stage === 'returned' ? 'Bumalik mula sa Godot Arena.'
        : stage === 'recovery' ? 'Natigil ang nakaraang Godot launch. Hindi ito awtomatikong uulitin para maiwasan ang crash loop.'
        : 'Hindi nabuksan ang Godot Arena. Ligtas pa rin ang BUKLOD app.'}
    </Text>
    {stage !== 'launching' && stage !== 'opened' ?
      <Pressable accessibilityRole="button" accessibilityLabel="Retry native Godot Arena"
        onPress={() => void launch(true)} style={{padding:14,borderRadius:11,backgroundColor:'#37795F'}}>
        <Text style={{color:'#FFF4C9',fontWeight:'900',textAlign:'center'}}>RETRY GODOT</Text>
      </Pressable> : null}
    {stage !== 'launching' ?
      <Pressable accessibilityRole="button" accessibilityLabel="Open offline practice fallback"
        onPress={() => setShowPractice(true)} style={{padding:14,borderRadius:11,backgroundColor:'#233F50'}}>
        <Text style={{color:'#D9ECEC',fontWeight:'900',textAlign:'center'}}>OFFLINE PRACTICE (FALLBACK)</Text>
      </Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD Kingdom"
      onPress={() => router.back()} style={{padding:14}}>
      <Text style={{color:'#D4DEDF',textAlign:'center'}}>BACK TO KINGDOM</Text>
    </Pressable>
  </View>;
}

/** Fail-closed direct-link guard: Arena cannot bypass the canonical BUKLOD map's
 * auth, consent, maintenance, mandatory-update or onboarding boundaries.
 * Crucially, production clients never mount or orient-lock the Arena screen.
 */
export default function EmpireArenaRouteGuard() {
  const {user,loading,profile}=useAuth();
  const {requiresAcceptance}=useCompliance();
  const {config}=useRuntimeConfig();
  if (!isGenesisPreviewBuild()) return <Redirect href="/(tabs)/buklod"/>;
  if (loading && !user) return <View style={{flex:1,backgroundColor:'#071523'}}/>;
  if (!user) return <Redirect href="/(auth)/login"/>;
  if (config?.maintenance_mode) return <Redirect href="/system/maintenance"/>;
  if (config?.update_required) return <Redirect href="/system/update-required"/>;
  if (config?.pilot_access_required && !config?.pilot_access_granted) return <Redirect href="/system/pilot-access"/>;
  if (requiresAcceptance) return <Redirect href="/privacy/consent"/>;
  if (!profile) return <Redirect href="/onboarding"/>;
  if(isGenesis206NativeWorldEntry()) return <GenesisNativeWorldEntry world="arena" fallback={<EmpireArenaInApp/>}/>;
  // Preserve the existing 2.0.5 native-first route.
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true'
    ? <NativeGodotArenaPrimary/> : <EmpireArenaInApp/>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071323' },
  top: { minHeight: 51, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 9, borderBottomColor: '#456570', borderBottomWidth: 1 },
  back: { padding: 7, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  portrait: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#b69a62' },
  audioToggle: { minHeight: 40, minWidth: 40, padding: 6, justifyContent: 'center', alignItems: 'center' },
  topText: { flex: 1, minWidth: 0 },
  header: { color: '#ffe0a4', fontWeight: '900', fontSize: 14 },
  sub: { color: '#a7c4ce', fontSize: 9 },
  menuScroll: { flex: 1, width: '100%' },
  teamCallPanel: {position:'absolute',left:8,top:7,zIndex:24,width:265,
    padding:9,backgroundColor:'#092b3bf5',borderColor:'#87cdb5',borderWidth:1.4,
    borderRadius:12,gap:4},
  teamCallPanelCompact: {top:5,width:245,padding:7},
  teamCallHeader: {fontSize:11,color:'#ffebb9',fontWeight:'900'},
  teamCallHint: {fontSize:10,color:'#b6e8d5'},
  teamCallGrid: {flexDirection:'row',flexWrap:'wrap',gap:5},
  teamCallButton: {minWidth:73,minHeight:40,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:3,paddingHorizontal:6,borderRadius:9,
    backgroundColor:'#28526a',borderColor:'#8bc9ba',borderWidth:1},
  teamCallButtonText: {fontSize:10,fontWeight:'900',color:'#ecf9d6'},
  teamCallToast: {position:'absolute',top:36,alignSelf:'center',zIndex:22,
    flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:7,
    borderRadius:20,backgroundColor:'#184450ea',borderWidth:1,borderColor:'#adf6cd'},
  teamCallToastText:{fontSize:10,fontWeight:'900',color:'#e8ffe7'},
  soloBanner: {flexDirection:'row',alignItems:'center',gap:9,borderRadius:12,
    padding:10,borderWidth:1.5,borderColor:'#54c6a8',backgroundColor:'#0d3541ed'},
  soloBannerTitle: {fontWeight:'900',fontSize:13,color:'#d9ffe4'},
  soloBannerNote: {fontSize:10,color:'#bbd9d2',lineHeight:15},
  soloStart: {backgroundColor:'#9eeac9',borderColor:'#ffe4aa',borderWidth:1.5},
  heroPicker: {gap:6,paddingVertical:2,paddingRight:10},
  heroPick: {width:69,height:82,borderWidth:1,borderColor:'#345a69',
    borderRadius:11,backgroundColor:'#142e3c',alignItems:'center',padding:3},
  heroPickActive: {borderColor:'#ebd69b',borderWidth:2,backgroundColor:'#29544d'},
  cpuPickActive: {borderColor:'#ffae91',borderWidth:2,backgroundColor:'#543a4f'},
  heroPickImage: {width:55,height:58},
  heroPickText: {fontSize:10,color:'#fff0c9',fontWeight:'800',maxWidth:65},
  soloScore: {zIndex:2,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    backgroundColor:'#0a2838',minHeight:23,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:'#628a89'},
  soloScoreText: {fontWeight:'900',fontSize:10,color:'#ffe5a3'},
  soloCpuName: {fontSize:9,color:'#febfab',fontWeight:'800'},
  roundBanner: {position:'absolute',alignSelf:'center',top:'34%',zIndex:22,
    paddingHorizontal:23,paddingVertical:15,borderRadius:13,backgroundColor:'#081e36ec',
    borderColor:'#eacb82',borderWidth:1.5,alignItems:'center'},
  roundBannerText: {color:'#ffe7a7',fontSize:23,fontWeight:'900'},
  roundBannerNote: {color:'#dceae4',fontSize:11},
  menuHeroPreview: {minHeight:68,flexDirection:'row',alignItems:'center',gap:10,
    borderRadius:13,backgroundColor:'#102a3988',borderColor:'#786746',borderWidth:1,paddingHorizontal:9},
  menuHeroImage: {width:61,height:67},
  menuHeroText: {flex:1,gap:2},
  heroName: {color:'#ffe2a5',fontSize:16,fontWeight:'900'},
  heroCaption: {color:'#d5dedb',fontSize:10,fontWeight:'700'},
  sceneOptions: {flexDirection:'row',flexWrap:'wrap',gap:8},
  sceneCard: {width:142,height:75,borderWidth:1.5,borderColor:'#567988',borderRadius:10,overflow:'hidden',
    backgroundColor:'#0e2a3a',justifyContent:'flex-end',padding:7},
  sceneActive: {borderColor:'#f2d292',borderWidth:2.5},
  sceneTitle: {fontSize:10,color:'#fff2d8',fontWeight:'900'},
  sceneCheck: {position:'absolute',right:5,top:5},
  hudEditor: {position:'absolute',top:28,alignSelf:'center',zIndex:20,
    flexDirection:'row',alignItems:'center',gap:7,borderRadius:11,borderWidth:1,
    borderColor:'#d9c791',backgroundColor:'#061c30e8',paddingHorizontal:7,paddingVertical:5},
  hudEditorText: {fontSize:10,color:'#fff1c6',fontWeight:'900'},
  hudEditorButton: {minHeight:44,justifyContent:'center',paddingHorizontal:10,paddingVertical:7,borderRadius:8,backgroundColor:'#294a5c'},
  hudEditorAction: {fontSize:10,fontWeight:'900',color:'#fff1cf'},
  hudSave: {backgroundColor:'#39755f'},
  menu: { alignSelf: 'center', width: '100%', maxWidth: 720, paddingHorizontal: 18, paddingVertical: 18, gap: 11 },
  menuCompact: { maxWidth: 1000, paddingVertical: 8, gap: 7 },
  topCompact: { minHeight: 44 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  zoomButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#567782', borderRadius: 7, backgroundColor: '#102a3d' },
  zoomText: { color: '#ffe7b5', fontSize: 10, fontWeight: '800' },
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
  minimapCompact: { width: 82, height: 48, top: 4, right: 4 },
  fieldLabel: { position: 'absolute', top: 6, alignSelf: 'center', backgroundColor: '#09152099', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  labelText: { color: '#f8e6bd', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  info: { paddingHorizontal: 8, paddingVertical: 4, minHeight: 24, backgroundColor: '#051021' },
  infoText: { color: '#e4dbb9', fontSize: 10 },
  joystick: { position: 'absolute', left: 16, bottom: 31, width: 113, height: 110, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  joystickCompact: { left: 10, bottom: 5, width: 88, height: 88 },
  joyRing: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#081d30bb', borderWidth: 2, borderColor: '#a8bcb9', alignItems: 'center', justifyContent: 'center' },
  joyHandle: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#d1a85cbb', borderWidth: 2, borderColor: '#ffe5b7' },
  joyLabel: { fontSize: 9, color: '#ffe7bd', fontWeight: '900' },
  actions: { position: 'absolute', right: 9, bottom: 32, zIndex: 5, gap: 6 },
  actionsCompact: { right: 7, bottom: 5, gap: 3 },
  tactics: { position: 'absolute', right: 12, top: 8, zIndex: 6, width: 340, maxWidth: '66%',
    borderRadius: 11, borderWidth: 1, borderColor: '#f1ca86', backgroundColor: '#061e30ed', padding: 8, gap: 6 },
  tacticsCompact: {top:8,bottom:undefined,maxHeight:'75%'},
  tacticsHeader: { color: '#fff1c5', fontWeight: '900', fontSize: 10 },
  tacticsControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tacticsHint: { color: '#c1d3d1', fontSize: 10 },
  actionLine: { flexDirection: 'row', alignSelf: 'flex-end', gap: 5 },
  control: { width:53,height:53,borderRadius:28, borderWidth: 1, borderColor: '#c5ac7d', backgroundColor: '#102a3ddd', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 4 },
  controlLabel: { color: '#ffe7b5', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.35 },
  overlay: { position: 'absolute', top: 25, bottom: 25, left: '22%', right: '22%', zIndex: 10, borderWidth: 1, borderColor: '#d3b477', backgroundColor: '#061727f2', borderRadius: 15, padding: 15, alignItems: 'center', justifyContent: 'center', gap: 14 },
  overlayTitle: { color: '#ffe8ae', fontWeight: '900', fontSize: 27 },
});
