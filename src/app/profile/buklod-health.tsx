import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  BUKLOD_HEALTH_CENTER_URL,
  launchBuklodHealthCenter,
} from '@/lib/buklodHealthCenterLauncher';

export default function BuklodHealthPortal() {
  const openingRef = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  const openHealthCenter = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(false);
    try {
      await launchBuklodHealthCenter(url => Linking.openURL(url));
    } catch {
      setError(true);
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Health Center' }} />
      <BuklodPortalScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="heart-pulse" size={34} color="#126946" />
          </View>
          <Text style={styles.eyebrow}>BUKLOD HEALTH CENTER</Text>
          <Text style={styles.title}>Your health, organized.</Text>
          <Text style={styles.description}>
            Open the existing Health Center to manage medicines, vitals, appointments,
            family care, and personal medical records.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD Health Center"
          accessibilityState={{ disabled: opening, busy: opening }}
          onPress={() => void openHealthCenter()}
          disabled={opening}
          style={({ pressed }) => [styles.launchButton, pressed && styles.pressed]}
        >
          {opening ? <ActivityIndicator color="#FFFFFF" /> : (
            <MaterialCommunityIcons name="open-in-new" size={22} color="#FFFFFF" />
          )}
          <Text style={styles.launchLabel}>
            {opening ? 'Opening Health Center…' : 'Open Health Center'}
          </Text>
        </Pressable>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Could not open the browser. Check your connection and use the website address below.
          </Text>
        ) : null}

        <Text selectable style={styles.url}>{BUKLOD_HEALTH_CENTER_URL}</Text>
        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#126946" />
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>Private by design</Text>
            <Text style={styles.noticeText}>
              Health Center runs separately from BUKLOD Main. Opening it does not send
              your BUKLOD session tokens or medical information in the link. Follow
              the Health Center’s own access and privacy controls.
            </Text>
          </View>
        </View>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6FAF7' },
  content: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 24, gap: 15 },
  hero: { gap: 10 },
  iconCircle: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#E6F3EA', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 13, fontWeight: '800', color: '#126946', letterSpacing: 0.5 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', color: '#193729' },
  description: { fontSize: 16, lineHeight: 23, color: '#375444' },
  launchButton: { borderRadius: 12, backgroundColor: '#126946', paddingVertical: 16, paddingHorizontal: 14, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pressed: { opacity: 0.78 },
  launchLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  error: { fontSize: 15, lineHeight: 21, color: '#B42318' },
  url: { color: '#245C46', fontSize: 13, lineHeight: 20, textDecorationLine: 'underline' },
  notice: { borderRadius: 12, backgroundColor: '#EAF4ED', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeBody: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '800', color: '#214B33' },
  noticeText: { fontSize: 14, lineHeight: 21, color: '#355746' },
});
