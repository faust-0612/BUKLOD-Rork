/**
 * Immersive, source-owned BUKLOD Arena combat HUD.
 * Designed for one-handed landscape touch, not copied from another game's UI.
 * Draggable normalized anchors are saved by the route; this layer is visual only.
 */
import React, { memo, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PanResponderInstance } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
// @ts-ignore — pure shared JS positioning rules
import { ARENA_HUD_DEFAULT, clampArenaHudPoint, moveArenaHudPoint } from './arenaHudLayout.mjs';

export type ArenaHudKey =
  | 'joystick' | 'attack' | 'primary' | 'secondary' | 'ultimate'
  | 'mine' | 'bank' | 'train' | 'tactics';
export type HudPoint = { x: number; y: number };
export type ArenaHudLayout = Record<ArenaHudKey, HudPoint>;
export type CombatAction = {
  id: Exclude<ArenaHudKey, 'joystick'>;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
  cooldownMs?: number;
};

const DIMS: Record<ArenaHudKey, number> = {
  joystick: 91, attack: 72, primary: 57, secondary: 53, ultimate: 57,
  mine: 44, bank: 44, train: 44, tactics: 44,
};
const TINT: Record<ArenaHudKey, {edge: string; light: string; dark: string; glow: string}> = {
  joystick: {edge:'#88ead9',light:'#347a82',dark:'#071d34',glow:'#83ecd9'},
  attack: {edge:'#ffde9e',light:'#e97c4f',dark:'#5e2035',glow:'#ffb45c'},
  primary: {edge:'#81f5df',light:'#298fa1',dark:'#103356',glow:'#91fcf5'},
  secondary: {edge:'#b7dfff',light:'#4d91ca',dark:'#213c64',glow:'#99d9ff'},
  ultimate: {edge:'#f8b7fa',light:'#9b4db8',dark:'#34245f',glow:'#efa3ff'},
  mine: {edge:'#d9c389',light:'#65533e',dark:'#1a2834',glow:'#f1dca0'},
  bank: {edge:'#d9c389',light:'#65533e',dark:'#1a2834',glow:'#f1dca0'},
  train: {edge:'#b3dfb0',light:'#396e5a',dark:'#143343',glow:'#a6efbb'},
  tactics: {edge:'#bacfed',light:'#4e627e',dark:'#17364a',glow:'#b9dafa'},
};

type SlotProps = {
  id: ArenaHudKey; point: HudPoint; width: number; height: number;
  editing: boolean; onMove: (id: ArenaHudKey, point: HudPoint) => void;
  children: React.ReactNode;
};
const HudSlot = memo(function HudSlot({ id, point, width, height, editing, onMove, children }: SlotProps) {
  const size = DIMS[id];
  const current = useRef(point);
  current.current = point;
  const start = useRef(point);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => editing,
    onMoveShouldSetPanResponder: () => editing,
    onPanResponderGrant: () => { start.current = current.current; },
    onPanResponderMove: (_, gesture) => {
      if (!editing) return;
      onMove(id, moveArenaHudPoint(start.current, gesture.dx, gesture.dy, size, width, height));
    },
    onPanResponderTerminationRequest: () => !editing,
  }), [editing, id, onMove, size, width, height]);
  const safe = clampArenaHudPoint(point, size, width, height);
  return (
    <View
      pointerEvents="auto"
      {...(editing ? pan.panHandlers : {})}
      style={[
        styles.slot,
        {left: safe.x * width - size / 2, top: safe.y * height - size / 2,
          width: size, height: size, zIndex: id === 'joystick' ? 7 : id === 'attack' ? 8 : 6},
        editing && styles.editingSlot,
      ]}
    >{children}</View>
  );
});

function ActionButton({ item, editing }: { item: CombatAction; editing: boolean }) {
  const theme = TINT[item.id];
  const size = DIMS[item.id];
  const main = item.id === 'attack';
  const utility = ['mine','bank','train','tactics'].includes(item.id);
  const cooldown = Math.max(0, Number(item.cooldownMs) || 0);
  const dimmed = Boolean(item.disabled) || cooldown > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={editing ? 'Drag this control to a new position' :
        cooldown > 0 ? 'Ability recharging' : undefined}
      disabled={editing || dimmed}
      onPress={item.onPress}
      style={({pressed}) => [
        styles.actionSurface,
        {opacity: dimmed ? .62 : 1, transform:[{scale: pressed ? .92 : 1}]},
      ]}
    >
      <LinearGradient
        colors={[theme.light, theme.dark]}
        start={{x:.19,y:.1}} end={{x:.87,y:.95}}
        style={[styles.roundButton, {width:size - 4,height:size - 4,borderRadius:size,
          borderColor:theme.edge,borderWidth: main ? 2.6 : 1.5}]}
      >
        <Svg width={size - 7} height={size - 7} viewBox="0 0 80 80"
          pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs><RadialGradient id={"arena-hud-sigil-"+item.id} cx="40%" cy="23%" r="75%">
            <Stop offset="0%" stopColor={theme.glow} stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#091525" stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="40" cy="40" r="35.5" fill={"url(#arena-hud-sigil-"+item.id+")"} />
          <Circle cx="40" cy="40" r="32" fill="none" stroke={theme.edge}
            strokeOpacity=".55" strokeWidth="1.2" strokeDasharray={utility ? '6 8':'16 4'} />
          <Path d="M18 22 Q40 7 62 22" fill="none" stroke="#ffffff"
            strokeOpacity=".36" strokeWidth="3" strokeLinecap="round"/>
          <Path d="M17 61 Q40 73 63 59" fill="none" stroke={theme.glow}
            strokeOpacity=".4" strokeWidth="2"/>
        </Svg>
        <MaterialCommunityIcons name={item.icon}
          size={main ? 31 : utility ? 20 : 25} color="#fff2cd"
          style={{textShadowColor:theme.glow,textShadowOffset:{width:0,height:0},textShadowRadius:6}} />
        {cooldown > 0 ? <View style={styles.cooldown}>
          <Text style={styles.cooldownText}>{Math.ceil(cooldown/1000)}</Text>
        </View> : null}
      </LinearGradient>
      <Text numberOfLines={1} style={[styles.buttonLabel, utility && styles.utilityLabel]}>
        {item.label}
      </Text>
      {editing ? <View style={styles.dragGlyph}><MaterialCommunityIcons name="drag" size={13} color="#fff" /></View> : null}
    </Pressable>
  );
}

