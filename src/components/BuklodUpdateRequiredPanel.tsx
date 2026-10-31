import React, { useState } from 'react';
import { Alert, ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

// Android package is fixed by the approved native APK; no private token/URL.
const PACKAGE_NAME = 'org.mzbministry.buklod';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;
const WEB_FALLBACK_URL = 'https://buklod.expo.app';

async function openApprovedUpdateDestination() {
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(`market://details?id=${PACKAGE_NAME}`);
      return;
    } catch {
      // No Play Store handler on sideloaded devices; use browser destination.
    }
  }
  try {
    await Linking.openURL(PLAY_STORE_URL);
  } catch {
    await Linking.openURL(WEB_FALLBACK_URL);
  }
}

export default function BuklodUpdateRequiredPanel() {
  const { config, refresh } = useRuntimeConfig();
  const [checking, setChecking] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>BUKLOD · IMPORTANT UPDATE</Text>
        <Text style={styles.title}>Kailangang i-update ang BUKLOD</Text>
        <Text style={styles.description}>
          {config?.update_message ||
            'Hindi na suportado ang bersyon ng app na ito. I-install ang kasalukuyang approved BUKLOD upang magpatuloy.'}
        </Text>
        <Text style={styles.version}>
          Minimum na bersyon: {config?.minimum_supported_version || '—'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void openApprovedUpdateDestination().catch(() => {
              Alert.alert('BUKLOD', 'Hindi mabuksan ang Play Store. Gamitin muna ang web version ng BUKLOD.');
            });
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>I-UPDATE ANG APP</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={checking}
          onPress={() => {
            setChecking(true);
            void refresh()
              .then(() => router.replace('/'))
              .catch(() => Alert.alert('BUKLOD', 'Hindi ma-check ang update. Suriin ang koneksyon.'))
              .finally(() => setChecking(false));
          }}
          style={styles.secondary}
        >
          {checking ? <ActivityIndicator color="#176A3F" /> :
            <Text style={styles.secondaryText}>NA-UPDATE KO NA · SURIIN ULIT</Text>}
        </Pressable>
        <Text style={styles.note}>
          Kung wala pang Android update para sa device mo, maaari mong gamitin ang BUKLOD web pansamantala.
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(WEB_FALLBACK_URL).catch(() => {
              Alert.alert('BUKLOD', 'Buksan sa browser ang buklod.expo.app.');
            });
          }}
          style={styles.web}
        >
          <Text style={styles.webText}>BUKLOD WEB VERSION</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F7F2', justifyContent: 'center', padding: 20 },
  card: { padding: 22, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#D4E8D8' },
  eyebrow: { color: '#1C7846', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#153D29', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  description: { color: '#344C3B', fontSize: 14, lineHeight: 22, marginTop: 14 },
  version: { color: '#5E7065', fontSize: 12, marginTop: 10 },
  primary: { marginTop: 22, minHeight: 48, backgroundColor: '#16693F', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  secondary: { marginTop: 10, minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: '#B8D6C3', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#16693F', fontSize: 12, fontWeight: '900' },
  note: { color: '#6C7C72', fontSize: 11, lineHeight: 17, marginTop: 18 },
  web: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  webText: { color: '#16693F', fontSize: 12, textDecorationLine: 'underline', fontWeight: '800' },
});
