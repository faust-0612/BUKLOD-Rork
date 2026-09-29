import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  asMoney,
  formatPhp,
  loadMyBuklodR38EconomyReport,
  type BuklodR38UserEconomyReport,
} from '@/lib/buklodR38Economy';

function Metric({
  label,
  value,
  note,
  emphasized = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.metric, emphasized && styles.metricPrimary]}>
      <Text style={[styles.metricValue, emphasized && styles.metricValuePrimary]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {!!note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  icon,
  title,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={19} color="#275D45" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{text}</Text>
      </View>
    </View>
  );
}

export default function BayanihanScreen() {
  const [report, setReport] = useState<BuklodR38UserEconomyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setReport(await loadMyBuklodR38EconomyReport());
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Could not load your BUKLOD economy report.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const rankName = useMemo(() => {
    const rank = report?.progress?.circle_rank ?? {};
    const value =
      (rank as Record<string, unknown>).display_name ??
      (rank as Record<string, unknown>).rank_name ??
      (rank as Record<string, unknown>).tier_name;
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : 'BUKLOD Member';
  }, [report]);

  const estimated = report?.actual_earnings?.estimated_share ?? null;
  const finalized = report?.actual_earnings?.finalized_share;
  const availableCash = report?.actual_earnings?.available_cash;
  const paid = report?.actual_earnings?.paid_earnings;
  const withdrawalEnabled =
    report?.actual_earnings?.referral_withdrawal_enabled === true;
  const canonical = report?.canonical_finance;

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
          <Text style={styles.eyebrow}>BUKLOD BAYANIHAN</Text>
          <Text style={styles.title}>My Economy Report</Text>
          <Text style={styles.subtitle}>
            Progress, contribution, app sharing and actual funded earnings — kept separate by design.
          </Text>
        </View>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="chart-donut" size={30} color="#275D45" />
        </View>
      </View>

      {loading && !report ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#275D45" />
          <Text style={styles.loadingText}>Loading your economy report...</Text>
        </View>
      ) : error && !report ? (
        <View style={styles.loadingCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={30} color="#A35C00" />
          <Text style={styles.errorTitle}>Report unavailable</Text>
          <Text style={styles.loadingText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : report ? (
        <>
          <View style={styles.invariantCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#275D45" />
            <View style={{ flex: 1 }}>
              <Text style={styles.invariantTitle}>Points are not money</Text>
              <Text style={styles.invariantText}>
                BUKLOD Points, Circle Rank, Character and Collectibles are progression systems. They do not convert to pesos. Cash can exist only after real platform revenue is reconciled, funded and finalized.
              </Text>
            </View>
          </View>

          <Section eyebrow="PROGRESS" title="Your BUKLOD Progress">
            <View style={styles.grid}>
              <Metric
                label="Lifetime Points"
                value={Number(report.progress.lifetime_points ?? 0).toLocaleString('en-PH')}
                emphasized
              />
              <Metric
                label="Available Points"
                value={Number(report.progress.available_points ?? 0).toLocaleString('en-PH')}
              />
              <Metric
                label="Pending Claimable"
                value={Number(report.progress.pending_points ?? 0).toLocaleString('en-PH')}
              />
            </View>
            <InfoRow
              icon="trophy-outline"
              title={rankName}
              text={`Character: ${report.progress.character || 'Not selected'} · Collectibles: ${Number(report.progress.collectibles ?? 0).toLocaleString('en-PH')}`}
            />
            <Pressable style={styles.linkButton} onPress={() => router.push('/points' as any)}>
              <MaterialCommunityIcons name="star-circle-outline" size={18} color="#275D45" />
              <Text style={styles.linkButtonText}>OPEN BUKLOD POINTS</Text>
            </Pressable>
          </Section>

          <Section eyebrow="ECONOMIC CONTRIBUTION" title="Qualified Monthly Points">
            <View style={styles.gridTwo}>
              <Metric
                label="Your Qualified Points"
                value={asMoney(canonical?.qualified_monthly_points).toLocaleString('en-PH')}
                note="Monthly weight only"
              />
              <Metric
                label="All Qualified Points"
                value={asMoney(canonical?.total_qualified_monthly_points).toLocaleString('en-PH')}
                note="Current month"
              />
              <Metric
                label="Estimated Pool Share"
                value={`${asMoney(canonical?.estimated_pool_share_pct).toLocaleString('en-PH', { maximumFractionDigits: 4 })}%`}
              />
              <Metric
                label="30% User Pool"
                value={formatPhp(canonical?.estimated_user_pool_php)}
                note="Estimate until finalization"
              />
            </View>
            <Text style={styles.explainer}>
              Qualified Monthly Points determine your proportional share of the 30% User Revenue Pool. Points never convert to pesos and have no fixed PHP value.
            </Text>
          </Section>

          <Section eyebrow="APP SHARING" title="First-Line Referral">
            <View style={styles.gridTwo}>
              <Metric
                label="Invited"
                value={Number(canonical?.invited_count ?? 0).toLocaleString('en-PH')}
              />
              <Metric
                label="Qualified"
                value={Number(canonical?.qualified_count ?? 0).toLocaleString('en-PH')}
              />
              <Metric
                label="One-Time Reward"
                value={formatPhp(canonical?.one_time_reward_php)}
                note="After referred user qualifies"
              />
              <Metric
                label="First-Line Share"
                value={`${asMoney(canonical?.first_line_share_pct).toLocaleString('en-PH')}%`}
                note={`${Number(canonical?.referral_months ?? 0)} months only`}
              />
            </View>
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Your qualification</Text>
              <Text style={styles.breakdownLine}>
                {formatPhp(canonical?.qualification_value_php)} of {formatPhp(canonical?.qualification_threshold_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                User Pool eligibility: {canonical?.user_pool_eligibility_active ? 'ACTIVE' : 'NOT YET ACTIVE'}
              </Text>
            </View>
            <Text style={styles.explainer}>
              Referral income is first-line only. The one-time reward and six-month share are backed by finalized platform value; no referral cash is created from Points.
            </Text>
          </Section>

          <Section eyebrow="ACTUAL EARNINGS" title="Funded Cash Status">
            {estimated ? (
              <View style={styles.estimateCard}>
                <Text style={styles.estimateLabel}>{estimated.label}</Text>
                <Text style={styles.estimateValue}>{formatPhp(estimated.total)}</Text>
                <Text style={styles.estimateText}>
                  Estimate only. It is not withdrawable and may change until the period is reconciled and finalized.
                </Text>
              </View>
            ) : null}

            <View style={styles.gridTwo}>
              <Metric
                label="Latest User Pool Share"
                value={formatPhp(finalized?.bayanihan)}
                emphasized
              />
              <Metric
                label="Latest First-Line Share"
                value={formatPhp(finalized?.direct_referral)}
              />
              <Metric
                label="Latest Finalized Total"
                value={formatPhp(finalized?.total)}
              />
              <Metric label="Available Cash" value={formatPhp(availableCash?.total)} />
              <Metric
                label="Reserved"
                value={formatPhp(report.actual_earnings.reserved_for_withdrawal)}
              />
              <Metric label="Paid Earnings" value={formatPhp(paid?.total)} />
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Canonical earnings breakdown</Text>
              <Text style={styles.breakdownLine}>
                Latest period: {canonical?.latest_period_key || 'Not finalized yet'}
              </Text>
              <Text style={styles.breakdownLine}>
                Lifetime User Pool: {formatPhp(canonical?.lifetime_user_pool_earned_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                Lifetime First-Line: {formatPhp(canonical?.lifetime_first_line_earned_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                Lifetime Referral Rewards: {formatPhp(canonical?.lifetime_referral_reward_earned_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                Lifetime Total Earned: {formatPhp(canonical?.lifetime_total_earned_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                Estimated current earnings: {formatPhp(canonical?.estimated_earnings_php)}
              </Text>
              <Text style={styles.breakdownLine}>
                Policy: {canonical?.policy_version || 'canonical_finance_v3'}
              </Text>
            </View>

            <InfoRow
              icon={withdrawalEnabled ? 'cash-check' : 'lock-outline'}
              title={withdrawalEnabled ? 'Canonical withdrawal is enabled' : 'Withdrawal is not activated yet'}
              text={
                withdrawalEnabled
                  ? 'Only finalized cash in your canonical AVAILABLE ledger can enter withdrawal. Points are never deducted or converted.'
                  : 'No withdrawal can be created while the canonical withdrawal gate is off. This prevents unfunded or premature payouts.'
              }
            />
          </Section>

          <Section eyebrow="RULES" title="How the Money Flow Works">
            <InfoRow
              icon="cash-multiple"
              title="1. Real platform revenue first"
              text="Advertising and other recognized platform revenue are recorded at platform level, never from a user's Points balance."
            />
            <InfoRow
              icon="server-network"
              title="2. Actual costs are reconciled"
              text="Infrastructure, database, storage, bandwidth, media, AI/TTS, payment fees and other recognized costs are deducted before distribution."
            />
            <InfoRow
              icon="chart-pie"
              title="3. The 30% User Pool is calculated"
              text="Thirty percent of normal eligible finalized revenue forms one monthly User Revenue Pool. Qualified Monthly Points determine each eligible user's proportion."
            />
            <InfoRow
              icon="scale-balance"
              title="4. First-line referral is separate"
              text="A qualified first-line referral may produce the configured one-time reward plus the configured first-line percentage for the six-month window. No second-line or Points-to-cash path is used."
            />
            <InfoRow
              icon="bank-check"
              title="5. Finalized cash can move to payout"
              text="Only finalized and available cash may become a withdrawal. Payment history is separate from Points, Rank and progression."
            />
          </Section>
        </>
      ) : null}

      <Text style={styles.footerBrand}>SAMAHANG BINUKLOD NG PAG-IBIG</Text>
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 160, gap: 8 },
  hero: {
    flexDirection: 'row',
    gap: 12,
    padding: 19,
    backgroundColor: 'rgba(39,93,69,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
  },
  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#78847D' },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#1C2822' },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 18, color: '#69766F', fontWeight: '700' },
  loadingCard: { padding: 30, gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { textAlign: 'center', color: '#738078', lineHeight: 18 },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#26352D' },
  retryButton: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#275D45' },
  retryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  invariantCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#EFF8F2',
    borderWidth: 1,
    borderColor: '#D7EADF',
  },
  invariantTitle: { fontSize: 15, fontWeight: '900', color: '#203229' },
  invariantText: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: '#637169' },
  section: { gap: 8, paddingTop: 14 },
  sectionEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.35, color: '#7F8B84' },
  sectionTitle: { marginBottom: 2, fontSize: 20, fontWeight: '900', color: '#202C26' },
  grid: { flexDirection: 'row', gap: 6 },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metric: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 88,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },
  metricPrimary: { backgroundColor: 'rgba(39,93,69,0.07)', borderColor: 'rgba(39,93,69,0.18)' },
  metricValue: { fontSize: 17, fontWeight: '900', color: '#344139' },
  metricValuePrimary: { color: '#275D45' },
  metricLabel: { marginTop: 5, fontSize: 10, lineHeight: 13, fontWeight: '800', color: '#6F7C75' },
  metricNote: { marginTop: 3, fontSize: 9.5, lineHeight: 13, color: '#909A94' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.08)',
  },
  infoIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39,93,69,0.07)' },
  infoTitle: { fontSize: 13, fontWeight: '900', color: '#25322B' },
  infoText: { marginTop: 3, fontSize: 10.5, lineHeight: 16, color: '#748078' },
  linkButton: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F7F3', borderWidth: 1, borderColor: '#D4E7DC' },
  linkButtonText: { fontSize: 11, fontWeight: '900', color: '#275D45' },
  explainer: { paddingHorizontal: 2, fontSize: 11, lineHeight: 17, color: '#6E7A73' },
  estimateCard: { padding: 14, backgroundColor: '#FFF9E8', borderWidth: 1, borderColor: '#F1DDA3' },
  estimateLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8, color: '#956500' },
  estimateValue: { marginTop: 4, fontSize: 24, fontWeight: '900', color: '#7D5500' },
  estimateText: { marginTop: 5, fontSize: 10.5, lineHeight: 15, color: '#876F3F' },
  breakdownCard: { padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(25,45,35,0.08)' },
  breakdownTitle: { fontSize: 12.5, fontWeight: '900', color: '#25322B' },
  breakdownLine: { marginTop: 5, fontSize: 10.5, color: '#6F7D75' },
  footerBrand: { marginTop: 16, textAlign: 'center', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1, color: '#929C96' },
});
