/**
 * R9 -- in-game cinematic panel, one live scene for the selected 1/39 games.
 * All motion is native UI-thread Skia/Reanimated, driven by existing accepted
 * game feedback, with 13 approved original character sprite sets.
 * This is not an authored .riv rig: existing Rive runtime remains optional.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo, AppState, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useDerivedValue,
  useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import {
  Canvas, Circle, Group, Line, Path, Rect, RoundedRect, vec,
} from '@shopify/react-native-skia';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodSpecialCharacterArtV2 from '@/components/points/BuklodSpecialCharacterArtV2';
import { subscribeBuklodGameCharacterMotion } from '@/features/games/runtime/characterMotionBus';
import type { BuklodCharacterReaction } from '@/components/points/BuklodCharacterMotion';
import { KINGDOM_CHARACTER_MOTION, getKingdomCinematicScene, type KingdomSceneProfile } from './KingdomCinematicScenes';

const TAU = Math.PI * 2;
const CORE = ['phan','quin','van','christian','lhen'] as const;
const SPECIAL = ['jawo','trudice','ace','mitch','niel','angel','vhen','ellusur'] as const;
type SceneReaction = Extract<BuklodCharacterReaction,
  'move'|'collect'|'impact'|'success'|'failure'|'unlock'>;
function isSceneReaction(event: BuklodCharacterReaction): event is SceneReaction {
  return event === 'move' || event === 'collect' || event === 'impact'
    || event === 'success' || event === 'failure' || event === 'unlock';
}
function KingdomHeroArt({ id, size }: { id: string; size: number }) {
  if (CORE.some(x => x === id)) {
    return <BuklodProgressiveCharacterArt
      characterId={id as (typeof CORE)[number]} level={1}
      height={size} viewportWidth={size * .8} />;
  }
  if (SPECIAL.some(x => x === id)) {
    return <BuklodSpecialCharacterArtV2
      characterId={id as (typeof SPECIAL)[number]}
      height={size} viewportWidth={size * .8} />;
  }
  return null;
}
const KineticGlyph = memo(function KineticGlyph({
  profile, index, phase, burst, reaction,
}: {
  profile: KingdomSceneProfile;
  index: number;
  phase: SharedValue<number>;
  burst: SharedValue<number>;
  reaction: SceneReaction | null;
}) {
  const x0 = 22 + index * 40;
  const y0 = 47 + (profile.seed + index * 17) % 16;
  const offset = ((profile.seed + index * 11) % 41) / 41;
  const cx = useDerivedValue(() => {
    const t = (phase.value + offset) * TAU;
    const response = Math.max(0, 1 - burst.value);
    const motion = profile.motion === 'flow' || profile.motion === 'sweep' ? Math.sin(t) * 17
      : profile.motion === 'orbit' ? Math.cos(t) * 10
      : profile.motion === 'trace' ? Math.sin(t * .7) * 8
      : profile.motion === 'scan' ? Math.sin(t) * 5 : 0;
    return x0 + motion + response * (reaction === 'impact' ? -5 : 7);
  });
  const cy = useDerivedValue(() => {
    const t = (phase.value + offset) * TAU;
    const response = Math.max(0, 1 - burst.value);
    const motion = profile.motion === 'rise' ? Math.sin(t) * 15
      : profile.motion === 'wave' ? Math.sin(t * 2) * 17
      : profile.motion === 'orbit' ? Math.sin(t) * 12
      : profile.motion === 'pulse' ? Math.sin(t) * 5
      : profile.motion === 'trace' ? Math.cos(t * .8) * 8 : Math.sin(t) * 5;
    return y0 - motion - response * (reaction === 'collect' || reaction === 'success' ? 14 : 0);
  });
  const alpha = useDerivedValue(() => {
    const wave = Math.sin((phase.value + offset) * TAU);
    return Math.min(1, .35 + (1 + wave) * .21 + Math.max(0, 1-burst.value) * .22);
  });
  const radius = useDerivedValue(() => {
    return 7 + (1 + Math.sin((phase.value + offset) * TAU)) * 2
      + Math.max(0, 1-burst.value) * (reaction === 'success' ? 5 : 2);
  });
  const height = useDerivedValue(() => 15 + 14 * (1+Math.sin((phase.value+offset)*TAU)) / 2
    + 12 * Math.max(0,1-burst.value));
  const tileY = useDerivedValue(() => cy.value - 11);
  const columnY = useDerivedValue(() => cy.value - height.value / 2);

  return <Group opacity={alpha}>
    {profile.shape === 'pillars' || profile.shape === 'equalizer' ?
      <RoundedRect x={cx} y={columnY} width={profile.shape==='equalizer'?9:15}
        height={height} r={4} color={profile.accent} /> : null}
    {profile.shape === 'tiles' ?
      <RoundedRect x={cx} y={tileY} width={21} height={21} r={5}
        color={profile.accent} /> : null}
    {profile.shape === 'rings' ?
      <Circle cx={cx} cy={cy} r={radius} color={profile.accent}
        style="stroke" strokeWidth={3} /> : null}
    {profile.shape === 'rays' ?
      <Group><Circle cx={cx} cy={cy} r={radius} color={profile.accent}/>
        <Circle cx={cx} cy={cy} r={4} color="#fff9e5" /></Group> : null}
    {profile.shape === 'circuit' ?
      <Group><Rect x={cx} y={tileY} width={19} height={19}
        color={profile.accent} style="stroke" strokeWidth={2}/>
        <Circle cx={cx} cy={cy} r={3} color="#ffffff"/></Group> : null}
    {profile.shape === 'lanes' ?
      <RoundedRect x={cx} y={tileY} width={7} height={25} r={3}
        color={profile.accent} /> : null}
    {profile.shape === 'runes' ?
      <Group><Circle cx={cx} cy={cy} r={radius} color={profile.accent}
        style="stroke" strokeWidth={2}/>
        <Line p1={vec(x0+8,y0-8)} p2={vec(x0+14,y0+8)}
          color="#fff2d5" strokeWidth={2}/></Group> : null}
    {profile.shape === 'labyrinth' ?
      <Group><Circle cx={cx} cy={cy} r={radius} color={profile.accent}
        style="stroke" strokeWidth={2}/>
        <Path path={`M${x0-6} ${y0+8} L${x0+6} ${y0+8} L${x0+6} ${y0-8}`}
          color={profile.accent} style="stroke" strokeWidth={2}/></Group> : null}
  </Group>;
});

function Scene({ gameId, profile, compact }: {
  gameId: string; profile: KingdomSceneProfile; compact: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reaction, setReaction] = useState<SceneReaction | null>(null);
  const cycle = useSharedValue(0);
  const burst = useSharedValue(1);
  const running = focused && active && !reduceMotion;
  const motion = KINGDOM_CHARACTER_MOTION[profile.character];

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if(live) setReduceMotion(Boolean(enabled));
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged',
      enabled => { if(live) setReduceMotion(Boolean(enabled)); });
    const app = AppState.addEventListener('change',
      state => { if(live) setActive(state === 'active'); });
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    cancelAnimation(cycle);
    cancelAnimation(burst);
    burst.value = 1;
    if (running) {
      cycle.value = withRepeat(withTiming(1, {
        duration: profile.cycleMs, easing: Easing.linear,
      }), -1, false);
    } else {
      cycle.value = 0;
      setReaction(null);
    }
    return () => { cancelAnimation(cycle); cancelAnimation(burst); };
  }, [cycle, burst, running, profile.cycleMs, gameId]);
  useEffect(() => {
    if (!running) return;
    const stop = subscribeBuklodGameCharacterMotion(event => {
      if (!isSceneReaction(event.type)) return;
      setReaction(event.type);
      cancelAnimation(burst);
      burst.value = 0;
      burst.value = withTiming(1, {
        duration: event.type==='success' ? 930 : event.type==='impact' ? 340 : 560,
        easing: Easing.out(Easing.cubic),
      });
    });
    return stop;
  }, [burst, running, gameId]);
  const characterStyle = useAnimatedStyle(() => {
    const response = Math.max(0, 1 - burst.value);
    const driftY = Math.sin(cycle.value * TAU) * motion.idleY;
    const driftX = Math.cos(cycle.value * TAU) * motion.idleX;
    const isHit = reaction === 'impact' || reaction === 'failure';
    const hop = reaction === 'collect' || reaction === 'success' || reaction === 'unlock';
    const offsetX = (isHit ? Math.sin(burst.value * TAU * 4) * motion.impactShake
      : reaction === 'move' ? motion.moveX : 0) * response;
    const tilt = (isHit ? -motion.turnDeg
      : reaction === 'success' ? motion.turnDeg
      : reaction === 'move' ? motion.turnDeg / 2 : 0) * response;
    return {
      transform: [
        {translateY: driftY - (hop ? motion.collectHop : 0) * response},
        {translateX: driftX + offsetX},
        {rotate: `${tilt}deg`},
        {scale: 1 + (reaction === 'success' ? motion.victoryScale : .035) * response},
      ],
    };
  });
  const progressX = useDerivedValue(() => 10 + cycle.value * 212);
  const progressOpacity = useDerivedValue(() => .22 + (1-burst.value)*.6);
  const artSize = compact ? 62 : 86;

  return <View pointerEvents="none" style={[
    styles.surface, { backgroundColor: profile.shade }, compact && styles.compact,
  ]} accessible={false}>
    <View style={styles.artHolder}>
      <Animated.View style={characterStyle}>
        <KingdomHeroArt id={profile.character} size={artSize} />
      </Animated.View>
    </View>
    <View style={styles.right}>
      <Text numberOfLines={1} style={styles.title}>
        {profile.glyph}  {profile.title.toUpperCase()}
      </Text>
      {!compact ? <Text numberOfLines={1} style={styles.subtitle}>
        {profile.character.toUpperCase()} · LIVE GAMEPLAY MOTION
      </Text> : null}
      <Canvas style={compact ? styles.canvasCompact : styles.canvas}>
        {Array.from({length:profile.density},(_,i)=>
          <KineticGlyph key={i} profile={profile} index={i}
            phase={cycle} burst={burst} reaction={reaction}/>)}
        <Group opacity={progressOpacity}>
          <Circle cx={progressX} cy={12} r={3} color={profile.accent}/>
        </Group>
      </Canvas>
    </View>
  </View>;
}
function KingdomCinematicScene({gameId, compact=false}: {
  gameId: string; compact?: boolean;
}) {
  const profile = getKingdomCinematicScene(gameId);
  if (!profile) return null;
  return <Scene key={gameId} gameId={gameId} profile={profile} compact={compact}/>;
}
export default memo(KingdomCinematicScene);

const styles=StyleSheet.create({
  surface: { height:110, borderRadius:18, overflow:'hidden',
    borderWidth:1, borderColor:'rgba(246,231,187,.35)', flexDirection:'row',
    alignItems:'center', marginBottom:6 },
  compact:{height:70,borderRadius:14},
  artHolder:{width:89,alignItems:'center',justifyContent:'flex-end'},
  right:{flex:1,paddingRight:9,minWidth:0},
  title:{fontSize:13,fontWeight:'900',color:'#fff8ea',letterSpacing:.6},
  subtitle:{fontSize:9,color:'#e9eff3',fontWeight:'700',marginTop:2},
  canvas:{width:248,height:63},
  canvasCompact:{width:238,height:41},
});
