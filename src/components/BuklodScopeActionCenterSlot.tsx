import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type ActionItem = {
  id: string;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'warning' | 'critical';
  onPress?: () => void;
};

type Props = {
  title?: string;
  items: ActionItem[];
  emptyLabel?: string;
};

/**
 * Reusable slot for future NEEDS ACTION / ACTION CENTER items.
 * Phase 1: only renders when real items are supplied.
 */
export default function BuklodScopeActionCenterSlot({
  title = 'NEEDS ACTION',
  items,
  emptyLabel,
}: Props) {
  if (!items.length) {
    if (!emptyLabel) return null;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color={
              item.tone === 'critical'
                ? '#B42318'
                : item.tone === 'warning'
                  ? '#B45309'
                  : colors.greenDark
            }
          />
          <View style={styles.copy}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  title: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  empty: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '700',
  },
  itemSubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
