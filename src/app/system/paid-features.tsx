import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PaidFeatureAdmin() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Paid Feature Manager</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>New plans are paused</Text>
        <Text style={styles.description}>
          Paid feature creation and activation are disabled until final
          approval. Existing payment history and entitlement records
          are preserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 25, fontWeight: '900', color: '#0E4F20' },
  card: { padding: 16, gap: 10, borderRadius: 18, backgroundColor: '#FFFFFF' },
  heading: { fontWeight: '900', color: '#0E4F20' },
  description: { lineHeight: 20, color: '#555555' },
});
