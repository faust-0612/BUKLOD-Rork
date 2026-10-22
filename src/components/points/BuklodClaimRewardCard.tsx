import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import {
  useClaimButtonGlow,
} from '@/components/points/PointsMotion';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

const CLAIM_SUCCESS_SOUND = require('../../../assets/sounds/buklod-points-claim.wav');

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
  const claimSound = useAudioPlayer(CLAIM_SUCCESS_SOUND);
  const tapLockedRef = useRef(false);
  const [optimisticClaimed, setOptimisticClaimed] =
    useState(false);

  useEffect(() => {
    tapLockedRef.current = false;
    setOptimisticClaimed(false);
  }, [reward.id]);

  useEffect(() => {
    if (reward.status === 'claimed') {
      tapLockedRef.current = true;
      setOptimisticClaimed(true);
      return;
    }

    if (reward.status === 'failed') {
      tapLockedRef.current = false;
      setOptimisticClaimed(false);
    }
  }, [reward.status]);

  const effectiveStatus = optimisticClaimed
    ? 'claimed'
    : reward.status === 'claiming'
      ? 'claimed'
      : reward.status;

  const isClaimable = effectiveStatus === 'claimable';
  const { scale, glow } = useClaimButtonGlow(
    isClaimable,
    reduceMotion
  );

  const playClaimFeedback = () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    ).catch(() => undefined);

    try {
      void claimSound.seekTo(0).catch(() => undefined);
      claimSound.play();
    } catch {
      // Feedback must never block or fail the points claim.
    }
  };

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
    effectiveStatus === 'claimed'
      ? 'CLAIMED'
      : effectiveStatus === 'failed'
        ? 'RETRY'
        : 'CLAIM';

  const onPress = () => {
    if (
      effectiveStatus === 'claimable' &&
      !tapLockedRef.current
    ) {
      tapLockedRef.current = true;
      setOptimisticClaimed(true);
      playClaimFeedback();
      onClaim(reward.id);
      return;
    }

    if (
      effectiveStatus === 'failed' &&
      onRetry &&
      !tapLockedRef.current
    ) {
      tapLockedRef.current = true;
      setOptimisticClaimed(true);
      playClaimFeedback();
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
            disabled={effectiveStatus === 'claimed'}
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              effectiveStatus === 'claimed' &&
                styles.buttonClaimed,
              effectiveStatus === 'failed' &&
                styles.buttonFailed,
              pressed && { opacity: 0.86 },
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                effectiveStatus === 'claimed' &&
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

            {effectiveStatus === 'claimed' && (
              <MaterialCommunityIcons
                name="check-circle"
                size={15}
                color={theme.textMuted}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
