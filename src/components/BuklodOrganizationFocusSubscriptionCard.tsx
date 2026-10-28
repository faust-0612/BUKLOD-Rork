import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Compatibility component for existing Organization routes.
 * The old subscription purchase flow is paused until final approval.
 */
export default function BuklodOrganizationFocusSubscriptionCard({
  organizationName = 'this Organization',
}: {
  organizationId: string;
  organizationName?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>BUKLOD FOCUS APPS</Text>
      <Text style={styles.title}>Available without a subscription</Text>
      <Text style={styles.subtitle}>
        Focus App access for {organizationName} depends on active membership
        and assigned workspace roles. Organization and Sub-organization
        creation remain free. Paid plans and payment requests are paused
        pending final approval.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#61766C' },
  title: { fontSize: 16, fontWeight: '900', color: '#173B2F' },
  subtitle: { fontSize: 11, lineHeight: 16, color: '#697A71' },
});
