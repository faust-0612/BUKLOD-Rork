import React from 'react';
import { Slot, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

/**
 * BUKLOD Kingdom R1 — authentication door.
 * All /games routes inherit this boundary, including direct deep links.
 * This is a client-side route guard; server-backed saves/native handoff
 * additionally require server-side user validation and RLS.
 * Organization membership, Points and Circle Rank are not game access gates.
 */
export default function KingdomAuthenticatedLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.shell}>
        <ActivityIndicator color="#e0c183" />
        <Text style={styles.caption}>Opening your BUKLOD Kingdom...</Text>
      </View>
    );
  }
  if (!user) {
    return (
      <View style={styles.shell}>
        <Text style={styles.title}>BUKLOD KINGDOM</Text>
        <Text style={styles.caption}>Sign in to BUKLOD Main to play and keep your Kingdom profile private.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/' as any)} style={styles.button}>
          <Text style={styles.buttonText}>GO TO BUKLOD LOGIN</Text>
        </Pressable>
      </View>
    );
  }
  return <Slot />;
}
const styles = StyleSheet.create({
  shell: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#081a28' },
  title: { color: '#f3d48f', fontWeight: '900', fontSize: 26, textAlign: 'center' },
  caption: { color: '#e8e1d1', fontSize: 15, marginTop: 16, maxWidth: 380, textAlign: 'center', lineHeight: 22 },
  button: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, marginTop: 26, backgroundColor: '#ae7c32' },
  buttonText: { color: '#fff', fontWeight: '900' },
});
