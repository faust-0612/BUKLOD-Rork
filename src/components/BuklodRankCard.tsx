import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  rankName?: string | null;
  points?: number | null;

  nextRankName?: string | null;
  pointsToNext?: number | null;
  progressPercent?: number | null;

  seasonTitle?: string | null;
  overallPosition?: number | null;
  localPosition?: number | null;
};

export default function BuklodRankCard({
  rankName,
  points = 0,
  nextRankName,
  pointsToNext = 0,
  progressPercent = 0,
  seasonTitle,
  overallPosition,
  localPosition,
}: Props) {
  const progress = useRef(
    new Animated.Value(0)
  ).current;

  const pulse = useRef(
    new Animated.Value(1)
  ).current;

  const safeProgress = Math.max(
    0,
    Math.min(
      Number(progressPercent ?? 0),
      100
    )
  );

  useEffect(() => {
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: safeProgress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, safeProgress]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.045,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  const message = useMemo(() => {
    if (safeProgress >= 90) {
      return 'Almost there — one more push!';
    }

    if (safeProgress >= 70) {
      return 'Great momentum. Keep building!';
    }

    if (safeProgress >= 40) {
      return 'Consistency moves the circle forward.';
    }

    return 'Every meaningful activity adds progress.';
  }, [safeProgress]);

  const animatedWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Animated.View
          style={[
            styles.emblemOuter,
            {
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <View style={styles.emblemMiddle}>
            <View style={styles.emblemInner}>
              <Text style={styles.emblemSymbol}>
                ◉
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.rankInfo}>
          <Text style={styles.eyebrow}>
            BUKLOD APP ACTIVITY RANK
          </Text>

          <Text style={styles.rankName}>
            {rankName || 'Circle Starter III'}
          </Text>

          <Text style={styles.points}>
            ◉ {Number(points ?? 0).toLocaleString('en-PH')}
            {' '}BUKLOD Points
          </Text>
        </View>
      </View>

      {!!seasonTitle && (
        <View style={styles.seasonPill}>
          <Text style={styles.seasonText}>
            {seasonTitle}
          </Text>
        </View>
      )}

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          RANK PROGRESS
        </Text>

        <Text style={styles.progressPercent}>
          {safeProgress.toFixed(0)}%
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedWidth,
            },
          ]}
        />
      </View>

      {nextRankName ? (
        <Text style={styles.nextRank}>
          {Number(
            pointsToNext ?? 0
          ).toLocaleString('en-PH')}{' '}
          points to {nextRankName}
        </Text>
      ) : (
        <Text style={styles.nextRank}>
          Highest current BUKLOD rank reached
        </Text>
      )}

      <View style={styles.positionRow}>
        <View style={styles.positionBox}>
          <Text style={styles.positionValue}>
            {overallPosition
              ? `#${overallPosition}`
              : '—'}
          </Text>

          <Text style={styles.positionLabel}>
            OVERALL
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.positionBox}>
          <Text style={styles.positionValue}>
            {localPosition
              ? `#${localPosition}`
              : '—'}
          </Text>

          <Text style={styles.positionLabel}>
            LOCAL
          </Text>
        </View>
      </View>

      <View style={styles.messageBox}>
        <Text style={styles.messageSymbol}>
          ◉
        </Text>

        <Text style={styles.message}>
          {message}
        </Text>
      </View>

      <Text style={styles.disclaimer}>
        BUKLOD Rank reflects only recorded app
        participation, consistency, learning progress
        and engagement. It is not a measure of
        spiritual maturity, holiness, faith,
        Christian character or personal worth.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#182A22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },

  emblemOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8E6DD',
  },

  emblemMiddle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E684D',
  },

  emblemInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  emblemSymbol: {
    fontSize: 29,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  rankInfo: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.3,
    color: '#AABCB2',
  },

  rankName: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  points: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#C9DDD1',
  },

  seasonPill: {
    alignSelf: 'flex-start',
    marginTop: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  seasonText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#D9E6DE',
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 7,
  },

  progressLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#9FB1A7',
  },

  progressPercent: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  track: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#B9D4C3',
  },

  nextRank: {
    marginTop: 7,
    fontSize: 10,
    color: '#AEBFB5',
  },

  positionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },

  positionBox: {
    flex: 1,
    alignItems: 'center',
  },

  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  positionValue: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  positionLabel: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#96AAA0',
  },

  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },

  messageSymbol: {
    fontSize: 15,
    color: '#BFD5C7',
  },

  message: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#E2ECE6',
  },

  disclaimer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    fontSize: 9.5,
    lineHeight: 14,
    color: '#94A79C',
  },
});
