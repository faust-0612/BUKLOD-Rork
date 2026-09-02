import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function BuklodMemberEntitlementNotice({
  message,
  adminHint = 'Your Cluster administrator manages access.',
}: {
  message: string;
  adminHint?: string;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>{adminHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: '#E1E7E3',
    backgroundColor: '#F7FAF8',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  message: { fontSize: 12, fontWeight: '800', color: '#173B2F', lineHeight: 17 },
  hint: { fontSize: 11, color: '#6E7E76', lineHeight: 16 },
});
