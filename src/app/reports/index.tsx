import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { colors } from '@/lib/theme';
import {
  fetchReportDomainStatus,
  isReportScopeEntitled,
} from '@/lib/buklodReportDomain';
import {
  BUKLOD_REPORT_INTEGRATION,
} from '@/lib/buklodFocusAppIntegration';
import {
  buklodReportDefinitionsPath,
  readReportScopeId,
} from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { supabase } from '@/lib/supabase';

export default function BuklodReportLandingScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('');
  const [nextPhase, setNextPhase] = useState('');
  const [scopeName, setScopeName] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const status = await fetchReportDomainStatus();
      setPhase(status.implementation_phase);
      setNextPhase(status.next_phase);

      if (scopeId) {
        const [entitlement, manageAccess, scopeResult] = await Promise.all([
          isReportScopeEntitled(scopeId),
          verifyOrganizationManageAccess(scopeId),
          (supabase as any)
            .from('buklod_scopes')
            .select('name')
            .eq('id', scopeId)
            .maybeSingle(),
        ]);

        setEntitled(entitlement);
        setCanManage(manageAccess.allowed);
        setScopeName(scopeResult.data?.name ?? manageAccess.scopeName);
      } else {
        setEntitled(false);
        setCanManage(false);
        setScopeName(null);
      }
    } catch (error: unknown) {
      console.warn('BUKLOD Report landing:', error);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report' }} />

      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <MaterialCommunityIcons
            name="file-document-check-outline"
            size={30}
            color="#FFFFFF"
          />
          <Text style={styles.heroTitle}>BUKLOD Report</Text>
          <Text style={styles.heroSubtitle}>
            Official organizational reporting for required submissions, due dates,
            and review. This is separate from generic Organization admin records.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SYSTEM STATUS</Text>
          <Text style={styles.line}>
            Integration: <Text style={styles.strong}>{BUKLOD_REPORT_INTEGRATION.status}</Text>
          </Text>
          <Text style={styles.line}>
            Current phase: <Text style={styles.strong}>{phase || BUKLOD_REPORT_INTEGRATION.phase}</Text>
          </Text>
              <Text style={styles.line}>
                Next phase: <Text style={styles.strong}>{nextPhase || 'PHASE_4_SUBMISSION'}</Text>
              </Text>
              <Text style={styles.note}>
                Submission, review, reminders, and analytics are not live yet.
                Admins can configure report definitions now.
              </Text>
            </View>

            {scopeId ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>SCOPE</Text>
                <Text style={styles.line}>
                  {scopeName || 'Selected organization or cluster'}
                </Text>
                <Text style={styles.meta}>
                  {entitled
                    ? 'Reporting is enabled for this scope.'
                    : 'Reporting entitlement is not active for this scope yet.'}
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>SELECT A SCOPE</Text>
                <Text style={styles.note}>
                  Open BUKLOD Report from an Organization or Cluster manage screen
                  so submissions stay exact-scope.
                </Text>
              </View>
            )}

            {scopeId && canManage ? (
              <Pressable
                onPress={() =>
                  router.push(buklodReportDefinitionsPath(scopeId) as any)
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>
                  Manage report definitions
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Go back</Text>
            </Pressable>
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.background,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.greenDark,
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.86)',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: colors.greenDark,
  },
  line: {
    fontSize: 13,
    color: colors.text,
  },
  strong: {
    fontWeight: '900',
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  note: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  center: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
  },
});
