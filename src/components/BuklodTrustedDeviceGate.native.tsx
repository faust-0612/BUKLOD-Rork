import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

/*
 * BUKLOD_AUTH_EMAIL_LOCAL_DEVICE_R1
 *
 * Scope:
 * - Keep Supabase session persistence as the primary normal-login behavior.
 * - Email OTP remains the recovery / ownership verification path.
 * - On supported native devices, protect an already-persisted session with
 *   the OS local-auth prompt (Face ID / fingerprint with device fallback).
 * - No SMS, phone OTP, or Twilio dependency is used here.
 *
 * Enrollment is device-local and intentionally does not store a password.
 * The first successful signed-in session on a capable device marks that
 * account as trusted. Future cold starts, and resumes after a meaningful
 * background interval, require local device authentication before BUKLOD
 * content mounts.
 */

const TRUSTED_DEVICE_KEY_PREFIX = 'buklod.auth.trusted_device.v1.';
const RELOCK_AFTER_BACKGROUND_MS = 60_000;

type GateState = 'checking' | 'open' | 'unlocking' | 'locked';

function trustedDeviceKey(userId: string) {
  return `${TRUSTED_DEVICE_KEY_PREFIX}${userId}`;
}

async function localAuthenticationAvailable() {
  try {
    const secureStoreAvailable = await SecureStore.isAvailableAsync();
    if (!secureStoreAvailable) return false;

    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

async function readTrustedDevice(userId: string) {
  try {
    return (
      (await SecureStore.getItemAsync(trustedDeviceKey(userId))) === '1'
    );
  } catch {
    return false;
  }
}

async function writeTrustedDevice(userId: string) {
  try {
    if (!(await localAuthenticationAvailable())) return false;
    await SecureStore.setItemAsync(trustedDeviceKey(userId), '1');
    return true;
  } catch {
    return false;
  }
}

async function clearTrustedDevice(userId: string) {
  try {
    await SecureStore.deleteItemAsync(trustedDeviceKey(userId));
  } catch {
    // Best effort only. A stale marker must never block password sign-in.
  }
}

export default function BuklodTrustedDeviceGate({
  children,
}: {
  children: ReactNode;
}) {
  const {
    session,
    loading: authLoading,
    signOut,
  } = useAuth();

  const userId = session?.user?.id ?? null;
  const [gateState, setGateState] = useState<GateState>('checking');

  const bootDecisionMadeRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const unlockInFlightRef = useRef(false);
  const backgroundAtRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const unlock = useCallback(async (targetUserId: string) => {
    if (unlockInFlightRef.current) return;

    unlockInFlightRef.current = true;
    setGateState('unlocking');

    try {
      const stillTrusted = await readTrustedDevice(targetUserId);
      if (!stillTrusted) {
        setGateState('open');
        return;
      }

      if (!(await localAuthenticationAvailable())) {
        await clearTrustedDevice(targetUserId);
        setGateState('open');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock BUKLOD',
        promptSubtitle: 'Confirm that this is your trusted device.',
        promptDescription:
          'Use your fingerprint, face, or device authentication to continue.',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use device PIN',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (result.success) {
        setGateState('open');
        return;
      }

      if (
        result.error === 'not_available' ||
        result.error === 'not_enrolled' ||
        result.error === 'passcode_not_set'
      ) {
        await clearTrustedDevice(targetUserId);
        setGateState('open');
        return;
      }

      setGateState('locked');
    } catch (error) {
      console.warn(
        'BUKLOD trusted-device unlock:',
        String((error as any)?.message ?? error ?? 'Local authentication failed.')
      );
      setGateState('locked');
    } finally {
      unlockInFlightRef.current = false;
    }
  }, []);

  const enrollWithoutInterruptingFreshLogin = useCallback(
    async (targetUserId: string) => {
      const alreadyTrusted = await readTrustedDevice(targetUserId);
      if (alreadyTrusted) return;
      await writeTrustedDevice(targetUserId);
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;

    if (!bootDecisionMadeRef.current) {
      bootDecisionMadeRef.current = true;
      activeUserIdRef.current = userId;

      if (!userId) {
        setGateState('open');
        return;
      }

      let cancelled = false;

      void (async () => {
        const trusted = await readTrustedDevice(userId);
        if (cancelled) return;

        if (trusted) {
          await unlock(userId);
          return;
        }

        setGateState('open');
        void enrollWithoutInterruptingFreshLogin(userId);
      })();

      return () => {
        cancelled = true;
      };
    }

    if (!userId) {
      activeUserIdRef.current = null;
      setGateState('open');
      return;
    }

    if (activeUserIdRef.current === userId) {
      return;
    }

    /*
     * A user appearing after bootstrap is a fresh interactive sign-in.
     * Password/email ownership was just proven, so do not immediately
     * interrupt that login with a second local-auth prompt. Enroll the
     * device for the NEXT app open/resume instead.
     */
    activeUserIdRef.current = userId;
    setGateState('open');
    void enrollWithoutInterruptingFreshLogin(userId);
  }, [
    authLoading,
    enrollWithoutInterruptingFreshLogin,
    unlock,
    userId,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundAtRef.current == null) {
          backgroundAtRef.current = Date.now();
        }
        return;
      }

      if (
        nextState === 'active' &&
        (previousState === 'background' || previousState === 'inactive')
      ) {
        const backgroundAt = backgroundAtRef.current;
        backgroundAtRef.current = null;

        if (!userId || backgroundAt == null) return;
        if (Date.now() - backgroundAt < RELOCK_AFTER_BACKGROUND_MS) return;

        void (async () => {
          if (await readTrustedDevice(userId)) {
            await unlock(userId);
          }
        })();
      }
    });

    return () => subscription.remove();
  }, [unlock, userId]);

  const usePasswordInstead = useCallback(async () => {
    if (userId) {
      await clearTrustedDevice(userId);
    }

    setGateState('open');
    await signOut();
  }, [signOut, userId]);

  if (!userId || gateState === 'open') {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>BUKLOD</Text>
      </View>

      <Text style={styles.title}>Trusted device locked</Text>
      <Text style={styles.body}>
        Confirm with your fingerprint, Face ID, or device authentication to
        continue your signed-in BUKLOD session.
      </Text>

      {gateState === 'checking' || gateState === 'unlocking' ? (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.progressText}>Checking this device…</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (userId) void unlock(userId);
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>UNLOCK BUKLOD</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={gateState === 'unlocking'}
        onPress={() => void usePasswordInstead()}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>SIGN IN WITH PASSWORD</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 28,
  },
  badge: {
    minWidth: 86,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.green,
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 22,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    maxWidth: 440,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  progressRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressText: {
    color: colors.muted,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 28,
    minWidth: 230,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '900',
  },
  secondaryButton: {
    marginTop: 12,
    minWidth: 230,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.green,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
