import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clusterJoinNotificationAction } from '@/lib/clusterJoinNotification';

export default function ClusterNotificationActions({
  kind,
  data,
  busy,
  onAction,
}: {
  kind: string;
  data: Record<string, unknown> | null | undefined;
  busy?: boolean;
  onAction: (approve: boolean) => void;
}) {
  const action = clusterJoinNotificationAction(kind, data);

  if (!action) {
    return null;
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.approveLabel}
        disabled={busy}
        onPress={() => onAction(true)}
        style={[styles.approve, busy && styles.disabled]}
      >
        <Text style={styles.approveText}>
          {busy ? 'WORKING...' : action.approveLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.declineLabel}
        disabled={busy}
        onPress={() => onAction(false)}
        style={[styles.decline, busy && styles.disabled]}
      >
        <Text style={styles.declineText}>{action.declineLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  approve: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  decline: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D6A4F',
    backgroundColor: '#FFFFFF',
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  declineText: {
    color: '#2D6A4F',
    fontSize: 11,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
});
