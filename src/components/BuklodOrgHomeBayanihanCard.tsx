import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function BuklodOrgHomeBayanihanCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>BUKLOD BAYANIHAN</Text>
      <Text style={styles.title}>Request assistance</Text>
      <Text style={styles.body}>
        Bayanihan is a separate ₱ ledger from BUKLOD Points. Open this portal
        for availability, instructions, benefits, policy, required documents,
        and your request status.
      </Text>
      <Pressable
        onPress={() => router.push('/bayanihan' as any)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>OPEN BAYANIHAN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#61766C',
  },
  title: { fontSize: 16, fontWeight: '900', color: '#173B2F' },
  body: { fontSize: 12, lineHeight: 18, color: '#5F6F67' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
