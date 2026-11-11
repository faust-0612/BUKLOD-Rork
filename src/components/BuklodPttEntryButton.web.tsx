/* BUKLOD_PTT_WEB_LIVE_R1: display the existing PTT door in BUKLOD Web. */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  getBuklodPttRuntimeState,
  subscribeBuklodPttRuntime,
} from '@/ptt/buklodPttRuntime';

export default function BuklodPttEntryButton() {
  const router = useRouter();
  const [live, setLive] = useState(
    () => Boolean(getBuklodPttRuntimeState().connection),
  );

  useEffect(
    () =>
      subscribeBuklodPttRuntime((next) => {
        setLive(Boolean(next.connection));
      }),
    [],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open BUKLOD Push-to-Talk"
      onPress={() => router.push('/personal-home/ptt' as any)}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={require('../../assets/ptt/buklod-ptt.png')}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>LIVE COMMUNICATION</Text>
        <Text style={styles.title}>BUKLOD PTT</Text>
        <Text style={styles.subtitle}>
          Push-to-Talk · CH01–CH10 · Organization / Cluster
        </Text>
      </View>
      <View style={[styles.liveDot, !live && styles.liveDotOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginTop: 10,
    marginBottom: 8,
    minHeight: 78,
    borderRadius: 4,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071725',
    borderWidth: 1,
    borderColor: '#173D4E',
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  icon: { width: 58, height: 58, borderRadius: 14 },
  copy: { flex: 1, paddingHorizontal: 11 },
  eyebrow: {
    color: '#5EE7E7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#AFC1CB',
    fontSize: 11,
    marginTop: 3,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#25D366',
    marginRight: 5,
  },
  liveDotOff: { backgroundColor: '#6B7680' },
});
