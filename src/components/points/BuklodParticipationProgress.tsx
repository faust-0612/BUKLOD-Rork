import React, { useEffect, useRef } from 'react';

import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PointsFocusFadeUp } from '@/components/points/PointsMotion';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

type Props = {
  rankName?: string | null;
  progressPercent: number;
  pointsToNext?: number | null;
  nextRankName?: string | null;
  weeklyPoints?: number;
  monthlyPoints?: number;
};

export default function BuklodParticipationProgress({
  rankName,
  progressPercent,
  pointsToNext = 0,
  nextRankName,
  weeklyPoints = 0,
  monthlyPoints = 0,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const fill = useRef(new Animated.Value(0)).current;

  const safeProgress = Math.max(
    0,
    Math.min(100, Number(progressPercent ?? 0))
  );

  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(safeProgress);
      return;
    }

    fill.setValue(0);

    Animated.timing(fill, {
      toValue: safeProgress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, reduceMotion, safeProgress]);

  const width = fill.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const styles = StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    eyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 1.2,
      color: theme.textMuted,
    },
    rank: {
      marginTop: 4,
      fontSize: 18,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    percent: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.accent,
    },
    track: {
      height: 10,
      marginTop: 14,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.inputSurface,
    },
    fill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    fillGlow: {
      ...StyleSheet.absoluteFill,
      backgroundColor: withAlpha(theme.warning, 0.35),
    },
    meta: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    metaText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    stats: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    stat: {
      flex: 1,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
    },
    statLabel: {
      fontSize: 8.5,
      fontWeight: '900',
      color: theme.textMuted,
    },
    statValue: {
      marginTop: 3,
      fontSize: 16,
      fontWeight: '900',
      color: theme.textPrimary,
    },
  });

  return (
    <PointsFocusFadeUp duration={240}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              PARTICIPATION PROGRESS
            </Text>
            <Text style={styles.rank}>
              {rankName || 'Circle Starter'}
            </Text>
          </View>
          <Text style={styles.percent}>
            {safeProgress.toFixed(0)}%
          </Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width }]}
          >
            <View style={styles.fillGlow} />
          </Animated.View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {nextRankName
              ? `${Number(pointsToNext ?? 0).toLocaleString('en-PH')} pts to ${nextRankName}`
              : 'Highest rank reached'}
          </Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statValue}>
              +{Number(weeklyPoints).toLocaleString('en-PH')}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>THIS MONTH</Text>
            <Text style={styles.statValue}>
              +{Number(monthlyPoints).toLocaleString('en-PH')}
            </Text>
          </View>
        </View>
      </View>
    </PointsFocusFadeUp>
  );
}
