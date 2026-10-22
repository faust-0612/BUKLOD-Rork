import React, { useRef } from 'react';

import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  PointsFocusFadeUp,
  useCountUpValue,
} from '@/components/points/PointsMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

type Props = {
  lifetimePoints: number;
  availablePoints: number;
  claimableCount?: number;
  /** Triggers HUD scale pop after claim. */
  pop?: boolean;
};

export default function BuklodPointsHud({
  lifetimePoints,
  availablePoints,
  claimableCount = 0,
  pop = false,
}: Props) {
  const { theme } = useBuklodPresentation();
  const displayAvailable = useCountUpValue(availablePoints, 500);
  const displayLifetime = useCountUpValue(lifetimePoints, 500);
  const popScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pop) {
      return;
    }

    Animated.sequence([
      Animated.timing(popScale, {
        toValue: 1.06,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(popScale, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop, popScale]);

  const styles = StyleSheet.create({
    shell: {
      minWidth: 168,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: withAlpha(theme.surface, 0.92),
      borderWidth: 1,
      borderColor: withAlpha(theme.warning, 0.35),
      shadowColor: theme.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      gap: 8,
    },
    block: {
      gap: 2,
    },
    eyebrow: {
      fontSize: 8.5,
      fontWeight: '900',
      letterSpacing: 1.3,
      color: theme.textMuted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    symbol: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.warning,
    },
    balance: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    lifetime: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textMuted,
    },
    claimable: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: withAlpha(theme.warning, 0.14),
    },
    claimableText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
      color: theme.warning,
    },
  });

  return (
    <PointsFocusFadeUp duration={220}>
      <Animated.View
        style={[
          styles.shell,
          { transform: [{ scale: popScale }] },
        ]}
      >
        <View style={styles.block}>
          <Text style={styles.eyebrow}>AVAILABLE POINTS</Text>
          <View style={styles.row}>
            <Text style={styles.symbol}>◉</Text>
            <Text style={styles.balance}>
              {displayAvailable.toLocaleString('en-PH')}
            </Text>
          </View>
        </View>

        <Text style={styles.lifetime}>
          Lifetime {displayLifetime.toLocaleString('en-PH')} pts
        </Text>

        {claimableCount > 0 && (
          <View style={styles.claimable}>
            <Text style={styles.claimableText}>
              {claimableCount} READY TO CLAIM
            </Text>
          </View>
        )}
      </Animated.View>
    </PointsFocusFadeUp>
  );
}
