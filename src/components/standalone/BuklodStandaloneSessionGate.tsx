import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import type { BuklodStandaloneTarget } from '@/lib/buklodStandaloneEntry';
import { useAuth } from '@/providers/AuthProvider';

type Props = {
  target: BuklodStandaloneTarget;
  children: ReactNode;
};

const MAIN_WEB_URL =
  String(process.env.EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL ?? '').trim() ||
  'https://buklod.expo.app';

function cleanHandoffQuery() {
  if (Platform.OS !== 'web') return;
  try {
    const location = (globalThis as any)?.location;
    const history = (globalThis as any)?.history;
    if (!location?.href || typeof history?.replaceState !== 'function') return;

    const url = new URL(location.href);
    url.searchParams.delete('buklod_surface_token_hash');
    url.searchParams.delete('buklod_surface');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL cleanup must never block a valid session.
  }
}

export default function BuklodStandaloneSessionGate({
  target,
  children,
}: Props) {
  const { user, loading } = useAuth();
  const exchangeStartedRef = useRef(false);
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      loading ||
      user ||
      exchangeStartedRef.current
    ) {
      return;
    }

    let tokenHash = '';
    let requestedTarget = '';

    try {
      const location = (globalThis as any)?.location;
      const params = new URLSearchParams(String(location?.search ?? ''));
      tokenHash = String(params.get('buklod_surface_token_hash') ?? '').trim();
      requestedTarget = String(params.get('buklod_surface') ?? '').trim();
    } catch {
      tokenHash = '';
    }

    if (!tokenHash) {
      setError('Open this app from BUKLOD Main to create a secure session.');
      return;
    }

    if (requestedTarget && requestedTarget !== target) {
      cleanHandoffQuery();
      setError('This secure BUKLOD link is for a different standalone app.');
      return;
    }

    exchangeStartedRef.current = true;
    setExchangeBusy(true);
    setError('');

    void supabase.auth
      .verifyOtp({
        token_hash: tokenHash,
        type: 'email',
      })
      .then(({ error: verifyError }) => {
        cleanHandoffQuery();
        if (verifyError) throw verifyError;
      })
      .catch((verifyError: any) => {
        cleanHandoffQuery();
        exchangeStartedRef.current = false;
        setError(
          String(
            verifyError?.message ??
              'The secure BUKLOD handoff expired. Return to BUKLOD Main and open this app again.',
          ),
        );
      })
      .finally(() => {
        setExchangeBusy(false);
      });
  }, [loading, target, user]);

  if (loading || exchangeBusy) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator size="small" color="#177552" />
        <Text style={styles.copy}>Securing your BUKLOD session...</Text>
      </View>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={42}
          color="#177552"
        />
        <Text style={styles.title}>Open from BUKLOD Main</Text>
        <Text style={styles.copy}>
          This standalone app does not use a separate sign-in screen. Enter
          through its door in BUKLOD Main.
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to BUKLOD Main"
          onPress={() => void Linking.openURL(MAIN_WEB_URL)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>BUKLOD MAIN</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F2F6F3',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D7E5DB',
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#193A2A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  copy: {
    color: '#66796C',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  error: {
    color: '#A13A32',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  button: {
    minWidth: 148,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#177552',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
