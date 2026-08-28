import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNetwork } from '@/providers/NetworkProvider';

export function OfflineBanner() {
  const { status, pendingCount } = useNetwork();

  if (status === 'unknown' || (status === 'online' && pendingCount === 0)) {
    return null;
  }

  const text =
    status === 'offline'
      ? pendingCount > 0
        ? `Offline • ${pendingCount} pending • saved data remains available`
        : 'Offline • saved data remains available'
      : status === 'syncing'
        ? `Syncing • ${pendingCount} pending`
        : `${pendingCount} pending • waiting to sync`;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[
        styles.banner,
        status === 'offline' ? styles.offline : styles.syncing,
      ]}
    >
      <Text numberOfLines={1} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

export default OfflineBanner;

const styles = StyleSheet.create({
  banner: {
    minHeight: 26,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offline: {
    backgroundColor: '#6b4f1d',
  },
  syncing: {
    backgroundColor: '#315b43',
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});