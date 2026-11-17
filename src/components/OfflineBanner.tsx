import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useBuklodOfflineSync } from '@/providers/BuklodOfflineSyncProvider';
import { useNetwork } from '@/providers/NetworkProvider';

/**
 * A global banner is a connectivity warning, not a background work indicator.
 * Normal queue replays remain silent; per-feature pending status stays available.
 */
export function OfflineBanner() {
  const { status, pendingCount: queuePendingCount } = useNetwork();
  const { pendingCount: featurePendingCount } = useBuklodOfflineSync();

  if (status !== 'offline' && status !== 'degraded') {
    return null;
  }

  const pendingCount = queuePendingCount + featurePendingCount;
  const text = status === 'offline'
    ? pendingCount > 0
      ? `Offline • ${pendingCount} pending • saved data remains available`
      : 'Offline • saved data remains available'
    : pendingCount > 0
      ? `Limited connection • ${pendingCount} pending • using saved data`
      : 'Limited connection • using saved data';

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[
        styles.banner,
        status === 'offline' ? styles.offline : styles.degraded,
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
  degraded: {
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
