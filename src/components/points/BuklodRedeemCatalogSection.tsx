import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  loadRedeemCatalog,
  redeemCatalogItem,
  type BuklodRedeemCatalogItem,
} from '@/lib/buklodRewards';
import { withAlpha } from '@/lib/buklodContrast';

type Props = {
  availablePoints: number;
  onRedeemed?: (availablePoints: number) => void;
};

export default function BuklodRedeemCatalogSection({
  availablePoints,
  onRedeemed,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [items, setItems] = useState<BuklodRedeemCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadRedeemCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRedeem = (item: BuklodRedeemCatalogItem) => {
    if (availablePoints < item.cost_points) {
      Alert.alert(
        'Not enough points',
        `You need ${item.cost_points} available points. Lifetime points are not spendable.`,
      );
      return;
    }

    Alert.alert(
      'Redeem Reward',
      `Spend ${item.cost_points} available points for "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setBusyId(item.id);
            try {
              const result = await redeemCatalogItem(item.id);
              onRedeemed?.(result.available_points);
              Alert.alert(
                'Redeemed',
                `"${result.title}" redeemed. ${result.redeemed_points} points spent.`,
              );
            } catch (error: unknown) {
              Alert.alert(
                'Redeem failed',
                error instanceof Error
                  ? error.message
                  : 'Could not redeem this reward.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const styles = StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: withAlpha(theme.border, 0.6),
    },
    title: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    sub: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
    },
    cost: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.warning,
    },
    redeemBtn: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    redeemText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#fff',
    },
  });

  // The redeem surface stays completely hidden until the backend exposes
  // a real active catalog item with an end-to-end entitlement/fulfillment.
  // Loading the catalog never blocks the Points dashboard.
  if (loading || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Redeem Rewards</Text>
      <Text style={styles.sub}>
        Spend available points only. Lifetime progression is never reduced.
      </Text>

      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <MaterialCommunityIcons
            name="gift-outline"
            size={20}
            color={theme.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.description && (
              <Text style={styles.sub}>{item.description}</Text>
            )}
            <Text style={styles.cost}>{item.cost_points} pts</Text>
          </View>
          <Pressable
            disabled={busyId === item.id}
            onPress={() => handleRedeem(item)}
            style={[
              styles.redeemBtn,
              (busyId === item.id ||
                availablePoints < item.cost_points) && {
                opacity: 0.5,
              },
            ]}
          >
            <Text style={styles.redeemText}>
              {busyId === item.id ? '...' : 'REDEEM'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
