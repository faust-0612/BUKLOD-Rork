import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import { colors } from '@/lib/theme';

export default function AdminPointsRedemptionsScreen() {
  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>SYSTEM ADMIN · LEGACY</Text>
        <Text style={shared.h1}>Points Redemption Center</Text>
        <Text style={shared.muted}>
          This legacy point-to-value workflow has been retired under the R38 economic invariant.
        </Text>

        <View style={styles.guardCard}>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={27}
            color={colors.greenDark}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.guardTitle}>Point-derived money is disabled</Text>
            <Text style={styles.guardText}>
              BUKLOD Points cannot be converted into Bayanihan cash, PHP Cash Reward, or any fixed monetary value. Existing historical records remain available for audit, but this screen no longer exposes configuration, approval or payout controls.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Canonical R38 flow</Text>
          <Text style={styles.line}>1. Record actual platform revenue and recognized costs.</Text>
          <Text style={styles.line}>2. Reconcile the economic period.</Text>
          <Text style={styles.line}>3. Finalize funded pools only after the finalization gate is enabled.</Text>
          <Text style={styles.line}>4. Use BCU/RCU only as proportional weights.</Text>
          <Text style={styles.line}>5. Pay only finalized, available cash through the controlled payout workflow.</Text>
        </View>

        <Pressable
          onPress={() => router.replace('/admin/bayanihan' as any)}
          style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.82 },
          ]}
        >
          <MaterialCommunityIcons name="finance" size={19} color="#FFFFFF" />
          <Text style={styles.buttonText}>OPEN R38 ECONOMY & BAYANIHAN</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={colors.greenDark}
          />
          <Text style={styles.noteText}>
            This compatibility route is intentionally kept so old bookmarks do not break. It is read-only and cannot reactivate the legacy model.
          </Text>
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 60,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
  },
  guardCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#D5E7DC',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#EEF8F2',
  },
  guardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  guardText: {
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.muted,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 7,
  },
  line: {
    marginTop: 5,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.muted,
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.greenDark,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  noteCard: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F8F6',
  },
  noteText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.muted,
  },
});
