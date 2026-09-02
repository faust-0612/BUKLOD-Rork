import React from 'react';

import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  useClaimButtonGlow,
} from '@/components/points/PointsMotion';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

export type ClaimRewardItem = {
  id: string;
  title: string;
  message?: string | null;
  points?: number | null;
  eventType?: string;
  status: 'claimable' | 'claiming' | 'claimed' | 'failed';
};

type Props = {
  reward: ClaimRewardItem;
  onClaim: (id: string) => void;
  onRetry?: (id: string) => void;
};

export default function BuklodClaimRewardCard({
  reward,
  onClaim,
  onRetry,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const isClaimable = reward.status === 'claimable';
  const { scale, glow } = useClaimButtonGlow(
    isClaimable,
    reduceMotion
  );

  const styles = StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: withAlpha(theme.warning, 0.28),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(theme.warning, 0.12),
    },
    title: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    message: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 16,
      color: theme.textSecondary,
    },
    points: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '900',
      color: theme.warning,
    },
    buttonWrap: {
      marginTop: 14,
      alignSelf: 'flex-start',
    },
    glow: {
      position: 'absolute',
      left: -6,
      right: -6,
      top: -6,
      bottom: -6,
      borderRadius: 16,
      backgroundColor: theme.warning,
    },
    button: {
      minHeight: 42,
      paddingHorizontal: 22,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.buttonPrimary,
    },
    buttonClaimed: {
      backgroundColor: theme.surfaceMuted,
    },
    buttonFailed: {
      backgroundColor: theme.danger,
    },
    buttonText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: theme.white,
    },
    buttonTextMuted: {
      color: theme.textMuted,
    },
  });

  const buttonLabel =
    reward.status === 'claimed'
      ? 'CLAIMED'
      : reward.status === 'failed'
        ? 'RETRY'
        : reward.status === 'claiming'
          ? 'CLAIMING…'
          : 'CLAIM';

  const onPress = () => {
    if (reward.status === 'claimable') {
      onClaim(reward.id);
      return;
    }

    if (reward.status === 'failed' && onRetry) {
      onRetry(reward.id);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="gift-outline"
            size={22}
            color={theme.warning}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{reward.title}</Text>

          {!!reward.message && (
            <Text style={styles.message}>
              {reward.message}
            </Text>
          )}

          {Number(reward.points ?? 0) > 0 && (
            <Text style={styles.points}>
              +◉{' '}
              {Number(reward.points).toLocaleString(
                'en-PH'
              )}{' '}
              points
            </Text>
          )}
        </View>
      </View>

      <View style={styles.buttonWrap}>
        {isClaimable && (
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { opacity: glow }]}
          />
        )}

        <Animated.View
          style={{ transform: [{ scale: isClaimable ? scale : 1 }] }}
        >
          <Pressable
            disabled={
              reward.status === 'claiming' ||
              reward.status === 'claimed'
            }
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              reward.status === 'claimed' &&
                styles.buttonClaimed,
              reward.status === 'failed' &&
                styles.buttonFailed,
              pressed && { opacity: 0.86 },
            ]}
          >
            {reward.status === 'claiming' ? (
              <ActivityIndicator
                size="small"
                color={theme.white}
              />
            ) : (
              <>
                <Text
                  style={[
                    styles.buttonText,
                    reward.status === 'claimed' &&
                      styles.buttonTextMuted,
                  ]}
                >
                  {buttonLabel}
                </Text>
                {isClaimable && (
                  <MaterialCommunityIcons
                    name="star-four-points"
                    size={14}
                    color={theme.white}
                  />
                )}
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
