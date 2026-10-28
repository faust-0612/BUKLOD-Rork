import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePaidFeature } from '@/hooks/usePaidFeature';
import { BUKLOD_PAID_FEATURES_ENABLED } from '@/lib/buklodCommercialCatalog';

export function PaidFeatureGate({
  featureCode,
  children,
}: {
  featureCode: string;
  children: React.ReactNode;
}) {
  const { loading, hasAccess } = usePaidFeature(featureCode);

  // Final commercial approval is pending. Historical entitlements stay stored.
  if (!BUKLOD_PAID_FEATURES_ENABLED) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Paid feature temporarily unavailable</Text>
        <Text>Paid features are paused pending final approval.</Text>
      </View>
    );
  }
  if (loading) return <View style={styles.box}><ActivityIndicator /></View>;
  if (hasAccess) return <>{children}</>;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Premium feature</Text>
      <Text>This feature requires an active entitlement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    margin: 16,
    padding: 20,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
});
