/* Canonical BUKLOD Economy & Bayanihan Ledger — mobile vertical scroll. */
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
import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import {
  economyEstimatedBayanihanPhp,
  economyFinalizedBayanihanPhp,
  economyPoolSharePct,
  economyQmpWeight,
  formatEconomyPhp,
  formatEconomyPts,
  loadBuklodEconomyLedger,
  peekBuklodEconomyLedger,
  type BuklodEconomyLedgerSnapshot,
  type BuklodEconomyLedgerTxn,
} from '@/lib/buklodEconomyLedger';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';

type SectionKey =
  | 'overview'
  | 'points'
  | 'shares'
  | 'bayanihan'
  | 'rewards'
  | 'transactions'
  | 'impact'
  | 'actions';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'points', label: 'Points' },
  { key: 'shares', label: 'Shares/QMP' },
  { key: 'bayanihan', label: 'Bayanihan' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'impact', label: 'Impact' },
  { key: 'actions', label: 'Actions' },
];

function Metric({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.metric, emphasis && styles.metricEmphasis]}>
      <Text style={[styles.metricValue, emphasis && styles.metricValueOn]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function SectionCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'muted';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionBtn,
        tone === 'secondary' && styles.actionBtnSecondary,
        tone === 'muted' && styles.actionBtnMuted,
        disabled && styles.actionBtnDisabled,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={tone === 'primary' ? '#1A1406' : '#275D45'}
      />
      <Text style={[styles.actionBtnText, tone !== 'primary' && styles.actionBtnTextAlt]}>
        {label}
      </Text>
    </Pressable>
  );
}

function txnLabel(row: BuklodEconomyLedgerTxn) {
  return row.description?.trim()
    || row.activity_type.replace(/_/g, ' ')
    || 'Points activity';
}

