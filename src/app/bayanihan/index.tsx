import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { shared } from '@/components/UI';
import {
  loadMyBuklodFinancialSummaryV3,
  type BuklodFinancialSummaryV3,
} from '@/lib/buklodEconomyV3';
import {
  loadMyCommunityContribution,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';
import { communityQmpMetrics } from '@/lib/buklodEconomyQmp';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

function Metric({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.metric, emphasis && styles.metricEmphasis]}>
      <Text style={[styles.metricValue, emphasis && styles.metricValueEmphasis]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}>
          <MaterialCommunityIcons name={icon} size={19} color="#275D45" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function BayanihanScreen() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const {
    t,
    formatNumber,
    formatPhp,
    formatDate,
  } = useBuklodI18n();

  const [summary, setSummary] =
    useState<BuklodFinancialSummaryV3 | null>(null);
  const [contribution, setContribution] = useState<CommunityContributionDashboard | null>(null);
  const [qmpError, setQmpError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const ownerRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const lastSyncedRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [supportCode, setSupportCode] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (authLoading) return;
    if (!userId) {
      setSummary(null);
      setContribution(null);
      setError('Sign in to view your personal Economy summary.');
      setLoading(false);
      return;
    }
    if (!force && lastSyncedRef.current > 0
      && Date.now() - lastSyncedRef.current < 30_000) return;
    const request = ++requestRef.current;
    try {
      setError('');
      setQmpError('');
      setSupportCode(null);
      const [financialResult, communityResult] = await Promise.allSettled([
        loadMyBuklodFinancialSummaryV3(),
        withBuklodTimeout(loadMyCommunityContribution(), 8000, 'Community QMP'),
      ]);
      if (request !== requestRef.current) return;

      const financialReady = financialResult.status === 'fulfilled'
        && financialResult.value.identity_ready === true;
      if (financialReady && financialResult.status === 'fulfilled') {
        setSummary(financialResult.value);
      } else {
        setSummary(null);
        const reason = financialResult.status === 'rejected'
          ? financialResult.reason
          : new Error('Economy identity is not ready. Please retry.');
        const feedback = buildBuklodUserFeedback(reason, {
          context: 'general',
          fallbackTitle: t('economy.unavailable'),
          fallbackMessage: 'Your BUKLOD Economy summary could not be loaded right now.',
        });
        setError('Your BUKLOD Economy summary could not be loaded right now. Pull down or tap Try Again.');
        setSupportCode(feedback.supportCode ?? 'SYS-500');
        void trackBuklodFeedbackEvent({
          event: 'error_shown',
          category: feedback.category,
          supportCode: feedback.supportCode ?? 'SYS-500',
          route: '/bayanihan',
          feature: 'Economy / Bayanihan',
          outcome: 'summary_load_failed',
        });
      }

      const communityReady = communityResult.status === 'fulfilled'
        && communityQmpMetrics(communityResult.value) !== null;
      if (communityReady && communityResult.status === 'fulfilled') {
        setContribution(communityResult.value);
      } else {
        setContribution(null);
        setQmpError('Community QMP could not be verified. Pull down or tap Retry; missing data is not zero.');
      }
      if (financialReady && communityReady) {
        lastSyncedRef.current = Date.now();
        setLastUpdatedAt(lastSyncedRef.current);
      } else {
        lastSyncedRef.current = 0;
        setLastUpdatedAt(null);
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [t, userId, authLoading]);

  useFocusEffect(useCallback(() => {
    if (ownerRef.current !== userId) {
      ownerRef.current = userId;
      ++requestRef.current;
      lastSyncedRef.current = 0;
      setSummary(null);
      setContribution(null);
      setQmpError('');
      setLastUpdatedAt(null);
      setLoading(true);
    }
    void load();
    return () => { ++requestRef.current; };
  }, [load, userId]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const progress = summary?.progress ?? {};
  const earnings = summary?.earnings ?? {};
  const referral = summary?.referral ?? {};
  const community = summary?.community ?? {};
  const qmp = communityQmpMetrics(contribution);
  const poolSharePct = Number(earnings.estimated_pool_share_pct ?? 0);
  const referralItems = Array.isArray(referral.items)
    ? referral.items
    : [];

  const pendingReferralPhp = referralItems.reduce(
    (sum, row) => sum + Number(row.pending_reward_php ?? 0),
    0,
  );

  return (
    <BuklodPortalScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('economy.guideTitle')}</Text>
          <Text style={styles.title}>{t('economy.mySummary')}</Text>
          <Text style={styles.subtitle}>{t('economy.actualBackendOnly')}</Text>
        </View>
        <MaterialCommunityIcons name="chart-donut" size={34} color="#275D45" />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/bayanihan/guide' as any)}
          style={styles.actionPrimary}
        >
          <MaterialCommunityIcons name="book-open-page-variant-outline" size={17} color="#FFFFFF" />
          <Text style={styles.actionPrimaryText}>{t('economy.openGuide')}</Text>
        </Pressable>

      </View>

      {loading && !summary ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#275D45" />
          <Text style={styles.stateText}>{t('economy.loading')}</Text>
        </View>
      ) : error && !summary ? (
        <View style={styles.stateCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#9B5A17" />
          <Text style={styles.stateTitle}>{t('economy.unavailable')}</Text>
          <Text style={styles.stateText}>{error}</Text>
          {!!supportCode && (
            <Text style={styles.supportCode}>Support code: {supportCode}</Text>
          )}
          <View style={styles.stateActions}>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void trackBuklodFeedbackEvent({
                  event: 'support_opened_after_error',
                  supportCode,
                  route: '/bayanihan',
                  feature: 'Economy / Bayanihan',
                  outcome: 'need_help',
                });
                router.push({
                  pathname: '/help' as any,
                  params: {
                    category: 'FINANCIAL',
                    errorCode: supportCode ?? 'SYS-500',
                    message: error,
                    sourceRoute: '/bayanihan',
                  },
                });
              }}
              style={styles.helpAction}
            >
              <Text style={styles.helpActionText}>{t('support.needHelp')}</Text>
            </Pressable>
          </View>
        </View>
      ) : summary ? (
        <>
          <View style={styles.guard}>
            <MaterialCommunityIcons name="shield-check-outline" size={23} color="#275D45" />
            <View style={{ flex: 1 }}>
              <Text style={styles.guardTitle}>{t('economy.pointsNotMoney')}</Text>
              <Text style={styles.guardText}>{t('economy.pointsNotMoneyBody')}</Text>
            </View>
          </View>

          <Section icon="star-circle-outline" title={t('economy.progressTitle')}>
            <Text style={styles.explainer}>
              {qmp ? `Community QMP · ${qmp.periodKey}` : 'Community QMP · not available'}
              {lastUpdatedAt ? ` · Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ''}
            </Text>
            <View style={styles.grid}>
              <Metric
                label={t('economy.lifetimePoints')}
                value={formatNumber(Number(progress.lifetime_points ?? 0))}
                emphasis
              />
              <Metric
                label={t('economy.qualifiedMonthlyPoints')}
                value={qmp ? formatNumber(qmp.monthlyQmp) : '—'}
              />
              <Metric
                label={t('economy.totalQualifiedMonthlyPoints')}
                value={qmp ? formatNumber(qmp.totalQmp) : '—'}
              />
              <Metric
                label="QMP Participation Weight"
                value={qmp ? `${qmp.participationPct.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}%` : '—'}
                note="Participation only; no cash entitlement."
              />
            </View>
            {qmpError ? (
              <Pressable onPress={() => void load(true)} style={styles.stateCard}>
                <Text style={styles.stateText}>{qmpError} · Retry</Text>
              </Pressable>
            ) : null}
            <Text style={styles.explainer}>{t('economy.progressNote')}</Text>
          </Section>

          <Section icon="cash-multiple" title={t('economy.earningsTitle')}>
            {contribution && Number(contribution.this_month_qmp || 0) > 0 ? (
              <View style={styles.guard}>
                <MaterialCommunityIcons name="chart-line" size={23} color="#275D45" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guardTitle}>Community QMP · possible monthly share</Text>
                  <Text style={styles.metricValue}>
                    {contribution?.estimated_share_minor == null
                      ? 'No verified provisional revenue yet'
                      : contribution.estimate_below_cent ? 'Below ₱0.01' : formatPhp(Number(contribution.estimated_share_minor) / 100)}
                  </Text>
                  <Text style={styles.guardText}>
                    {contribution?.estimate_label || 'Estimate only. Not final or withdrawable.'}
                    {contribution?.estimate_updated_at
                      ? ` · Source updated ${new Date(contribution.estimate_updated_at).toLocaleString()}`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {earnings.user_pool_eligibility_active
                  ? t('economy.userPoolActive')
                  : t('economy.userPoolInactive')}
              </Text>
            </View>

            <View style={styles.grid}>
              <Metric
                label={t('economy.estimatedPoolShare')}
                value={poolSharePct.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                }) + '%'}
                note={earnings.user_pool_eligibility_active
                  ? t('economy.estimate')
                  : 'Financial pool eligibility not activated.'}
              />
              <Metric
                label={t('economy.estimatedUserPool')}
                value={formatPhp(Number(earnings.estimated_user_pool_php ?? 0))}
                note={t('economy.estimate')}
              />
              <Metric
                label={t('economy.estimatedEarnings')}
                value={formatPhp(Number(earnings.estimated_earnings_php ?? 0))}
                note={t('economy.estimate')}
              />
              <Metric
                label={t('economy.finalizedEarnings')}
                value={formatPhp(Number(earnings.latest_finalized_user_share_php ?? 0))}
                note={t('economy.finalized')}
                emphasis
              />
              <Metric
                label={t('economy.withdrawableBalance')}
                value={formatPhp(Number(earnings.withdrawable_php ?? 0))}
                note={t('economy.withdrawable')}
              />
              <Metric
                label={t('economy.reservedBalance')}
                value={formatPhp(Number(earnings.reserved_php ?? 0))}
              />
              <Metric
                label={t('economy.paidEarnings')}
                value={formatPhp(Number(earnings.paid_php ?? 0))}
                note={t('economy.paid')}
              />
            </View>
            <Text style={styles.explainer}>{t('economy.earningsNote')}</Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => router.push('/bayanihan/payout-profile' as any)}
                style={styles.actionSecondary}
              >
                <Text style={styles.actionSecondaryText}>{t('economy.openPayout')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/bayanihan/withdrawals' as any)}
                style={styles.actionSecondary}
              >
                <Text style={styles.actionSecondaryText}>{t('economy.openHistory')}</Text>
              </Pressable>
            </View>
          </Section>

          <Section icon="account-plus-outline" title={t('economy.referralTitle')}>
            <View style={styles.grid}>
              <Metric
                label={t('economy.referralCode')}
                value={String(referral.referral_code ?? '—')}
              />
              <Metric
                label={t('economy.totalReferrals')}
                value={formatNumber(Number(referral.invited_count ?? 0))}
              />
              <Metric
                label={t('economy.qualifiedReferrals')}
                value={formatNumber(Number(referral.qualified_count ?? 0))}
              />
              <Metric
                label={t('economy.pending')}
                value={formatPhp(pendingReferralPhp)}
              />
              <Metric
                label={t('economy.oneTimeReward')}
                value={formatPhp(Number(referral.one_time_reward_php ?? 0))}
              />
              <Metric
                label={t('economy.firstLineShare')}
                value={
                  Number(referral.first_line_pct ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }) +
                  '% / ' +
                  formatNumber(Number(referral.referral_months ?? 0)) +
                  ' mo'
                }
              />
            </View>
            <Text style={styles.explainer}>{t('economy.referralNote')}</Text>
            <Text style={styles.explainer}>{t('economy.firstLineOnly')}</Text>
          </Section>

          <Section icon="hand-heart-outline" title={t('economy.communityTitle')}>
            {community.selected ? (
              <>
                <View style={styles.grid}>
                  <Metric
                    label={t('economy.selectedCommunity')}
                    value={String(community.scope_name ?? '—')}
                    emphasis
                  />
                  <Metric
                    label={t('economy.communityRate')}
                    value={
                      Number(community.allocation_pct ?? 0).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 },
                      ) + '%'
                    }
                  />
                  <Metric
                    label={t('economy.activeContributors')}
                    value={formatNumber(Number(community.active_contributors ?? 0))}
                  />
                  <Metric
                    label={t('economy.organizationThreshold')}
                    value={formatNumber(Number(community.organization_threshold ?? 0))}
                  />
                  <Metric
                    label={t('economy.availableFund')}
                    value={formatPhp(Number(community.available_fund_php ?? 0))}
                  />
                  <Metric
                    label={t('economy.reservedFund')}
                    value={formatPhp(Number(community.reserved_fund_php ?? 0))}
                  />
                  <Metric
                    label={t('economy.spentFund')}
                    value={formatPhp(Number(community.spent_fund_php ?? 0))}
                  />
                </View>
                {community.locked_until ? (
                  <Text style={styles.explainer}>
                    {t('economy.destinationLock')}: {formatDate(community.locked_until)}
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('economy.noCommunity')}</Text>
              </View>
            )}
            <Text style={styles.explainer}>{t('economy.communityNotPersonal')}</Text>
          </Section>

          <View style={styles.safetyCard}>
            <Text style={styles.safetyText}>{t('economy.safetyNotice')}</Text>
            <Text style={styles.safetyText}>{t('economy.antiFraud')}</Text>
          </View>
        </>
      ) : null}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 150, gap: 10 },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    backgroundColor: '#EEF6F1',
    borderWidth: 1,
    borderColor: '#D8E8DE',
  },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: '#6F7E76' },
  title: { marginTop: 4, fontSize: 27, fontWeight: '900', color: '#1F3328' },
  subtitle: { marginTop: 5, fontSize: 11, lineHeight: 16, color: '#6D7B73' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 2 },
  actionPrimary: {
    minHeight: 44,
    flexGrow: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: '#275D45',
  },
  actionPrimaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  actionSecondary: {
    minHeight: 42,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CEE0D5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 6,
  },
  actionSecondaryText: { color: '#275D45', fontSize: 10, fontWeight: '900' },
  stateCard: { padding: 28, gap: 8, alignItems: 'center', backgroundColor: '#FFFFFF' },
  stateTitle: { fontSize: 14, fontWeight: '900', color: '#26382F' },
  stateText: { textAlign: 'center', fontSize: 11, lineHeight: 17, color: '#758078' },
  supportCode: {
    marginTop: 8,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#7A5A17',
  },
  stateActions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  helpAction: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#275D45',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  helpActionText: {
    color: '#275D45',
    fontSize: 10.5,
    fontWeight: '900',
  },
  retry: { marginTop: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, backgroundColor: '#275D45' },
  retryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  guard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#F0F8F3',
    borderWidth: 1,
    borderColor: '#D8E9DE',
  },
  guardTitle: { fontSize: 13, fontWeight: '900', color: '#274136' },
  guardText: { marginTop: 3, fontSize: 10.5, lineHeight: 16, color: '#687870' },
  section: { gap: 8, paddingTop: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5F0' },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: '#22372C' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metric: {
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 130,
    minHeight: 86,
    padding: 11,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E8E4',
  },
  metricEmphasis: { backgroundColor: '#EEF7F1', borderColor: '#CDE1D4' },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#34463C' },
  metricValueEmphasis: { color: '#275D45' },
  metricLabel: { marginTop: 4, fontSize: 9.5, lineHeight: 13, fontWeight: '800', color: '#6B7871' },
  metricNote: { marginTop: 3, fontSize: 8.5, lineHeight: 12, color: '#8A948F' },
  explainer: { paddingHorizontal: 3, fontSize: 10.5, lineHeight: 16, color: '#6D7A73' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EAF4EE' },
  statusPillText: { fontSize: 9, fontWeight: '900', color: '#275D45' },
  emptyCard: { padding: 15, borderWidth: 1, borderColor: '#E1E8E4', backgroundColor: '#FFFFFF' },
  emptyText: { fontSize: 11, lineHeight: 17, color: '#6F7C75' },
  safetyCard: { marginTop: 8, padding: 14, gap: 6, backgroundColor: '#FFF8E9', borderWidth: 1, borderColor: '#F0DFAE' },
  safetyText: { fontSize: 10.5, lineHeight: 16, color: '#715D2F' },
});
