import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { BUKLOD_REPORT_ICON_URI } from '@/lib/buklodReportBranding';
import { fetchMyActionableReportAssignments } from '@/lib/buklodReportDomain';
import { openBuklodReportExternal } from '@/lib/buklodReportLauncher';
import { colors } from '@/lib/theme';

type Props = {
  scopeId: string;
  scopeName: string;
  scopeType: string;
  compact?: boolean;
  iconOnly?: boolean;
};

export default function BuklodReportDoorCard({
  scopeId,
  scopeName,
  scopeType,
  compact = false,
  iconOnly = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
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

  const openReport = useCallback(async () => {
    if (!scopeId || opening) return;

    setOpening(true);
    try {
      await openBuklodReportExternal({ scopeId, scopeType });
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error
          ? error.message
          : 'The standalone BUKLOD Report app could not be opened.'
      );
    } finally {
      setOpening(false);
    }
  }, [opening, scopeId, scopeType]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open BUKLOD Report for ${scopeName}`}
      disabled={opening}
      onPress={() => void openReport()}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        iconOnly && styles.logoButton,
        pressed && styles.pressed,
        opening && styles.disabled,
      ]}
    >
      {iconOnly ? (
        <View style={styles.logoOnlyWrap}>
          <Image
            source={{ uri: BUKLOD_REPORT_ICON_URI }}
            resizeMode="cover"
            style={styles.logoOnlyIcon}
          />
          {opening ? (
            <View style={styles.logoOnlyLoading}>
              <ActivityIndicator size="small" color={colors.greenDark} />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.iconWrap}>
            <Image
              source={{ uri: BUKLOD_REPORT_ICON_URI }}
              resizeMode="cover"
              style={styles.icon}
            />
          </View>

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.eyebrow}>BUKLOD FOCUS APP</Text>
              {loading || opening ? (
                <ActivityIndicator size="small" color={colors.greenDark} />
              ) : pendingCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount} DUE</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.title}>BUKLOD Report</Text>
            <Text style={styles.subtitle} numberOfLines={3}>
              Report, monitor and follow up for {scopeName}. Your selected
              {` ${scopeType.toLowerCase()} `}scope opens in the standalone Report app.
              Sign-in may be required on first open.
            </Text>
            <View style={styles.openRow}>
              <Text style={styles.openText}>{opening ? 'OPENING…' : 'OPEN REPORT'}</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={colors.greenDark}
              />
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    marginHorizontal: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8E5DE',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardCompact: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    minHeight: 96,
  },
  logoButton: {
    width: 64,
    height: 64,
    minHeight: 64,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    padding: 0,
    borderRadius: 16,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  logoOnlyWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  logoOnlyIcon: {
    width: '100%',
    height: '100%',
  },
  logoOnlyLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8E5DE',
    backgroundColor: '#F4F8F5',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  title: {
    color: '#173B2F',
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    color: '#66766E',
    fontSize: 10,
    lineHeight: 14,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#92400E',
    fontSize: 8,
    fontWeight: '900',
  },
  openRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.62,
  },
});
