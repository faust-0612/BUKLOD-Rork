import React, { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type GateState = 'loading' | 'allowed' | 'denied' | 'error';

export function CanonicalReferenceGate({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          'buklod_canonical_has_permission_v1',
          { p_permission: 'canonical.reference.view' },
        );
        if (!alive) return;
        if (error) throw error;
        if (data === true) {
          setState('allowed');
          return;
        }
        setState('denied');
        setMessage(
          'This internal reference is available only to authorized BUKLOD staff.',
        );
      } catch (error: any) {
        if (!alive) return;
        setState('error');
        setMessage(
          String(
            error?.message ??
              'Canonical Reference access could not be verified.',
          ),
        );
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state === 'allowed') return <>{children}</>;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {state === 'loading' ? (
          <ActivityIndicator
            size="large"
            color={colors.green}
          />
        ) : (
          <MaterialCommunityIcons
            name={
              state === 'denied'
                ? 'shield-lock-outline'
                : 'cloud-alert-outline'
            }
            size={42}
            color={colors.greenDark}
          />
        )}

        <Text style={styles.title}>
          {state === 'loading'
            ? 'Checking access'
            : state === 'denied'
              ? 'Restricted internal reference'
              : 'Reference Center unavailable'}
        </Text>

        <Text style={styles.message}>
          {state === 'loading'
            ? 'Verifying Canonical Reference permissions…'
            : message}
        </Text>

        {state !== 'loading' && (
          <Pressable
            onPress={() => router.back()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>BACK</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    minWidth: 140,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: colors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
