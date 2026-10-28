import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PremiumScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Paid Features</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Temporarily unavailable</Text>
        <Text style={styles.description}>
          Paid features, GCash subscriptions, and new payment requests are
          disabled pending final approval. BUKLOD Organization and
          Sub-organization creation remain free.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#0E4F20' },
  card: { padding: 18, gap: 8, borderRadius: 20, backgroundColor: '#FFFFFF' },
  heading: { fontSize: 18, fontWeight: '900', color: '#0E4F20' },
  description: { color: '#555555', lineHeight: 20 },
});
