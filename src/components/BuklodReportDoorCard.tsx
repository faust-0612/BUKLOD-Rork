import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { BUKLOD_REPORT_ICON_URI } from '@/lib/buklodReportBranding';
import { fetchMyActionableReportAssignments } from '@/lib/buklodReportDomain';
import { buklodReportLandingPath } from '@/lib/buklodReportRoutes';
import { colors } from '@/lib/theme';

type Props = {
  scopeId: string;
  scopeName: string;
  scopeType: string;
  compact?: boolean;
};

/**
 * Canonical BUKLOD Report door for Organization / Cluster Home.
 *
 * IMPORTANT: this deliberately uses Expo Router inside BUKLOD Main instead of
 * opening the standalone Report hostname. The already-authenticated BUKLOD
 * session therefore remains authoritative and the member is never asked to
 * sign in again when entering through this door. Direct standalone Report
 * access remains protected by its own login/session guard.
 */
export default function BuklodReportDoorCard({
  scopeId,
  scopeName,
  scopeType,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!scopeId) {
        setPendingCount(0);
        return () => {
          active = false;
        };
      }

      setLoading(true);
      void fetchMyActionableReportAssignments(20, scopeId)
        .then((rows) => {
          if (!active) return;
          setPendingCount(
            rows.filter((row) => row.assignment_status !== 'SUBMITTED').length
          );
        })
        .catch((error) => {
          console.warn('BUKLOD Report doorway summary:', error);
          if (active) setPendingCount(0);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [scopeId])
  );

  const openReport = useCallback(() => {
    if (!scopeId) return;

    // Keep this as an internal route. Do not replace with Linking/openURL.
    router.push(
      `${buklodReportLandingPath(scopeId)}&entry=main&source_scope_type=${encodeURIComponent(
        scopeType
      )}` as any
    );
  }, [scopeId, scopeType]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open BUKLOD Report for ${scopeName}`}
        accessibilityHint="Uses your current BUKLOD session and workspace."
        onPress={openReport}
        style={({ pressed }) => [
          styles.logoButton,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={{ uri: BUKLOD_REPORT_ICON_URI }}
          resizeMode="cover"
          style={styles.logo}
        />

        {loading ? (
          <View style={styles.statusBubble}>
            <ActivityIndicator size="small" color={colors.greenDark} />
          </View>
        ) : pendingCount > 0 ? (
          <View style={[styles.statusBubble, styles.badge]}>
            <Text style={styles.badgeText}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  wrapCompact: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
  },
  logoButton: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E5DE',
    backgroundColor: '#FFFFFF',
    padding: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  statusBubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badge: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
});