function JoystickArt({ editing, joy, handlers }: {
  editing: boolean; joy: HudPoint; handlers: PanResponderInstance['panHandlers'];
}) {
  return <View style={styles.joystickSurface} {...(!editing ? handlers : {})}>
    <LinearGradient colors={['rgba(44,104,122,.65)','rgba(7,26,48,.88)']}
      style={styles.joyRing}>
      <Svg width="100%" height="100%" viewBox="0 0 82 82" pointerEvents="none"
        style={StyleSheet.absoluteFill}>
        <Circle cx="41" cy="41" r="38" stroke="#b5e7d9" strokeWidth="2" fill="none" strokeOpacity=".8"/>
        <Circle cx="41" cy="41" r="28" stroke="#74b6bb" strokeWidth="1" fill="none" strokeDasharray="4 6"/>
        <Path d="M41 7v8 M41 67v8 M7 41h8 M67 41h8" stroke="#e8dfb1" strokeWidth="2"/>
      </Svg>
      <LinearGradient colors={['#f0e0aa','#b07a49','#544e54']}
        style={[styles.joyHandle,
          {transform:[{translateX:joy.x*24},{translateY:joy.y*24}]}]} />
    </LinearGradient>
    <Text style={styles.joyLabel}>{editing ? 'DRAG' : 'MOVE'}</Text>
  </View>;
}

export function ArenaCombatHud({
  width, height, positions, editing, onMove, joystickHandlers, joy, actions,
}: {
  width: number; height: number; positions: ArenaHudLayout;
  editing: boolean; onMove: (id:ArenaHudKey, point:HudPoint)=>void;
  joystickHandlers: PanResponderInstance['panHandlers'];
  joy: HudPoint; actions: CombatAction[];
}) {
  if (width < 50 || height < 70) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <HudSlot id="joystick" point={positions.joystick || ARENA_HUD_DEFAULT.joystick}
      width={width} height={height} editing={editing} onMove={onMove}>
      <JoystickArt editing={editing} joy={joy} handlers={joystickHandlers}/>
    </HudSlot>
    {actions.map(item => <HudSlot key={item.id} id={item.id}
      point={positions[item.id] || ARENA_HUD_DEFAULT[item.id]}
      width={width} height={height} editing={editing} onMove={onMove}>
      <ActionButton item={item} editing={editing}/>
    </HudSlot>)}
  </View>;
}

const styles = StyleSheet.create({
  slot: {position:'absolute',alignItems:'center',justifyContent:'center'},
  editingSlot: {borderWidth:1,borderStyle:'dashed',borderColor:'#e8f9ffb8',borderRadius:50},
  actionSurface: {width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},
  roundButton: {
    alignItems:'center',justifyContent:'center',overflow:'hidden',
    shadowColor:'#fbd7a1',shadowOpacity:.4,shadowRadius:7,elevation:4,
  },
  buttonLabel: {position:'absolute',bottom:2,fontSize:8,fontWeight:'900',
    color:'#fff1d6',letterSpacing:.2,textShadowColor:'#061420',textShadowRadius:3},
  utilityLabel: {fontSize:7,bottom:0},
  cooldown: {position:'absolute',left:0,right:0,top:0,bottom:0,
    borderRadius:100,backgroundColor:'rgba(3,10,24,.66)',
    alignItems:'center',justifyContent:'center'},
  cooldownText: {fontSize:15,fontWeight:'900',color:'#ffffff'},
  dragGlyph: {position:'absolute',right:-1,top:-1,backgroundColor:'#184153',
    borderRadius:10,borderWidth:1,borderColor:'#9ee7d9'},
  joystickSurface: {width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},
  joyRing: {width:82,height:82,borderRadius:43,alignItems:'center',justifyContent:'center',
    borderColor:'#a5d9d2',borderWidth:1.5,overflow:'hidden'},
  joyHandle: {width:29,height:29,borderRadius:16,borderColor:'#fff0c3',borderWidth:2},
  joyLabel: {position:'absolute',bottom:0,fontSize:8,fontWeight:'900',color:'#faf0d4'},
});
