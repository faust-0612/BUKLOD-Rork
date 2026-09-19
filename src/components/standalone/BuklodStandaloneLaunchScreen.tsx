import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  openBuklodStandaloneFromMain,
  type BuklodStandaloneTarget,
} from '@/lib/buklodStandaloneEntry';

type Props = {
  target: BuklodStandaloneTarget;
  title: string;
};

export default function BuklodStandaloneLaunchScreen({
  target,
  title,
}: Props) {
  const startedRef = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  const open = useCallback(async () => {
    if (busy && startedRef.current) return;

    setBusy(true);
    setError('');
    startedRef.current = true;

    try {
      await openBuklodStandaloneFromMain({
        target,
        source:
          target === 'home'
            ? 'buklod-main-home-route'
            : 'buklod-main-kingdom-route',
      });
    } catch (launchError: any) {
      startedRef.current = false;
      setBusy(false);
      setError(
        String(
          launchError?.message ??
            `Could not open ${title}. Please try again.`,
        ),
      );
    }
  }, [busy, target, title]);

  useEffect(() => {
    if (startedRef.current) return;
    void open();
  }, [open]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <MaterialCommunityIcons
          name={target === 'home' ? 'home-heart' : 'castle'}
          size={42}
          color="#177552"
        />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>
          Opening the secure standalone web app from BUKLOD Main.
        </Text>

        {busy ? (
          <ActivityIndicator size="small" color="#177552" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry opening ${title}`}
            onPress={() => void open()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>RETRY</Text>
          </Pressable>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
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
    maxWidth: 430,
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
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  copy: {
    color: '#66796C',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  button: {
    minWidth: 120,
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
  error: {
    color: '#A13A32',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
