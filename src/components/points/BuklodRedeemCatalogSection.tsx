import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

type Props = {
  availablePoints: number;
  onRedeemed?: (availablePoints: number) => void;
};

export default function BuklodRedeemCatalogSection({
  availablePoints,
}: Props) {
  const { theme } = useBuklodPresentation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 18,
          backgroundColor: theme.surface,
          padding: 14,
          gap: 12,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        icon: {
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(theme.accent, 0.08),
        },
        title: {
          flex: 1,
          fontSize: 15,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        sub: {
          fontSize: 12,
          lineHeight: 18,
          color: theme.textMuted,
        },
        pointsBox: {
          borderRadius: 13,
          padding: 11,
          backgroundColor: withAlpha(theme.accent, 0.055),
        },
        pointsLabel: {
          fontSize: 9.5,
          fontWeight: '900',
          letterSpacing: 0.6,
          color: theme.textMuted,
        },
        pointsValue: {
          marginTop: 4,
          fontSize: 19,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        rule: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 10,
          borderRadius: 12,
          backgroundColor: withAlpha(theme.accent, 0.045),
        },
        ruleText: {
          flex: 1,
          fontSize: 11,
          lineHeight: 17,
          color: theme.textMuted,
        },
        button: {
          minHeight: 44,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: theme.accent,
        },
        buttonText: {
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: '900',
        },
      }),
    [theme],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={22}
            color={theme.accent}
          />
        </View>
        <Text style={styles.title}>Points stay progression-only</Text>
      </View>

      <Text style={styles.sub}>
        BUKLOD Points are for progression, rank and supported in-app reward mechanics. They are not pesos and cannot be converted into Bayanihan cash or a fixed Cash Reward.
      </Text>

      <View style={styles.pointsBox}>
        <Text style={styles.pointsLabel}>AVAILABLE POINTS</Text>
        <Text style={styles.pointsValue}>
          {Number(availablePoints ?? 0).toLocaleString('en-PH')}
        </Text>
      </View>

      <View style={styles.rule}>
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={theme.accent}
        />
        <Text style={styles.ruleText}>
          Actual BUKLOD earnings, when available, come only from finalized funded platform revenue and are reported separately from Points.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/bayanihan' as any)}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.82 },
        ]}
      >
        <MaterialCommunityIcons
          name="chart-donut"
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.buttonText}>OPEN ECONOMY & BAYANIHAN REPORT</Text>
      </Pressable>
    </View>
  );
}
