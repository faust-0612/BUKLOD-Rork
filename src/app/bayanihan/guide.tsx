import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  loadMyBuklodFinancialSummaryV3,
  type BuklodFinancialSummaryV3,
} from '@/lib/buklodEconomyV3';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

type SectionKey =
  | 'overview'
  | 'points'
  | 'earnings'
  | 'qualification'
  | 'referral'
  | 'sharing'
  | 'livelihood'
  | 'bayanihan'
  | 'clusterOrg'
  | 'suborg'
  | 'fundRequests'
  | 'estimator'
  | 'faq';

function GuideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.guideCard}>
      <Text style={styles.guideCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function StatusChip({ label }: { label: string }) {
  return (
    <View style={styles.statusChip}>
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

export default function BuklodEconomyGuideScreen() {
  const {
    t,
    languageName,
    formatNumber,
    formatPhp,
  } = useBuklodI18n();

  const [open, setOpen] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(['overview', 'estimator']),
  );
  const [summary, setSummary] =
    useState<BuklodFinancialSummaryV3 | null>(null);
  const [liveError, setLiveError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLive = useCallback(async () => {
    try {
      setLiveError('');
      setSummary(await loadMyBuklodFinancialSummaryV3());
    } catch (error) {
      setLiveError(
        error instanceof Error
          ? error.message
          : t('economy.guide.liveUnavailable'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  const toggle = (key: SectionKey) => {
    setOpen(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sections = useMemo(
    () =>
      [
        ['overview', t('economy.guide.overview'), 'information-outline'],
        ['points', t('economy.guide.points'), 'star-circle-outline'],
        ['earnings', t('economy.guide.earnings'), 'cash-multiple'],
        ['qualification', t('economy.guide.qualification'), 'check-decagram-outline'],
        ['referral', t('economy.guide.referral'), 'account-plus-outline'],
        ['sharing', t('economy.guide.sharing'), 'share-variant-outline'],
        ['livelihood', t('economy.guide.livelihood'), 'briefcase-outline'],
        ['bayanihan', t('economy.guide.bayanihan'), 'hand-heart-outline'],
        ['clusterOrg', t('economy.guide.clusterOrg'), 'domain'],
        ['suborg', t('economy.guide.suborg'), 'source-branch'],
        ['fundRequests', t('economy.guide.fundRequests'), 'clipboard-check-outline'],
        ['estimator', t('economy.guide.estimator'), 'calculator-variant-outline'],
        ['faq', t('economy.guide.faq'), 'frequently-asked-questions'],
      ] as const,
    [t],
  );

  const referralItems = summary?.referral?.items ?? [];
  const pendingReferral = referralItems.reduce(
    (sum, row) => sum + Number(row.pending_reward_php ?? 0),
    0,
  );

  const bodyFor = (key: SectionKey) => {
    switch (key) {
      case 'overview':
        return (
          <>
            <Paragraph>{t('economy.guide.sectionOverviewBody')}</Paragraph>
            <Paragraph>{t('economy.guide.sectionOverviewBody2')}</Paragraph>
            <View style={styles.summaryGrid}>
              <GuideCard title={t('economy.progressTitle')}>
                <Paragraph>{t('economy.progressNote')}</Paragraph>
              </GuideCard>
              <GuideCard title={t('economy.earningsTitle')}>
                <Paragraph>{t('economy.guide.earningsBody')}</Paragraph>
              </GuideCard>
              <GuideCard title={t('economy.referralTitle')}>
                <Paragraph>{t('economy.guide.referralBody')}</Paragraph>
              </GuideCard>
              <GuideCard title={t('economy.communityTitle')}>
                <Paragraph>{t('economy.communityNotPersonal')}</Paragraph>
              </GuideCard>
            </View>
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t('economy.overviewNotice')}</Text>
            </View>
          </>
        );

      case 'points':
        return (
          <>
            <GuideCard title={t('economy.guide.pointsLifetimeTitle')}>
              <Paragraph>{t('economy.guide.pointsLifetimeBody')}</Paragraph>
            </GuideCard>
            <GuideCard title={t('economy.guide.pointsMonthlyTitle')}>
              <Paragraph>{t('economy.guide.pointsMonthlyBody')}</Paragraph>
            </GuideCard>
            <View style={styles.flowCard}>
              <Text style={styles.flowText}>{t('economy.guide.pointsFormula')}</Text>
            </View>
            <Paragraph>{t('economy.guide.pointsExample')}</Paragraph>
          </>
        );

      case 'earnings':
        return (
          <>
            <Paragraph>{t('economy.guide.earningsBody')}</Paragraph>
            <Paragraph>{t('economy.guide.earningsBody2')}</Paragraph>
            <View style={styles.chips}>
              <StatusChip label={t('economy.estimate')} />
              <StatusChip label={t('economy.finalized')} />
              <StatusChip label={t('economy.withdrawable')} />
            </View>
            <Paragraph>{t('economy.guide.earningsStates')}</Paragraph>
            <GuideCard title={t('economy.guide.baselineTitle')}>
              <Paragraph>{t('economy.guide.baselineBody')}</Paragraph>
            </GuideCard>
          </>
        );

      case 'qualification':
        return (
          <>
            <Paragraph>{t('economy.guide.qualificationReferred')}</Paragraph>
            <Paragraph>{t('economy.guide.qualificationNoRef')}</Paragraph>
            <Paragraph>{t('economy.guide.qualificationAfter')}</Paragraph>
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t('economy.guide.accelerated')}</Text>
            </View>
          </>
        );

      case 'referral':
        return (
          <>
            <Paragraph>{t('economy.guide.referralBody')}</Paragraph>
            <Paragraph>{t('economy.guide.referralPending')}</Paragraph>
            <Paragraph>{t('economy.guide.referralAntiReset')}</Paragraph>
            <Paragraph>{t('economy.guide.referralFirstLine')}</Paragraph>
            <GuideCard title={t('economy.guide.planningOnly')}>
              <Paragraph>{t('economy.guide.referralEstimate')}</Paragraph>
            </GuideCard>
          </>
        );

      case 'sharing':
        return (
          <>
            <Paragraph>{t('economy.guide.sharingBody')}</Paragraph>
            <View style={styles.flowCard}>
              <Text style={styles.flowText}>{t('economy.guide.sharingReferral')}</Text>
            </View>
            <Paragraph>{t('economy.guide.sharingCorrect')}</Paragraph>
          </>
        );

      case 'livelihood':
        return (
          <>
            <Paragraph>{t('economy.guide.livelihoodBody')}</Paragraph>
            <Paragraph>{t('economy.guide.livelihoodSources')}</Paragraph>
            <GuideCard title={t('economy.guide.planningOnly')}>
              <Paragraph>{t('economy.guide.livelihoodEstimate')}</Paragraph>
            </GuideCard>
          </>
        );

      case 'bayanihan':
        return (
          <>
            <Paragraph>{t('economy.guide.bayanihanBody')}</Paragraph>
            <Paragraph>{t('economy.guide.bayanihanNot')}</Paragraph>
            <Paragraph>{t('economy.communityNotPersonal')}</Paragraph>
          </>
        );

      case 'clusterOrg':
        return (
          <>
            <GuideCard title={t('economy.guide.clusterTitle')}>
              <Paragraph>{t('economy.guide.clusterBody')}</Paragraph>
            </GuideCard>
            <GuideCard title={t('economy.guide.organizationTitle')}>
              <Paragraph>{t('economy.guide.organizationBody')}</Paragraph>
            </GuideCard>
            <Paragraph>{t('economy.guide.oneDestination')}</Paragraph>
          </>
        );

      case 'suborg':
        return (
          <>
            <Paragraph>{t('economy.guide.suborgBody')}</Paragraph>
            <Paragraph>{t('economy.guide.suborgFinance')}</Paragraph>
            <Paragraph>{t('economy.guide.suborgParticipation')}</Paragraph>
            <Paragraph>{t('economy.guide.suborgAdmin')}</Paragraph>
          </>
        );

      case 'fundRequests':
        return (
          <>
            <View style={styles.flowCard}>
              <Text style={styles.flowText}>{t('economy.guide.fundRequestFlow')}</Text>
            </View>
            <Paragraph>{t('economy.guide.fundGovernance')}</Paragraph>
            <Paragraph>{t('economy.guide.fundNoWallet')}</Paragraph>
            <Paragraph>{t('economy.guide.transparency')}</Paragraph>
          </>
        );

      case 'estimator':
        return (
          <>
            <Paragraph>{t('economy.guide.estimatorLive')}</Paragraph>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#275D45" />
                <Text style={styles.paragraph}>{t('common.loading')}</Text>
              </View>
            ) : summary ? (
              <View style={styles.estimatorGrid}>
                <GuideCard title={t('economy.guide.estimatorQualifiedPoints')}>
                  <Text style={styles.bigValue}>
                    {formatNumber(Number(summary.progress?.qualified_monthly_points ?? 0))}
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorPoolShare')}>
                  <Text style={styles.bigValue}>
                    {Number(summary.earnings?.estimated_pool_share_pct ?? 0).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 4 },
                    )}%
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorPersonal')}>
                  <Text style={styles.bigValue}>
                    {formatPhp(Number(summary.earnings?.estimated_earnings_php ?? 0))}
                  </Text>
                  <Text style={styles.statusText}>{t('economy.estimate')}</Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorReferrals')}>
                  <Text style={styles.bigValue}>
                    {formatNumber(Number(summary.referral?.qualified_count ?? 0))}
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorPending')}>
                  <Text style={styles.bigValue}>{formatPhp(pendingReferral)}</Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorCommunity')}>
                  <Text style={styles.bigValue}>
                    {summary.community?.selected
                      ? String(summary.community.scope_name ?? '—')
                      : '—'}
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorRate')}>
                  <Text style={styles.bigValue}>
                    {Number(summary.community?.allocation_pct ?? 0).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 },
                    )}%
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorContributors')}>
                  <Text style={styles.bigValue}>
                    {formatNumber(Number(summary.community?.active_contributors ?? 0))}
                  </Text>
                </GuideCard>
                <GuideCard title={t('economy.guide.estimatorFund')}>
                  <Text style={styles.bigValue}>
                    {formatPhp(Number(summary.community?.available_fund_php ?? 0))}
                  </Text>
                </GuideCard>
              </View>
            ) : (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{t('economy.guide.liveUnavailable')}</Text>
                {liveError ? <Text style={styles.errorText}>{liveError}</Text> : null}
              </View>
            )}
            <GuideCard title={t('economy.guide.planningOnly')}>
              <Paragraph>{t('economy.guide.baselineBody')}</Paragraph>
              <Paragraph>{t('economy.guide.referralEstimate')}</Paragraph>
              <Paragraph>{t('economy.guide.livelihoodEstimate')}</Paragraph>
            </GuideCard>
          </>
        );

      case 'faq':
        return (
          <>
            {[
              ['faq1q', 'faq1a'],
              ['faq2q', 'faq2a'],
              ['faq3q', 'faq3a'],
              ['faq4q', 'faq4a'],
            ].map(([q, a]) => (
              <GuideCard key={q} title={t('economy.guide.' + q)}>
                <Paragraph>{t('economy.guide.' + a)}</Paragraph>
              </GuideCard>
            ))}
          </>
        );
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.stickyBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#275D45" />
        </Pressable>
        <Pressable
          onPress={() => router.replace('/bayanihan' as any)}
          style={styles.summaryButton}
        >
          <MaterialCommunityIcons name="chart-donut" size={16} color="#FFFFFF" />
          <Text style={styles.summaryButtonText}>
            {t('economy.guide.stickySummary')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/preferences/language' as any)}
          accessibilityRole="button"
          accessibilityLabel={t('language.open')}
          style={styles.languageButton}
        >
          <MaterialCommunityIcons name="translate" size={16} color="#275D45" />
          <Text numberOfLines={1} style={styles.languageText}>{languageName}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('economy.guideSubtitle')}</Text>
          <Text style={styles.title}>{t('economy.guideTitle')}</Text>
          <Text style={styles.subtitle}>{t('economy.guideTagline')}</Text>
          <Text style={styles.intro}>{t('economy.overviewNotice')}</Text>
        </View>

        <View style={styles.chips}>
          <StatusChip label={t('economy.estimate')} />
          <StatusChip label={t('economy.pending')} />
          <StatusChip label={t('economy.qualifying')} />
          <StatusChip label={t('economy.finalized')} />
          <StatusChip label={t('economy.withdrawable')} />
          <StatusChip label={t('economy.paid')} />
        </View>

        {sections.map(([key, label, icon]) => {
          const expanded = open.has(key);
          return (
            <View key={key} style={styles.sectionWrap}>
              <Pressable
                onPress={() => toggle(key)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.sectionHeader}
              >
                <View style={styles.sectionHeaderIcon}>
                  <MaterialCommunityIcons
                    name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={18}
                    color="#275D45"
                  />
                </View>
                <Text style={styles.sectionHeaderText}>{label}</Text>
                <MaterialCommunityIcons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#68766F"
                />
              </Pressable>
              {expanded ? (
                <View style={styles.sectionBody}>{bodyFor(key)}</View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.footerGuard}>
          <Text style={styles.footerText}>{t('economy.guide.footerSafety')}</Text>
          <Text style={styles.footerText}>{t('economy.guide.footerPoints')}</Text>
          <Text style={styles.footerText}>{t('economy.guide.footerFraud')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  stickyBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE6E0',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF5F1',
  },
  summaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
    paddingHorizontal: 9,
  },
  summaryButtonText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  languageButton: {
    maxWidth: 110,
    minHeight: 40,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    backgroundColor: '#EFF5F1',
  },
  languageText: { flexShrink: 1, fontSize: 9, fontWeight: '900', color: '#275D45' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 100, gap: 9 },
  hero: {
    padding: 17,
    borderRadius: 16,
    backgroundColor: '#EAF4EE',
    borderWidth: 1,
    borderColor: '#D6E7DC',
  },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, color: '#6A786F' },
  title: { marginTop: 4, fontSize: 25, fontWeight: '900', color: '#20362B' },
  subtitle: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#486255' },
  intro: { marginTop: 8, fontSize: 10.5, lineHeight: 16, color: '#66766D' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D3E1D8',
    backgroundColor: '#FFFFFF',
  },
  statusChipText: { fontSize: 8, fontWeight: '900', color: '#52675C' },
  sectionWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE6E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
  },
  sectionHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5F0',
  },
  sectionHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#293C32',
  },
  sectionBody: {
    gap: 9,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4EBE7',
    backgroundColor: '#FBFCFB',
  },
  paragraph: { fontSize: 11.5, lineHeight: 18, color: '#57675F' },
  guideCard: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 12,
    gap: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E8E3',
  },
  guideCardTitle: { fontSize: 11.5, fontWeight: '900', color: '#2D463A' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  flowCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EDF6F0',
    borderWidth: 1,
    borderColor: '#D4E6DA',
  },
  flowText: { fontSize: 11, lineHeight: 17, fontWeight: '800', color: '#325745' },
  notice: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#EFDEAA',
  },
  noticeText: { fontSize: 10.5, lineHeight: 16, color: '#735D2B' },
  errorText: { marginTop: 4, fontSize: 9.5, lineHeight: 14, color: '#A14C42' },
  loadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  estimatorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bigValue: { fontSize: 18, fontWeight: '900', color: '#275D45' },
  statusText: { fontSize: 8.5, fontWeight: '900', color: '#7C6B3B' },
  footerGuard: {
    marginTop: 5,
    gap: 7,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F3',
  },
  footerText: { fontSize: 10, lineHeight: 16, color: '#626E68' },
});
