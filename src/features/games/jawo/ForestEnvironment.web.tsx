import React from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';

type Props = {
  intensity: 1 | 2 | 3;
  progress: number;
};

const FIREFLIES: ReadonlyArray<readonly [DimensionValue, DimensionValue]> = [
  ['19%', '31%'],
  ['72%', '27%'],
  ['83%', '43%'],
  ['14%', '51%'],
  ['54%', '22%'],
  ['62%', '55%'],
];

export function ForestEnvironment({ intensity, progress }: Props) {
  const glowOpacity = 0.16 + Math.min(0.22, progress / 500);
  const fogOpacity = 0.05 + intensity * 0.018;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.edge, styles.edgeLeft, { opacity: 0.36 + intensity * 0.04 }]} />
      <View style={[styles.edge, styles.edgeRight, { opacity: 0.36 + intensity * 0.04 }]} />
      <View style={[styles.trunk, { left: '5%', height: '68%' }]} />
      <View style={[styles.trunk, { left: '18%', height: '54%', opacity: 0.6 }]} />
      <View style={[styles.trunk, { right: '7%', height: '71%' }]} />
      <View style={[styles.trunk, { right: '20%', height: '52%', opacity: 0.55 }]} />
      <View style={[styles.fog, { top: '42%', opacity: fogOpacity }]} />
      <View style={[styles.fog, { top: '59%', opacity: fogOpacity * 0.78 }]} />
      {FIREFLIES.map(([left, top], index) => (
        <View key={index} style={[styles.firefly, { left, top, opacity: glowOpacity }]}>
          <View style={styles.fireflyCore} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '31%',
    backgroundColor: '#03110b',
  },
  edgeLeft: {
    left: '-10%',
    transform: [{ skewY: '-7deg' }],
  },
  edgeRight: {
    right: '-10%',
    transform: [{ skewY: '7deg' }],
  },
  trunk: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(53,42,30,0.50)',
  },
  fog: {
    position: 'absolute',
    left: '-8%',
    width: '116%',
    height: 76,
    borderRadius: 76,
    backgroundColor: '#d9ffe6',
  },
  firefly: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(234,255,159,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#eaff9f',
    shadowOpacity: 0.85,
    shadowRadius: 14,
  },
  fireflyCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f1ffc1',
  },
});
