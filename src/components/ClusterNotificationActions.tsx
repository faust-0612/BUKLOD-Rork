import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clusterJoinNotificationAction } from '@/lib/clusterJoinNotification';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

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
  const { theme } = useBuklodTheme();
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
        style={[styles.approve, { backgroundColor: theme.buttonPrimary }, busy && styles.disabled]}
      >
        <Text style={[styles.approveText, { color: theme.onAccent }]}>
          {busy ? 'WORKING...' : action.approveLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.declineLabel}
        disabled={busy}
        onPress={() => onAction(false)}
        style={[styles.decline, { borderColor: theme.accent, backgroundColor: theme.surface }, busy && styles.disabled]}
      >
        <Text style={[styles.declineText, { color: theme.textPrimary }]}>{action.declineLabel}</Text>
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
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  approveText: {
    fontSize: 11,
    fontWeight: '900',
  },
  declineText: {
    fontSize: 11,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
});
