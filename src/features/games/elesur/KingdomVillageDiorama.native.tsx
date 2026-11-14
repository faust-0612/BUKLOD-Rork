/** Zero-asset, gameplay-bound highland diorama. Existing VillageBuilder rules
 * and rewards are untouched; buildings appear only after a valid build action. */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Canvas, Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import {
  cancelAnimation, Easing, useDerivedValue, useSharedValue,
  withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';

type BuildingId = 'water' | 'school' | 'farm' | 'clinic' | 'road';
type Props = { built: readonly BuildingId[] };
type Plot = { id: BuildingId; x: number; y: number; tint: string };
const PLOTS: readonly Plot[] = [
  { id: 'water', x: 82, y: 112, tint: '#7cdcf0' },
  { id: 'school', x: 161, y: 91, tint: '#f9ce92' },
  { id: 'farm', x: 268, y: 116, tint: '#b6df77' },
  { id: 'clinic', x: 219, y: 158, tint: '#f2abb3' },
  { id: 'road', x: 115, y: 170, tint: '#ddd2b3' },
];
const TAU = Math.PI * 2;

function PlotBuilding({ plot, done }: { plot: Plot; done: boolean }) {
  const { x, y, tint, id } = plot;
  const reveal = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    cancelAnimation(reveal);
    reveal.value = withTiming(done ? 1 : 0, { duration: 640, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(reveal);
  }, [done, reveal]);
  return <Group>
    <Path path={`M ${x-24} ${y} L ${x} ${y-13} L ${x+24} ${y} L ${x} ${y+13} Z`}
      color={done ? '#b7d1b0' : '#6c897b'} />
    <Group opacity={reveal}>
      {id === 'water' ? <Group>
        <RoundedRect x={x-18} y={y-5} width={36} height={18} r={7} color="#347b92" />
        <RoundedRect x={x-13} y={y-1} width={26} height={9} r={4} color={tint} />
        <Rect x={x-4} y={y-22} width={8} height={18} color="#e9e3cd" />
        <Circle cx={x} cy={y-24} r={5} color="#e9e3cd" />
      </Group> : null}
      {id === 'farm' ? <Group>
        {[-13,-6,1,8].map(dx => <Path key={dx}
          path={`M ${x+dx-7} ${y+2} L ${x+dx+8} ${y-5}`}
          style="stroke" strokeWidth={3} color={tint} />)}
        <RoundedRect x={x-9} y={y-18} width={18} height={15} r={2} color="#d4a779" />
        <Path path={`M ${x-13} ${y-18} L ${x} ${y-28} L ${x+13} ${y-18} Z`}
          color="#8e664a" />
      </Group> : null}
      {id === 'road' ? <Group>
        <Path path={`M ${x-23} ${y+8} L ${x+19} ${y-11}`}
          color={tint} style="stroke" strokeWidth={11} strokeCap="round" />
        <Path path={`M ${x-23} ${y+8} L ${x+19} ${y-11}`}
          color="#7d7963" style="stroke" strokeWidth={1.5} strokeCap="round" />
      </Group> : null}
      {id === 'school' || id === 'clinic' ? <Group>
        <Rect x={x-17} y={y-7} width={34} height={24} color="#8b7862" />
        <Rect x={x-17} y={y-7} width={12} height={24} color="#a08d77" />
        <Path path={`M ${x-24} ${y-7} L ${x} ${y-28} L ${x+24} ${y-7} Z`}
          color={id === 'school' ? '#bf855e' : '#b97b88'} />
        <Rect x={x-5} y={y+3} width={10} height={14} color="#485c60" />
        {id === 'clinic' ? <Group>
          <Rect x={x-3} y={y-18} width={6} height={14} color="#fff7e2" />
          <Rect x={x-7} y={y-14} width={14} height={6} color="#fff7e2" />
        </Group> : <Group>
          <Rect x={x-11} y={y-2} width={7} height={7} color="#e5d1a4" />
          <Rect x={x+5} y={y-2} width={7} height={7} color="#e5d1a4" />
        </Group>}
      </Group> : null}
    </Group>
  </Group>;
}

function VillageWorker({ phase, scale, index }: {
  phase: SharedValue<number>; scale: number; index: number;
}) {
  const homeX = index === 0 ? 120 : index === 1 ? 232 : 285;
  const homeY = index === 0 ? 139 : index === 1 ? 115 : 157;
  const x = useDerivedValue(() => (homeX + Math.sin(phase.value * TAU + index * 1.9) * 19) * scale);
  const y = useDerivedValue(() => (homeY + Math.cos(phase.value * TAU * 1.3 + index * 1.7) * 9) * scale);
  const headY = useDerivedValue(() => y.value - 4 * scale);
  return <Group>
    <Circle cx={x} cy={y} r={4 * scale} color={index === 0 ? '#f2bf68' : '#7eac9d'} />
    <Circle cx={x} cy={headY} r={2.4 * scale} color="#f9e8c6" />
  </Group>;
}

function HighlandDiorama({ built }: Props) {
  const [width, setWidth] = useState(330);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reducedMotion, setReducedMotion] = useState(false);
  const cycle = useSharedValue(0);
  const running = focused && active && !reducedMotion;
  const scale = width / 360;
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (live) setReducedMotion(Boolean(value)); })
      .catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged',
      value => { if (live) setReducedMotion(Boolean(value)); });
    const app = AppState.addEventListener('change',
      value => { if (live) setActive(value === 'active'); });
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    cancelAnimation(cycle);
    cycle.value = running ? withRepeat(
      withTiming(1, { duration: 9500, easing: Easing.linear }), -1, false,
    ) : 0;
    return () => cancelAnimation(cycle);
  }, [cycle, running]);

  const builtSet = new Set(built);
  return <View pointerEvents="none" style={styles.shell} accessible={false}
    onLayout={event => {
      const measured = Math.round(event.nativeEvent.layout.width);
      if (measured > 0 && measured !== width) setWidth(measured);
    }}>
    <Canvas style={{ width, height: width * 205 / 360 }}>
      <Group transform={[{ scale }]}>
        <Path path="M 5 118 L 181 28 L 355 122 L 179 202 Z" color="#4a8066" />
        <Path path="M 19 119 L 181 39 L 337 123 L 177 193 Z" color="#7baa78" />
        <Path path="M 28 124 L 174 53 L 319 127 L 172 181 Z" color="#94b784" />
        <Path path="M 10 130 Q 106 115 180 141 T 349 143"
          color="#d8c7a0" style="stroke" strokeWidth={9} strokeCap="round" />
        <Path path="M 34 115 Q 91 75 141 94" color="#a7e6c0"
          style="stroke" strokeWidth={3} strokeCap="round" />
        {PLOTS.map(plot => <PlotBuilding key={plot.id}
          plot={plot} done={builtSet.has(plot.id)} />)}
      </Group>
      {Array.from({ length: 3 }, (_, index) =>
        <VillageWorker key={index} phase={cycle} scale={scale} index={index} />)}
    </Canvas>
    <Text style={styles.caption}>{built.length}/5 COMMUNITY PROJECTS BUILT · LIVE VILLAGE</Text>
  </View>;
}
export default memo(HighlandDiorama);

const styles = StyleSheet.create({
  shell: { width: '100%', overflow: 'hidden', borderRadius: 16,
    backgroundColor: 'rgba(16,48,42,.65)', borderWidth: 1,
    borderColor: 'rgba(197,230,176,.25)', paddingTop: 3, alignItems: 'center' },
  caption: { color: '#d5ead9', fontSize: 10, fontWeight: '800',
    textAlign: 'center', letterSpacing: .6, paddingBottom: 9, paddingHorizontal: 6 },
});
