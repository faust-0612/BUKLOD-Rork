import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodWeeklyReportForm from '@/components/BuklodWeeklyReportForm';
import { colors } from '@/lib/theme';
import {
  fetchReportDomainStatus,
  isReportScopeEntitled,
} from '@/lib/buklodReportDomain';
import {
  buklodReportDefinitionsPath,
  readReportScopeId,
} from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { supabase } from '@/lib/supabase';

const REPORT_ICON = require('../../../assets/branding/buklod-report-icon.png');

export default function BuklodReportLandingScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('');
  const [scopeName, setScopeName] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const status = await fetchReportDomainStatus();
      setPhase(status.implementation_phase);

      if (scopeId) {
        const [entitlement, manageAccess, scopeResult] = await Promise.all([
          isReportScopeEntitled(scopeId),
          verifyOrganizationManageAccess(scopeId),
          (supabase as any)
            .from('buklod_scopes')
            .select('name, scope_type')
            .eq('id', scopeId)
            .maybeSingle(),
        ]);

        setEntitled(entitlement);
        setCanManage(manageAccess.allowed);
        setScopeName(scopeResult.data?.name ?? manageAccess.scopeName ?? null);
        setScopeType(scopeResult.data?.scope_type ?? null);
      } else {
        setEntitled(false);
        setCanManage(false);
        setScopeName(null);
        setScopeType(null);
      }
    } catch (error: any) {
      console.warn('BUKLOD Report landing:', error);
      setLoadError(error?.message || 'BUKLOD Report could not be opened.');
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
          <Image source={REPORT_ICON} resizeMode="cover" style={styles.heroIcon} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>REPORT → EVIDENCE → ACTION</Text>
            <Text style={styles.heroTitle}>BUKLOD Report</Text>
            <Text style={styles.heroSubtitle}>
              Simple reporting in front. Intelligent monitoring and follow-up behind it.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Opening your report workspace…</Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable onPress={() => void load()} style={styles.retryButton}>
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : null}

            {scopeId ? (
              <View style={styles.scopeCard}>
                <View style={styles.scopeIcon}>
                  <MaterialCommunityIcons
                    name={scopeType === 'CLUSTER' ? 'account-group' : 'domain'}
                    size={22}
                    color={colors.greenDark}
                  />
                </View>
                <View style={styles.scopeCopy}>
                  <Text style={styles.scopeLabel}>ACTIVE CONTEXT</Text>
                  <Text style={styles.scopeName}>{scopeName || 'Selected scope'}</Text>
                  <Text style={styles.scopeMeta}>
                    {scopeType || 'Organization / Cluster'} · Same BUKLOD account · No second sign-in
                  </Text>
                </View>
                {entitled ? (
                  <View style={styles.enabledPill}>
                    <Text style={styles.enabledText}>ENABLED</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.infoCard}>
                <MaterialCommunityIcons
                  name="door-open"
                  size={24}
                  color={colors.greenDark}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Open from Organization or Cluster Home</Text>
                  <Text style={styles.note}>
                    The BUKLOD Report doorway carries the exact active scope automatically so you do
                    not need to choose it again.
                  </Text>
                </View>
              </View>
            )}

            {scopeId && entitled ? (
              <BuklodWeeklyReportForm scopeId={scopeId} onSubmitted={() => void load()} />
            ) : scopeId ? (
              <View style={styles.warningCard}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={22}
                  color="#92400E"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Reporting is not enabled for this scope</Text>
                  <Text style={styles.warningText}>
                    Ask the Organization or Cluster administrator to activate BUKLOD Report access.
                  </Text>
                </View>
              </View>
            ) : null}

            {scopeId && canManage ? (
              <Pressable
                onPress={() => router.push(buklodReportDefinitionsPath(scopeId) as any)}
                style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name="clipboard-text-cog-outline"
                  size={20}
                  color={colors.greenDark}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.manageTitle}>Report settings</Text>
                  <Text style={styles.manageMeta}>
                    Manage definitions and scope reporting rules
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.greenDark}
                />
              </Pressable>
            ) : null}

            <View style={styles.footerLine}>
              <Text style={styles.footerText}>
                {phase || 'PHASE_4_SUBMISSION'} · Scope-isolated · Evidence preserved
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="arrow-left" size={17} color={colors.greenDark} />
              <Text style={styles.backText}>Back to BUKLOD Main</Text>
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
    borderRadius: 20,
    padding: 15,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.86)',
  },
  center: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    color: colors.muted,
    fontSize: 11,
  },
  scopeCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scopeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCopy: {
    flex: 1,
    minWidth: 0,
  },
  scopeLabel: {
    color: '#61766C',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  scopeName: {
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '900',
  },
  scopeMeta: {
    marginTop: 2,
    color: '#6C7B73',
    fontSize: 9,
    lineHeight: 13,
  },
  enabledPill: {
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  enabledText: {
    color: '#166534',
    fontSize: 8,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  note: {
    marginTop: 3,
    color: '#6C7B73',
    fontSize: 10,
    lineHeight: 15,
  },
  warningCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F4D8A6',
    backgroundColor: '#FFFBEB',
    padding: 13,
    flexDirection: 'row',
    gap: 9,
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '900',
  },
  warningText: {
    marginTop: 2,
    color: '#8A5A12',
    fontSize: 10,
    lineHeight: 14,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 11,
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    backgroundColor: '#991B1B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  manageButton: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manageTitle: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '900',
  },
  manageMeta: {
    marginTop: 2,
    color: '#6C7B73',
    fontSize: 9,
  },
  footerLine: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  footerText: {
    color: '#7B8982',
    fontSize: 8,
    fontWeight: '700',
  },
  backButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
