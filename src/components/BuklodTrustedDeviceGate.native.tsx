import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { colors } from '@/lib/theme';
import { markBuklodStartupChromeReady } from '@/lib/buklodStartupChrome';
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
 * account as trusted. The next cold app open with that persisted session
 * requires local device authentication before BUKLOD content mounts.
 */

const TRUSTED_DEVICE_KEY_PREFIX = 'buklod.auth.trusted_device.v1.';

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
  // BUKLOD_STARTUP_SESSION_PASS_THROUGH_R1
  // A persisted Supabase session is sufficient for ordinary app reopening.
  // Biometric confirmation remains available to sensitive features (e.g. SOS)
  // but must not be mandatory at each cold launch.
  useEffect(() => {
    markBuklodStartupChromeReady();
  }, []);

  return <>{children}</>;
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
