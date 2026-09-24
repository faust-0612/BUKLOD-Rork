import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNetwork } from '@/providers/NetworkProvider';
import { trackBuklodFeedbackEvent } from '@/lib/buklodUserFeedback';

export function OfflineBanner() {
  const { status, pendingCount, online } = useNetwork();
  const previousOnlineRef = useRef<boolean | null>(null);
  const [restoredVisible, setRestoredVisible] = useState(false);

  useEffect(() => {
    const previous = previousOnlineRef.current;
    previousOnlineRef.current = online;

    if (previous === true && !online) {
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: 'NETWORK_ERROR',
        supportCode: 'NET-100',
        feature: 'Network',
        outcome: 'offline',
      });
    }

    if (previous === false && online) {
      setRestoredVisible(true);
      void trackBuklodFeedbackEvent({
        event: 'self_heal_success',
        category: 'NETWORK_ERROR',
        supportCode: 'NET-100',
        feature: 'Network',
        outcome: 'connection_restored',
      });

      const timer = setTimeout(() => {
        setRestoredVisible(false);
      }, 3200);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [online]);

  if (status === 'unknown') {
    return null;
  }

  if (restoredVisible) {
    return (
      <View
        pointerEvents="none"
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Connection restored."
        style={[styles.banner, styles.restored]}
      >
        <Text numberOfLines={2} style={styles.text}>
          Connection restored.
          {pendingCount > 0
            ? ` Syncing ${pendingCount} pending item${pendingCount === 1 ? '' : 's'}…`
            : ''}
        </Text>
      </View>
    );
  }

  if (status === 'online' && pendingCount === 0) {
    return null;
  }

  const text =
    status === 'offline'
      ? pendingCount > 0
        ? `You appear to be offline. ${pendingCount} pending item${pendingCount === 1 ? '' : 's'} will sync when your connection returns. Saved data remains available.`
        : 'You appear to be offline. Saved data remains available.'
      : status === 'syncing'
        ? `Connection restored. Syncing ${pendingCount} pending item${pendingCount === 1 ? '' : 's'}…`
        : `${pendingCount} pending item${pendingCount === 1 ? '' : 's'} waiting to sync.`;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={[
        styles.banner,
        status === 'offline' ? styles.offline : styles.syncing,
      ]}
    >
      <Text numberOfLines={2} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

export default OfflineBanner;

const styles = StyleSheet.create({
  banner: {
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offline: {
    backgroundColor: '#6b4f1d',
  },
  syncing: {
    backgroundColor: '#315b43',
  },
  restored: {
    backgroundColor: '#245E3D',
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