export default function BuklodEconomyDashboard() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const [snapshot, setSnapshot] = useState<BuklodEconomyLedgerSnapshot | null>(
    () => peekBuklodEconomyLedger(userId),
  );
  const [loading, setLoading] = useState(!peekBuklodEconomyLedger(userId));
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<SectionKey>('overview');
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<BuklodEconomyLedgerTxn | null>(null);

  const load = useCallback((force = false) => loadBuklodEconomyLedger(userId, force), [userId]);

  useEffect(() => {
    let alive = true;
    const cached = peekBuklodEconomyLedger(userId);
    setSnapshot(cached);
    setLoading(!cached);
    if (!userId) return () => { alive = false; };
    void load()
      .then(next => { if (alive) setSnapshot(next); })
      .catch(() => { if (alive) setMessage('Could not load your Economy ledger right now.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setMessage(null);
    try {
      setSnapshot(await load(true));
    } catch {
      setMessage('Could not refresh your Economy ledger.');
    } finally {
      setRefreshing(false);
    }
  }, [load, userId]);

  const available = snapshot?.points?.available_points ?? 0;
  const lifetime = snapshot?.points?.lifetime_points ?? snapshot?.points?.total_points ?? 0;
  const claimable = snapshot?.claimablePoints ?? 0;
  const spent = snapshot?.pointsSpent ?? 0;
  const poolPct = snapshot ? economyPoolSharePct(snapshot) : null;
  const qmp = snapshot ? economyQmpWeight(snapshot) : null;
  const estimatedPhp = snapshot ? economyEstimatedBayanihanPhp(snapshot) : null;
  const finalizedPhp = snapshot ? economyFinalizedBayanihanPhp(snapshot) : null;
  const withdrawable = snapshot?.financial?.earnings?.withdrawable_php
    ?? snapshot?.r38?.actual_earnings?.available_cash?.total
    ?? null;
  const reserved = snapshot?.financial?.earnings?.reserved_php
    ?? snapshot?.r38?.actual_earnings?.reserved_for_withdrawal
    ?? null;
  const rankName = snapshot?.rank.lifetime?.rank_name
    ?? profile?.role
    ?? 'BUKLOD Member';
  const communityName = snapshot?.financial?.community?.scope_name
    ?? snapshot?.community?.contribution_level
    ?? null;

  const needsAttention = useMemo(() => {
    const items: { key: string; title: string; body: string; action?: () => void; actionLabel?: string }[] = [];
    if (claimable > 0) {
      items.push({
        key: 'claim',
        title: `${formatEconomyPts(claimable)} pts ready to claim`,
        body: 'Completed activities are waiting in Claim Center.',
        action: () => router.push('/points' as any),
        actionLabel: 'Open Claims',
      });
    }
    if (Number(withdrawable ?? 0) > 0) {
      items.push({
        key: 'payout',
        title: `${formatEconomyPhp(withdrawable)} withdrawable Bayanihan`,
        body: 'Finalized Bayanihan cash is available for payout review.',
        action: () => router.push('/bayanihan/payout-profile' as any),
        actionLabel: 'Payout',
      });
    }
    if ((snapshot?.errors.length ?? 0) > 0) {
      items.push({
        key: 'partial',
        title: 'Some ledger sections could not load',
        body: snapshot?.errors.join(' ') ?? '',
        action: () => void refresh(),
        actionLabel: 'Retry',
      });
    }
    return items;
  }, [claimable, withdrawable, snapshot?.errors, refresh]);


  if (loading && !snapshot) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#275D45" />
        <Text style={styles.loadingText}>Loading your Economy ledger…</Text>
      </View>
    );
  }

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Character Points"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#275D45" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD ECONOMY & BAYANIHAN</Text>
          <Text style={styles.title}>Your ledger & action center</Text>
          <Text style={styles.subtitle}>
            Points, Pool/QMP share weight, and Bayanihan ₱ are separate. No conversion between them.
          </Text>
        </View>
      </View>

      <View style={styles.userCard}>
        <View style={styles.userArt}>
          <BuklodActiveCharacterArt
            fallbackCharacter={DEFAULT_CHARACTER}
            height={88}
            viewportWidth={64}
            showStage={false}
            showEffects={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{profile?.full_name || 'BUKLOD Member'}</Text>
          <Text style={styles.userMeta} numberOfLines={1}>
            {userId ? `ID ${userId.slice(0, 8)}…` : 'Signed out'}
            {communityName ? ` · ${communityName}` : ''}
          </Text>
          <Text style={styles.userMeta}>
            Circle Rank: {rankName}
            {snapshot?.characterName ? ` · ${snapshot.characterName}` : ''}
          </Text>
          <Text style={styles.userMeta}>
            Status: {profile?.is_active === false ? 'Inactive' : 'Active'}
            {snapshot?.loaded_at
              ? ` · Updated ${new Date(snapshot.loaded_at).toLocaleString('en-PH')}`
              : ''}
          </Text>
        </View>
      </View>

      <View style={styles.sectionRail}>
        {SECTIONS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setSection(item.key)}
            style={[styles.sectionChip, section === item.key && styles.sectionChipOn]}
          >
            <Text style={[styles.sectionChipText, section === item.key && styles.sectionChipTextOn]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {(section === 'overview' || section === 'actions') ? (
        <>
          <SectionCard
            title="Main Economy Summary"
            caption="Available Points are spendable. Lifetime Points never drop when you redeem."
          >
            <View style={styles.grid}>
              <Metric label="Available Points" value={formatEconomyPts(available)} emphasis />
              <Metric label="Lifetime Points Earned" value={formatEconomyPts(lifetime)} />
              <Metric label="Points Used / Spent" value={formatEconomyPts(spent)} />
              <Metric label="Pending / Claimable" value={formatEconomyPts(claimable)} />
              <Metric
                label="QMP Participation Share"
                value={poolPct == null ? '—' : `${poolPct.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`}
                note="Qualified participation only, not cash entitlement"
              />
              <Metric
                label="QMP Weight"
                value={qmp == null ? '—' : formatEconomyPts(qmp)}
                note="Qualified monthly participation weight"
              />
              <Metric
                label="Estimated Bayanihan ₱"
                value={estimatedPhp == null ? '—' : formatEconomyPhp(estimatedPhp)}
                note="Estimate only"
              />
              <Metric
                label="Finalized Bayanihan ₱"
                value={finalizedPhp == null ? '—' : formatEconomyPhp(finalizedPhp)}
                note="Funded / finalized"
                emphasis
              />
            </View>
          </SectionCard>

          <SectionCard title="Action Center" caption="Only real backed actions are active.">
            <View style={styles.actionGrid}>
              <ActionButton
                icon="gift-outline"
                label={claimable > 0 ? 'Go to BUKLOD Claim Center' : 'View BUKLOD Points'}
                onPress={() => router.push('/points' as any)}
              />
              <ActionButton
                icon="star-circle-outline"
                label="BUKLOD Claim Center"
                onPress={() => router.push('/points' as any)}
                tone="secondary"
              />
              <ActionButton
                icon="shopping-outline"
                label="Redeem Points"
                onPress={() => router.push('/points' as any)}
                tone="secondary"
              />
              <ActionButton
                icon="hand-heart-outline"
                label="Open Bayanihan"
                onPress={() => router.push('/bayanihan' as any)}
                tone="secondary"
              />
              <ActionButton
                icon="wallet-outline"
                label="Payout Profile"
                onPress={() => router.push('/bayanihan/payout-profile' as any)}
                tone="secondary"
              />
              <ActionButton
                icon="history"
                label="Withdrawals"
                onPress={() => router.push('/bayanihan/withdrawals' as any)}
                tone="secondary"
              />
              <ActionButton
                icon="format-list-bulleted"
                label="Transactions"
                onPress={() => setSection('transactions')}
                tone="secondary"
              />
              <ActionButton
                icon="alert-circle-outline"
                label="Report a Problem"
                onPress={() => router.push({
                  pathname: '/help' as any,
                  params: { category: 'FINANCIAL', sourceRoute: '/points/economy' },
                })}
                tone="secondary"
              />
            </View>
            <Text style={styles.unavailableNote}>
              Send Points, Donate Points, and Add Shares are not shown because no supported backend action exists for them in the current economy model.
            </Text>
          </SectionCard>

          {needsAttention.length ? (
            <SectionCard title="Needs Attention">
              {needsAttention.map((item) => (
                <View key={item.key} style={styles.attentionCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>{item.title}</Text>
                    <Text style={styles.attentionBody}>{item.body}</Text>
                  </View>
                  {item.action && item.actionLabel ? (
                    <ActionButton icon="arrow-right" label={item.actionLabel} onPress={item.action} tone="secondary" />
                  ) : null}
                </View>
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Recent Activity" caption="Latest Points ledger rows.">
            {(snapshot?.transactions ?? []).slice(0, 8).map((row) => (
              <Pressable key={row.id} style={styles.txnRow} onPress={() => setSelectedTxn(row)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle} numberOfLines={1}>{txnLabel(row)}</Text>
                  <Text style={styles.txnMeta}>{new Date(row.created_at).toLocaleString('en-PH')}</Text>
                </View>
                <Text style={[styles.txnPts, row.direction === 'debit' && styles.txnPtsDebit]}>
                  {row.direction === 'debit' ? '−' : '+'}{formatEconomyPts(row.points)}
                </Text>
              </Pressable>
            ))}
            <ActionButton
              icon="format-list-bulleted"
              label="View All Transactions"
              onPress={() => setSection('transactions')}
              tone="secondary"
            />
          </SectionCard>
        </>
      ) : null}

      {section === 'points' ? (
        <SectionCard
          title="Points Report"
          caption="Lifetime Points ≠ Available Points. Spending Available Points does not erase Lifetime / Circle Rank progress."
        >
          <View style={styles.grid}>
            <Metric label="Available" value={formatEconomyPts(available)} emphasis />
            <Metric label="Lifetime earned" value={formatEconomyPts(lifetime)} />
            <Metric label="Earned this week" value={formatEconomyPts(snapshot?.points?.weekly_points)} />
            <Metric label="Earned this month" value={formatEconomyPts(snapshot?.points?.monthly_points)} />
            <Metric label="Spent" value={formatEconomyPts(spent)} />
            <Metric label="Pending claimable" value={formatEconomyPts(claimable)} />
          </View>
          <Text style={styles.blockTitle}>Where my points came from</Text>
          {(snapshot?.sources.length ?? 0) === 0 ? (
            <Text style={styles.empty}>No credited points in the recent ledger window.</Text>
          ) : (
            snapshot?.sources.map((bucket) => (
              <View key={bucket.key} style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>{bucket.label}</Text>
                <Text style={styles.sourceValue}>{formatEconomyPts(bucket.points)} pts</Text>
              </View>
            ))
          )}
          <Text style={styles.blockTitle}>Where my points went</Text>
          <Text style={styles.empty}>
            {spent > 0
              ? `${formatEconomyPts(spent)} pts recorded as debits in your recent ledger window (redeem / spend).`
              : 'No spent/debit points in the recent ledger window.'}
          </Text>
        </SectionCard>
      ) : null}

      {section === 'shares' ? (
        <SectionCard
          title="Pool / QMP Shares"
          caption="“Shares” here means Pool participation and QMP weight — not cooperative certificates. Separate from Points and Bayanihan ₱."
        >
          <View style={styles.grid}>
            <Metric
              label="Pool Share"
              value={poolPct == null ? '—' : `${poolPct.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`}
              note="Estimated pool participation"
              emphasis
            />
            <Metric
              label="QMP Weight"
              value={qmp == null ? '—' : formatEconomyPts(qmp)}
              note="This period / qualified weight"
            />
            <Metric
              label="Estimated Bayanihan Value"
              value={estimatedPhp == null ? '—' : formatEconomyPhp(estimatedPhp)}
              note="Estimate only"
            />
            <Metric
              label="Finalized Bayanihan Value"
              value={finalizedPhp == null ? '—' : formatEconomyPhp(finalizedPhp)}
              note="Funded"
            />
            <Metric
              label="This month QMP"
              value={snapshot?.community ? formatEconomyPts(snapshot.community.this_month_qmp) : '—'}
            />
            <Metric
              label="Total qualified QMP"
              value={snapshot?.community
                ? formatEconomyPts(snapshot.community.total_qualified_qmp)
                : formatEconomyPts(snapshot?.financial?.progress?.total_qualified_monthly_points)}
            />
          </View>
          <Text style={styles.guardText}>
            There are no Regular Shares, Membership Shares, or Cooperative Shares in the current BUKLOD model.
          </Text>
        </SectionCard>
      ) : null}

      {section === 'bayanihan' ? (
        <SectionCard
          title="Bayanihan ₱"
          caption="Bayanihan cash comes only from finalized funded platform revenue — never from converting Points."
        >
          <View style={styles.grid}>
            <Metric
              label="Estimated"
              value={estimatedPhp == null ? '—' : formatEconomyPhp(estimatedPhp)}
              note="Not withdrawable yet"
            />
            <Metric
              label="Finalized"
              value={finalizedPhp == null ? '—' : formatEconomyPhp(finalizedPhp)}
              emphasis
            />
            <Metric
              label="Withdrawable"
              value={withdrawable == null ? '—' : formatEconomyPhp(withdrawable)}
            />
            <Metric
              label="Reserved"
              value={reserved == null ? '—' : formatEconomyPhp(reserved)}
            />
            <Metric
              label="Paid"
              value={formatEconomyPhp(snapshot?.financial?.earnings?.paid_php
                ?? snapshot?.r38?.actual_earnings?.paid_earnings?.total
                ?? 0)}
            />
            <Metric
              label="Community fund available"
              value={snapshot?.financial?.community?.available_fund_php == null
                ? '—'
                : formatEconomyPhp(snapshot.financial.community.available_fund_php)}
            />
          </View>
          <ActionButton
            icon="hand-heart-outline"
            label="Open Bayanihan Activity Area"
            onPress={() => router.push('/bayanihan' as any)}
          />
          <ActionButton
            icon="wallet-outline"
            label="Payout Profile"
            onPress={() => router.push('/bayanihan/payout-profile' as any)}
            tone="secondary"
          />
        </SectionCard>
      ) : null}

      {section === 'rewards' ? (
        <SectionCard title="Ready to Claim" caption="All BUKLOD Points claims use one verified Claim Center and the same optional ad opportunity.">
          <View style={styles.grid}>
            <Metric label="Claimable now" value={formatEconomyPts(claimable)} emphasis />
            <Metric label="Available after claim" value={formatEconomyPts(available)} />
            <Metric label="Groups ready" value={String(snapshot?.claimGroups.length ?? 0)} />
          </View>
          <ActionButton
            icon="gift-outline"
            label="OPEN BUKLOD POINTS CLAIM CENTER"
            onPress={() => router.push('/points' as any)}
          />
          {(snapshot?.claimGroups ?? []).map(group => (
            <View key={group.group_key} style={styles.claimCard}>
              <Text style={styles.claimTitle}>{group.group_label}</Text>
              <Text style={styles.claimMeta}>
                {group.event_count} completed · {formatEconomyPts(group.total_points)} points
              </Text>
            </View>
          ))}
          <Text style={styles.helpLine}>
            Claims and reward ads are not processed inside Economy & Bayanihan.
            The authoritative Claim Center handles every verified Points reward.
          </Text>
        </SectionCard>
      ) : null}

      {section === 'transactions' ? (
        <SectionCard title="Points Transaction History" caption="Running balance is computed from this ledger window only.">
          {(snapshot?.transactions ?? []).map((row) => (
            <Pressable key={row.id} style={styles.txnRow} onPress={() => setSelectedTxn(row)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnTitle} numberOfLines={2}>{txnLabel(row)}</Text>
                <Text style={styles.txnMeta}>
                  {new Date(row.created_at).toLocaleString('en-PH')}
                  {row.claim_state ? ` · ${row.claim_state}` : ''}
                  {row.running_balance != null ? ` · bal ${formatEconomyPts(row.running_balance)}` : ''}
                </Text>
              </View>
              <Text style={[styles.txnPts, row.direction === 'debit' && styles.txnPtsDebit]}>
                {row.direction === 'debit' ? '−' : '+'}{formatEconomyPts(row.points)}
              </Text>
            </Pressable>
          ))}
          {(snapshot?.transactions.length ?? 0) === 0 ? (
            <Text style={styles.empty}>No ledger rows yet.</Text>
          ) : null}
        </SectionCard>
      ) : null}

      {section === 'impact' ? (
        <SectionCard title="Impact Report" caption="Participation impact from available BUKLOD records.">
          <View style={styles.grid}>
            <Metric label="People reached" value={formatEconomyPts(snapshot?.impact?.people_reached)} />
            <Metric label="Gospel opened" value={formatEconomyPts(snapshot?.impact?.gospel_opened)} />
            <Metric label="Faith journeys" value={formatEconomyPts(snapshot?.impact?.faith_journeys_started)} />
            <Metric label="Growing in faith" value={formatEconomyPts(snapshot?.impact?.growing_in_faith)} />
            <Metric
              label="Qualified posts"
              value={snapshot?.community ? formatEconomyPts(snapshot.community.qualified_posts) : '—'}
            />
            <Metric
              label="Meaningful replies"
              value={snapshot?.community ? formatEconomyPts(snapshot.community.meaningful_replies) : '—'}
            />
          </View>
          <SectionCard title="Circle Rank Progress" caption="Lifetime Points drive rank. Available Points are separate.">
            <View style={styles.grid}>
              <Metric label="Current rank" value={rankName} emphasis />
              <Metric
                label="Points to next"
                value={formatEconomyPts(snapshot?.rank.lifetime?.points_to_next)}
              />
              <Metric
                label="Next rank"
                value={snapshot?.rank.lifetime?.next_rank_name ?? '—'}
              />
              <Metric
                label="Progress"
                value={`${formatEconomyPts(snapshot?.rank.lifetime?.progress_percent)}%`}
              />
            </View>
          </SectionCard>
          <ActionButton
            icon="heart-outline"
            label="Open Life Impact"
            onPress={() => router.push('/life/impact' as any)}
            tone="secondary"
          />
        </SectionCard>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {selectedTxn ? (
        <View style={styles.detailSheet}>
          <Text style={styles.detailTitle}>Transaction details</Text>
          <Text style={styles.helpLine}>ID: {selectedTxn.id}</Text>
          <Text style={styles.helpLine}>When: {new Date(selectedTxn.created_at).toLocaleString('en-PH')}</Text>
          <Text style={styles.helpLine}>Activity: {txnLabel(selectedTxn)}</Text>
          <Text style={styles.helpLine}>Source: {selectedTxn.activity_type}</Text>
          <Text style={styles.helpLine}>
            Amount: {selectedTxn.direction === 'debit' ? '−' : '+'}{formatEconomyPts(selectedTxn.points)} pts
          </Text>
          <Text style={styles.helpLine}>
            Running balance: {selectedTxn.running_balance == null ? '—' : `${formatEconomyPts(selectedTxn.running_balance)} pts`}
          </Text>
          <Text style={styles.helpLine}>Status: {selectedTxn.claim_state || selectedTxn.direction}</Text>
          <View style={styles.actionGrid}>
            <ActionButton icon="close" label="Close" onPress={() => setSelectedTxn(null)} tone="secondary" />
            <ActionButton
              icon="alert-circle-outline"
              label="Report Issue"
              onPress={() => router.push({
                pathname: '/help' as any,
                params: {
                  category: 'FINANCIAL',
                  sourceRoute: '/points/economy',
                  message: `Ledger txn ${selectedTxn.id}`,
                },
              })}
            />
          </View>
        </View>
      ) : null}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F2' },
  content: { padding: 14, paddingBottom: 48, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F4F7F2' },
  loadingText: { color: '#5E6C62', fontWeight: '700' },
  header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E7EFE6', borderWidth: 1, borderColor: '#D5E2D4',
  },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, color: '#275D45' },
  title: { marginTop: 2, fontSize: 20, fontWeight: '900', color: '#1F2A24' },
  subtitle: { marginTop: 4, fontSize: 12, lineHeight: 17, color: '#5E6C62' },
  userCard: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6DA',
  },
  userArt: { width: 72, height: 96, alignItems: 'center', justifyContent: 'flex-end' },
  userName: { fontSize: 16, fontWeight: '900', color: '#1F2A24' },
  userMeta: { marginTop: 3, fontSize: 11, color: '#5E6C62' },
  sectionRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6DA',
  },
  sectionChipOn: { backgroundColor: '#275D45', borderColor: '#275D45' },
  sectionChipText: { fontSize: 10, fontWeight: '900', color: '#275D45' },
  sectionChipTextOn: { color: '#FFFFFF' },
  section: {
    padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DDE6DA', gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1F2A24' },
  sectionCaption: { fontSize: 11, lineHeight: 16, color: '#5E6C62' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    width: '47%', minWidth: 140, flexGrow: 1, padding: 10, borderRadius: 12,
    backgroundColor: '#F7FAF5', borderWidth: 1, borderColor: '#E2EBDF',
  },
  metricEmphasis: { backgroundColor: '#EAF5E6', borderColor: '#C7DFC2' },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#1F2A24' },
  metricValueOn: { color: '#1F6B3F' },
  metricLabel: { marginTop: 3, fontSize: 10, fontWeight: '800', color: '#5E6C62' },
  metricNote: { marginTop: 2, fontSize: 9, color: '#7A877F' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    minHeight: 40, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
    backgroundColor: '#E8C56B', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  actionBtnSecondary: { backgroundColor: '#E7EFE6', borderWidth: 1, borderColor: '#C9D8C6' },
  actionBtnMuted: { backgroundColor: '#EEF1EE', borderWidth: 1, borderColor: '#D7DCD7', opacity: 0.85 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 10, fontWeight: '900', color: '#1A1406' },
  actionBtnTextAlt: { color: '#275D45' },
  unavailableNote: { fontSize: 11, lineHeight: 15, color: '#7A877F' },
  attentionCard: {
    flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10,
    borderRadius: 12, backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F0E0B4',
  },
  attentionTitle: { fontSize: 12, fontWeight: '900', color: '#8A6517' },
  attentionBody: { marginTop: 2, fontSize: 11, color: '#6E5A2A' },
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBDF',
  },
  txnTitle: { fontSize: 12, fontWeight: '800', color: '#1F2A24' },
  txnMeta: { marginTop: 2, fontSize: 10, color: '#7A877F' },
  txnPts: { fontSize: 13, fontWeight: '900', color: '#1F6B3F' },
  txnPtsDebit: { color: '#B42318' },
  blockTitle: { marginTop: 6, fontSize: 12, fontWeight: '900', color: '#275D45' },
  sourceRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBDF',
  },
  sourceLabel: { fontSize: 12, color: '#1F2A24', fontWeight: '700' },
  sourceValue: { fontSize: 12, fontWeight: '900', color: '#275D45' },
  empty: { fontSize: 12, color: '#7A877F', lineHeight: 17 },
  guardText: { fontSize: 11, lineHeight: 16, color: '#5E6C62', fontWeight: '700' },
  claimCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 12, backgroundColor: '#F7FAF5', borderWidth: 1, borderColor: '#E2EBDF',
  },
  claimTitle: { fontSize: 12, fontWeight: '900', color: '#1F2A24' },
  claimMeta: { marginTop: 2, fontSize: 10, color: '#5E6C62' },
  helpLine: { fontSize: 12, lineHeight: 18, color: '#5E6C62' },
  message: { fontSize: 12, fontWeight: '800', color: '#275D45' },
  detailSheet: {
    padding: 14, borderRadius: 16, backgroundColor: '#10182A', gap: 6,
  },
  detailTitle: { fontSize: 14, fontWeight: '900', color: '#F4E7C3', marginBottom: 4 },
});
