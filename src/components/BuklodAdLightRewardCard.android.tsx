import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  withAlpha,
} from '@/lib/buklodContrast';

import {
  activateBuklodAdLightPass,
  BUKLOD_AD_LIGHT_PASS_DURATION_MS,
  getBuklodAdLightPassStatus,
  type BuklodAdLightPassStatus,
} from '@/lib/buklodAdLightPass';

import {
  showBuklodRewardedAd,
  warmBuklodRewardedAd,
} from '@/lib/buklodRewardedAds';

const PASS_MINUTES = Math.round(
  BUKLOD_AD_LIGHT_PASS_DURATION_MS / 60_000,
);

function remainingLabel(status: BuklodAdLightPassStatus) {
  if (!status.active) return null;

  const minutes = Math.max(
    1,
    Math.ceil(status.remainingMs / 60_000),
  );

  return `${minutes} min remaining`;
}

export default function BuklodAdLightRewardCard() {
  const { theme } = useBuklodPresentation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BuklodAdLightPassStatus>({
    active: false,
    expiresAt: null,
    remainingMs: 0,
  });

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getBuklodAdLightPassStatus());
    } catch (error) {
      console.warn('BUKLOD Ad-Light status:', error);
    }
  }, []);

  useEffect(() => {
    warmBuklodRewardedAd();
    void refreshStatus();

    const timer = setInterval(() => {
      void refreshStatus();
    }, 30_000);

    return () => clearInterval(timer);
  }, [refreshStatus]);

  const styles = useMemo(
    () => StyleSheet.create({
      shell: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
      },
      card: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: withAlpha(theme.accent, 0.24),
        backgroundColor: withAlpha(theme.accentSoft, 0.64),
        padding: 12,
      },
      topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      },
      icon: {
        width: 34,
        height: 34,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(theme.accent, 0.12),
      },
      titleWrap: {
        flex: 1,
        minWidth: 0,
      },
      eyebrow: {
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.75,
        color: theme.textMuted,
      },
      title: {
        marginTop: 2,
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '900',
        color: theme.textPrimary,
      },
      copy: {
        marginTop: 8,
        fontSize: 10.5,
        lineHeight: 15,
        color: theme.textSecondary,
      },
      button: {
        minHeight: 40,
        marginTop: 10,
        borderRadius: 12,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: theme.accent,
      },
      buttonActive: {
        backgroundColor: withAlpha(theme.accent, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(theme.accent, 0.24),
      },
      buttonText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
      },
      buttonTextActive: {
        color: theme.accent,
      },
      note: {
        marginTop: 7,
        fontSize: 9,
        lineHeight: 13,
        color: theme.textMuted,
      },
    }),
    [theme],
  );

  const activeLabel = remainingLabel(status);

  const handleWatch = useCallback(async () => {
    if (busy || status.active) return;

    setBusy(true);

    try {
      const result = await showBuklodRewardedAd();

      if (!result.shown) {
        Alert.alert(
          'Ad is preparing',
          'The rewarded ad is not ready yet. Please try again in a moment.',
        );
        warmBuklodRewardedAd();
        return;
      }

      if (!result.earned) {
        Alert.alert(
          'Ad-Light Pass',
          'Finish the rewarded ad to activate the Ad-Light Pass.',
        );
        return;
      }

      await activateBuklodAdLightPass();
      await refreshStatus();

      Alert.alert(
        'Ad-Light Pass active',
        `Full-screen interstitials are reduced for ${PASS_MINUTES} minutes. Community Wall sponsored feed ads stay active.`,
      );
    } catch (error) {
      console.warn('BUKLOD Ad-Light reward:', error);
      Alert.alert(
        'Ad-Light Pass',
        'Could not start the rewarded ad right now. Please try again later.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, refreshStatus, status.active]);

  return (
    <View style={styles.shell}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="play-box-multiple-outline"
              size={19}
              color={theme.accent}
            />
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>
              OPTIONAL REWARDED AD
            </Text>
            <Text style={styles.title}>
              {status.active
                ? 'Ad-Light Pass is active'
                : `Watch 1 ad for ${PASS_MINUTES}-min Ad-Light`}
            </Text>
          </View>
        </View>

        <Text style={styles.copy}>
          Reward: temporarily suppresses full-screen interstitial ads only.
          It does not add Circle Points, Bayanihan value, cash, or revenue-share credit.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            status.active
              ? `Ad-Light Pass active, ${activeLabel ?? ''}`
              : 'Watch rewarded ad for Ad-Light Pass'
          }
          disabled={busy || status.active}
          onPress={handleWatch}
          style={({ pressed }) => [
            styles.button,
            status.active && styles.buttonActive,
            pressed && !status.active && { opacity: 0.86 },
          ]}
        >
          <MaterialCommunityIcons
            name={status.active ? 'shield-check-outline' : 'play-circle-outline'}
            size={17}
            color={status.active ? theme.accent : '#FFFFFF'}
          />
          <Text
            style={[
              styles.buttonText,
              status.active && styles.buttonTextActive,
            ]}
          >
            {status.active
              ? activeLabel ?? 'Active'
              : busy
                ? 'Preparing ad…'
                : 'Watch Ad for Ad-Light Pass'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          Feed/native ads in Community Wall remain unchanged.
          Passes do not stack; another rewarded ad becomes available after expiry.
        </Text>
      </View>
    </View>
  );
}
