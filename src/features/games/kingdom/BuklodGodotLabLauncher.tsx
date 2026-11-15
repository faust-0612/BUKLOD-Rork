import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visible only in the THIRD Android app identity, never existing staging/prod. */
export default function BuklodGodotLabLauncher() {
  const { top } = useSafeAreaInsets();
  const [opening, setOpening] = useState(false);
  if (Platform.OS !== 'android' ||
    process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB !== '1') return null;

  const enterGodot = async () => {
    if (opening) return;
    setOpening(true);
    try {
      // Resolve native bridge only after explicit tap in the lab APK.
      const { requireNativeModule } = require('expo-modules-core');
      const lab = requireNativeModule('BuklodLabNative');
      await lab.openGodotWorld();
    } catch {
      Alert.alert('Kingdom 3D Lab', '3D engine is not available in this build.');
    } finally {
      setOpening(false);
    }
  };

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open experimental 3D Kingdom world"
    disabled={opening}
    onPress={() => void enterGodot()}
    style={[styles.launch, { top: top + 64 }]}
  >
    <Text style={styles.text}>{opening ? 'OPENING…' : '3D WORLD LAB'}</Text>
    <Text style={styles.caption}>LOCAL · EXPERIMENTAL</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  launch: {
    position: 'absolute', right: 14, zIndex: 11,
    borderRadius: 12, backgroundColor: '#164a47',
    borderColor: '#d3eeac', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  text: { fontSize: 11, fontWeight: '900', color: '#f6ffdb', letterSpacing: .6 },
  caption: { fontSize: 8, fontWeight: '700', color: '#c2d9c7', marginTop: 2 },
});
