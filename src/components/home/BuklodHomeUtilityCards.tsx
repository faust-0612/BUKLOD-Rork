import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Home retains family reading; household, Health, and Kingdom have their own established doors. */
export default function BuklodHomeUtilityCards() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open Children's Story World"
      onPress={() => router.push('/children-stories' as any)}
      style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}>
      <LinearGradient colors={['#203C75', '#567DB5', '#B18AB9']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.copy}>
          <Text allowFontScaling style={styles.kicker}>FAMILY READING</Text>
          <Text allowFontScaling style={styles.title}>Children's Story World</Text>
          <Text allowFontScaling style={styles.subtitle}>Filipino & English · Pakinggan at matuto</Text>
        </View>
        <MaterialCommunityIcons name="book-open-page-variant" size={32} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  launcher: { width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#7C9DD1' },
  gradient: { minHeight: 88, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  kicker: { fontSize: 12, color: '#E4F6FC', fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#F1F6FF' },
  pressed: { opacity: 0.78 },
});
