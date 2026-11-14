/** Lightweight web/default fallback: no native Skia/Rive dependency. */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type BuildingId = 'water' | 'school' | 'farm' | 'clinic' | 'road';
type Props = { built: readonly BuildingId[] };
const PLOTS: readonly { id: BuildingId; x: number; y: number; color: string }[] = [
  { id: 'water', x: 82, y: 112, color: '#7cdcf0' },
  { id: 'school', x: 161, y: 91, color: '#f9ce92' },
  { id: 'farm', x: 268, y: 116, color: '#b6df77' },
  { id: 'clinic', x: 219, y: 158, color: '#f2abb3' },
  { id: 'road', x: 115, y: 170, color: '#ddd2b3' },
];

function KingdomVillageDiorama({ built }: Props) {
  const constructed = new Set(built);
  return <View style={styles.shell} pointerEvents="none">
    <Svg viewBox="0 0 360 205" width="100%" height={195} accessible={false}>
      <Path d="M 5 118 L 181 28 L 355 122 L 179 202 Z" fill="#4a8066" />
      <Path d="M 19 119 L 181 39 L 337 123 L 177 193 Z" fill="#8aaf7d" />
      <Path d="M 10 130 Q 106 115 180 141 T 349 143"
        stroke="#d8c7a0" strokeWidth={9} strokeLinecap="round" fill="none" />
      {PLOTS.map(plot => {
        const builtHere = constructed.has(plot.id);
        return <G key={plot.id}>
          <Path d={`M ${plot.x-24} ${plot.y} L ${plot.x} ${plot.y-13} L ${plot.x+24} ${plot.y} L ${plot.x} ${plot.y+13} Z`}
            fill="#6c897b" />
          {builtHere ? <G>
            <Rect x={plot.x-15} y={plot.y-11} width={30} height={25} fill="#977d67" />
            <Path d={`M ${plot.x-21} ${plot.y-11} L ${plot.x} ${plot.y-28} L ${plot.x+21} ${plot.y-11} Z`}
              fill={plot.color} />
            <Circle cx={plot.x} cy={plot.y-4} r={4} fill="#fff7e5" />
          </G> : null}
        </G>;
      })}
    </Svg>
    <Text style={styles.caption}>{built.length}/5 COMMUNITY PROJECTS BUILT · HIGHLAND VILLAGE</Text>
  </View>;
}
export default memo(KingdomVillageDiorama);
const styles = StyleSheet.create({
  shell: { width: '100%', backgroundColor: 'rgba(16,48,42,.65)',
    borderWidth: 1, borderRadius: 16, overflow: 'hidden',
    borderColor: 'rgba(197,230,176,.25)', alignItems: 'center' },
  caption: { color: '#d5ead9', fontSize: 10, fontWeight: '800',
    textAlign: 'center', letterSpacing: .6, paddingBottom: 9 },
});
