import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { shared } from '@/components/UI';
import {
  loadMyBuklodFinancialSummaryV3,
  type BuklodFinancialSummaryV3,
} from '@/lib/buklodEconomyV3';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

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
  const {
    t,
    formatNumber,
    formatPhp,
    formatDate,
  } = useBuklodI18n();

  const [summary, setSummary] =
    useState<BuklodFinancialSummaryV3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const next = await loadMyBuklodFinancialSummaryV3();
      setSummary(next);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : t('economy.unavailable'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const progress = summary?.progress ?? {};
  const earnings = summary?.earnings ?? {};
  const referral = summary?.referral ?? {};
  const community = summary?.community ?? {};
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
        <Pressable
          onPress={() => router.push('/preferences/language' as any)}
          style={styles.actionSecondary}
        >
          <MaterialCommunityIcons name="translate" size={17} color="#275D45" />
          <Text style={styles.actionSecondaryText}>{t('economy.guideLanguage')}</Text>
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
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>{t('common.retry').toUpperCase()}</Text>
          </Pressable>
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
            <View style={styles.grid}>
              <Metric
                label={t('economy.lifetimePoints')}
                value={formatNumber(Number(progress.lifetime_points ?? 0))}
                emphasis
              />
              <Metric
                label={t('economy.qualifiedMonthlyPoints')}
                value={formatNumber(Number(progress.qualified_monthly_points ?? 0))}
              />
              <Metric
                label={t('economy.totalQualifiedMonthlyPoints')}
                value={formatNumber(Number(progress.total_qualified_monthly_points ?? 0))}
              />
            </View>
            <Text style={styles.explainer}>{t('economy.progressNote')}</Text>
          </Section>

          <Section icon="cash-multiple" title={t('economy.earningsTitle')}>
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
                note={t('economy.estimate')}
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
