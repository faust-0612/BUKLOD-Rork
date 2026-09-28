import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const MAIN_WEB_URL =
  String(process.env.EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL ?? '').trim() ||
  'https://buklod.expo.app';

export default function BuklodMainRouteBridge({
  path,
  title = 'BUKLOD Main',
}: {
  path: string;
  title?: string;
}) {
  const startedRef = useRef(false);
  const url = useMemo(
    () => `${MAIN_WEB_URL.replace(/\/$/, '')}/${String(path ?? '').replace(/^\//, '')}`,
    [path],
  );

  const open = () => {
    if (Platform.OS === 'web') {
      const location = (globalThis as any)?.location;
      if (typeof location?.assign === 'function') {
        try {
          location.assign(url);
          return;
        } catch {
          // Fall through to Linking.
        }
      }
    }
    void Linking.openURL(url);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    open();
  }, [url]);

  return (
    <View style={styles.screen}>
      <MaterialCommunityIcons name="open-in-new" size={36} color="#177552" />
      <Text style={styles.title}>Opening {title}</Text>
      <Text style={styles.copy}>
        This destination belongs to BUKLOD Main.
      </Text>
      <Pressable onPress={open} style={styles.button}>
        <Text style={styles.buttonText}>OPEN BUKLOD MAIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: '#F2F6F3',
  },
  title: {
    color: '#193A2A',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  copy: {
    color: '#66796C',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    marginTop: 4,
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
