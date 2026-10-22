import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import { loadXlsxModule, shareWorkbook } from '@/lib/reports/export';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row = Record<string, any>;
type AccountFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type PointFilter = 'ALL' | 'HAS_POINTS' | 'PENDING' | 'REVIEW';

type PointSummary = {
  lifetime: number;
  available: number;
  pending: number;
  committedCredits: number;
  debits: number;
  ledgerEntries: number;
  pendingEntries: number;
  lifetimeMismatch: boolean;
  availableMismatch: boolean;
  status: 'OK' | 'REVIEW' | 'NO_ACTIVITY';
};

const numberValue = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value: unknown) =>
  numberValue(value).toLocaleString('en-PH', { maximumFractionDigits: 0 });

const formatDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};

async function fetchAllRows(
  table: string,
  columns: string,
  orderColumn: string,
): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];

  for (let from = 0; from < 100000; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message || `Could not read ${table}.`);

    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }

  throw new Error(`${table} exceeded the protected admin paging limit.`);
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {!!note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ status }: { status: PointSummary['status'] }) {
  const label =
    status === 'REVIEW'
      ? 'REVIEW'
      : status === 'NO_ACTIVITY'
        ? 'NO POINTS'
        : 'OK';

  return (
    <View
      style={[
        styles.statusPill,
        status === 'REVIEW' && styles.statusPillWarning,
        status === 'OK' && styles.statusPillOk,
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          status === 'REVIEW' && styles.statusPillTextWarning,
          status === 'OK' && styles.statusPillTextOk,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AdminMemberMasterScreen() {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [balances, setBalances] = useState<Row[]>([]);
  const [ledger, setLedger] = useState<Row[]>([]);
  const [scopes, setScopes] = useState<Row[]>([]);
  const [memberships, setMemberships] = useState<Row[]>([]);
  const [scopeRoles, setScopeRoles] = useState<Row[]>([]);

  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ALL');
  const [pointFilter, setPointFilter] = useState<PointFilter>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(100);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');

    try {
      const [
        profileRows,
        balanceRows,
        ledgerRows,
        scopeRows,
        membershipRows,
        roleRows,
      ] = await Promise.all([
        fetchAllRows(
          'profiles',
          'id,full_name,username,login_identifier,role,is_active,is_verified,created_at,updated_at',
          'id',
        ),
        fetchAllRows(
          'buklod_user_points_balances',
          'user_id,lifetime_points,available_points,updated_at',
          'user_id',
        ),
        fetchAllRows(
          'buklod_points_ledger',
          'id,user_id,direction,points,activity_type,source_key,source_id,description,created_at,claim_state,formation_stage_code',
          'id',
        ),
        fetchAllRows(
          'buklod_scopes',
          'id,scope_type,name,status,parent_scope_id,organization_id',
          'id',
        ),
        fetchAllRows(
          'buklod_scope_memberships',
          'id,scope_id,user_id,membership_status,membership_source,joined_at,left_at,created_at,updated_at',
          'id',
        ),
        fetchAllRows(
          'buklod_scope_role_assignments',
          'id,scope_id,user_id,role_key,status,created_at,updated_at,revoked_at',
          'id',
        ),
      ]);

      setProfiles(profileRows);
      setBalances(balanceRows);
      setLedger(ledgerRows);
      setScopes(scopeRows);
      setMemberships(membershipRows);
      setScopeRoles(roleRows);
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Could not load Member Master.',
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

  const profileMap = useMemo(
    () => new Map(profiles.map((row) => [String(row.id), row])),
    [profiles],
  );

  const scopeMap = useMemo(
    () => new Map(scopes.map((row) => [String(row.id), row])),
    [scopes],
  );

  const balanceMap = useMemo(
    () => new Map(balances.map((row) => [String(row.user_id), row])),
    [balances],
  );

  const ledgerByUser = useMemo(() => {
    const map = new Map<string, Row[]>();

    for (const row of ledger) {
      const userId = String(row.user_id ?? '');
      if (!userId) continue;
      const current = map.get(userId) ?? [];
      current.push(row);
      map.set(userId, current);
    }

    for (const rows of map.values()) {
      rows.sort(
        (a, b) =>
          new Date(String(b.created_at ?? 0)).getTime() -
          new Date(String(a.created_at ?? 0)).getTime(),
      );
    }

    return map;
  }, [ledger]);

  const membershipsByUser = useMemo(() => {
    const map = new Map<string, Row[]>();

    for (const row of memberships) {
      const userId = String(row.user_id ?? '');
      if (!userId) continue;
      const current = map.get(userId) ?? [];
      current.push(row);
      map.set(userId, current);
    }

    return map;
  }, [memberships]);

  const rolesByUser = useMemo(() => {
    const map = new Map<string, Row[]>();

    for (const row of scopeRoles) {
      const userId = String(row.user_id ?? '');
      if (!userId) continue;
      const current = map.get(userId) ?? [];
      current.push(row);
      map.set(userId, current);
    }

    return map;
  }, [scopeRoles]);

  const pointSummaryMap = useMemo(() => {
    const map = new Map<string, PointSummary>();

    for (const profile of profiles) {
      const userId = String(profile.id);
      const balance = balanceMap.get(userId);
      const userLedger = ledgerByUser.get(userId) ?? [];

      let committedCredits = 0;
      let pending = 0;
      let debits = 0;
      let pendingEntries = 0;

      for (const row of userLedger) {
        const points = numberValue(row.points);
        const direction = String(row.direction ?? '').toLowerCase();
        const claimState = String(row.claim_state ?? '').toLowerCase();

        if (direction === 'credit' && ['claimed', 'legacy'].includes(claimState)) {
          committedCredits += points;
        } else if (direction === 'credit' && claimState === 'pending') {
          pending += points;
          pendingEntries += 1;
        } else if (direction === 'debit') {
          debits += points;
        }
      }

      const lifetime = numberValue(balance?.lifetime_points);
      const available = numberValue(balance?.available_points);
      const lifetimeMismatch = lifetime !== committedCredits;
      const availableMismatch = available !== committedCredits - debits;
      const hasActivity =
        lifetime !== 0 ||
        available !== 0 ||
        pending !== 0 ||
        userLedger.length !== 0;

      map.set(userId, {
        lifetime,
        available,
        pending,
        committedCredits,
        debits,
        ledgerEntries: userLedger.length,
        pendingEntries,
        lifetimeMismatch,
        availableMismatch,
        status:
          lifetimeMismatch || availableMismatch
            ? 'REVIEW'
            : hasActivity
              ? 'OK'
              : 'NO_ACTIVITY',
      });
    }

    return map;
  }, [profiles, balanceMap, ledgerByUser]);

  const totals = useMemo(() => {
    let lifetime = 0;
    let available = 0;
    let pending = 0;
    let reviewMembers = 0;
    let membersWithPoints = 0;

    for (const summary of pointSummaryMap.values()) {
      lifetime += summary.lifetime;
      available += summary.available;
      pending += summary.pending;
      if (summary.status === 'REVIEW') reviewMembers += 1;
      if (summary.status !== 'NO_ACTIVITY') membersWithPoints += 1;
    }

    return {
      lifetime,
      available,
      pending,
      reviewMembers,
      membersWithPoints,
    };
  }, [pointSummaryMap]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return profiles
      .filter((profile) => {
        if (accountFilter === 'ACTIVE' && profile.is_active !== true) return false;
        if (accountFilter === 'INACTIVE' && profile.is_active === true) return false;

        const summary = pointSummaryMap.get(String(profile.id));
        if (pointFilter === 'HAS_POINTS' && summary?.status === 'NO_ACTIVITY') return false;
        if (pointFilter === 'PENDING' && !summary?.pending) return false;
        if (pointFilter === 'REVIEW' && summary?.status !== 'REVIEW') return false;

        if (!needle) return true;

        return [
          profile.full_name,
          profile.username,
          profile.login_identifier,
          profile.id,
        ].some((value) => String(value ?? '').toLowerCase().includes(needle));
      })
      .sort((a, b) =>
        String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')),
      );
  }, [profiles, search, accountFilter, pointFilter, pointSummaryMap]);

  useEffect(() => {
    setVisibleLimit(100);
  }, [search, accountFilter, pointFilter]);

  const selectedProfile = selectedUserId
    ? profileMap.get(selectedUserId) ?? null
    : null;
  const selectedSummary = selectedUserId
    ? pointSummaryMap.get(selectedUserId) ?? null
    : null;
  const selectedLedger = selectedUserId
    ? ledgerByUser.get(selectedUserId) ?? []
    : [];
  const selectedMemberships = selectedUserId
    ? membershipsByUser.get(selectedUserId) ?? []
    : [];
  const selectedRoles = selectedUserId
    ? rolesByUser.get(selectedUserId) ?? []
    : [];

  const exportAudit = async () => {
    setExporting(true);

    try {
      const XLSX = await loadXlsxModule();
      const workbook = XLSX.utils.book_new();

      const memberRows = filteredMembers.map((profile) => {
        const userId = String(profile.id);
        const summary = pointSummaryMap.get(userId);
        const activeMemberships = (membershipsByUser.get(userId) ?? [])
          .filter((row) => String(row.membership_status).toUpperCase() === 'ACTIVE')
          .map((row) => {
            const scope = scopeMap.get(String(row.scope_id));
            return scope
              ? `${scope.scope_type}: ${scope.name}`
              : String(row.scope_id);
          })
          .join(' | ');

        const activeRoles = (rolesByUser.get(userId) ?? [])
          .filter((row) => String(row.status).toUpperCase() === 'ACTIVE')
          .map((row) => {
            const scope = scopeMap.get(String(row.scope_id));
            return `${row.role_key}${scope ? ` @ ${scope.name}` : ''}`;
          })
          .join(' | ');

        return {
          'Member ID': userId,
          'Member Name': profile.full_name || '',
          Username: profile.username || '',
          'Account Status': profile.is_active ? 'ACTIVE' : 'INACTIVE',
          Verified: profile.is_verified ? 'YES' : 'NO',
          'Active Scope Memberships': activeMemberships,
          'Active Scope Roles': activeRoles,
          'Lifetime Points': summary?.lifetime ?? 0,
          'Available Points': summary?.available ?? 0,
          'Pending Claimable': summary?.pending ?? 0,
          'Committed Ledger Credits': summary?.committedCredits ?? 0,
          'Ledger Debits': summary?.debits ?? 0,
          'Ledger Entries': summary?.ledgerEntries ?? 0,
          'Point Audit': summary?.status ?? 'NO_ACTIVITY',
          'Lifetime Match': summary?.lifetimeMismatch ? 'NO' : 'YES',
          'Available Match': summary?.availableMismatch ? 'NO' : 'YES',
        };
      });

      const ledgerRows = filteredMembers.flatMap((profile) => {
        const userId = String(profile.id);
        return (ledgerByUser.get(userId) ?? []).map((row) => ({
          Date: row.created_at || '',
          'Member ID': userId,
          'Member Name': profile.full_name || '',
          Direction: row.direction || '',
          Points:
            String(row.direction).toLowerCase() === 'debit'
              ? -numberValue(row.points)
              : numberValue(row.points),
          'Claim State': row.claim_state || '',
          Activity: row.activity_type || '',
          Description: row.description || '',
          'Source Key': row.source_key || '',
        }));
      });

      const scopeRows = filteredMembers.flatMap((profile) => {
        const userId = String(profile.id);
        return (membershipsByUser.get(userId) ?? []).map((row) => {
          const scope = scopeMap.get(String(row.scope_id));
          return {
            'Member ID': userId,
            'Member Name': profile.full_name || '',
            'Scope Type': scope?.scope_type || '',
            Scope: scope?.name || row.scope_id || '',
            Status: row.membership_status || '',
            Source: row.membership_source || '',
            Joined: row.joined_at || '',
            Left: row.left_at || '',
          };
        });
      });

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(memberRows.length ? memberRows : [{ Info: 'No members match the filter.' }]),
        'Member Point Audit',
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(ledgerRows.length ? ledgerRows : [{ Info: 'No point ledger rows match the filter.' }]),
        'Point Ledger',
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(scopeRows.length ? scopeRows : [{ Info: 'No scope memberships match the filter.' }]),
        'Scope Memberships',
      );

      await shareWorkbook(
        `buklod-member-point-audit-${new Date().toISOString().slice(0, 10)}.xlsx`,
        workbook,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.greenDark} />
          <Text style={styles.backText}>ADMIN</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SYSTEM ADMIN · PEOPLE</Text>
            <Text style={shared.h1}>Member Master & Point Audit</Text>
            <Text style={shared.muted}>
              Canonical BUKLOD member directory, Organization/Cluster memberships,
              scoped roles and per-member Points accounting.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="account-search-outline"
            size={30}
            color={colors.greenDark}
          />
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={22}
            color={colors.greenDark}
          />
          <Text style={styles.noticeText}>
            This page is member and Points audit only. Learning, Daily Bible,
            Attendance, Giving and other operational reports stay in their own
            report modules. Points remain separate from Bayanihan cash.
          </Text>
        </View>

        {loading && !profiles.length ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={shared.muted}>Loading canonical member records…</Text>
          </View>
        ) : error && !profiles.length ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorTitle}>Member Master unavailable</Text>
            <Text style={shared.muted}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <Metric label="Members" value={profiles.length.toLocaleString('en-PH')} />
              <Metric
                label="Members with Point Activity"
                value={totals.membersWithPoints.toLocaleString('en-PH')}
              />
              <Metric
                label="Lifetime Points"
                value={totals.lifetime.toLocaleString('en-PH')}
              />
              <Metric
                label="Available Points"
                value={totals.available.toLocaleString('en-PH')}
              />
              <Metric
                label="Pending Claimable"
                value={totals.pending.toLocaleString('en-PH')}
              />
              <Metric
                label="Point Audit Review"
                value={totals.reviewMembers.toLocaleString('en-PH')}
                note={totals.reviewMembers ? 'Balance mismatch detected' : 'No balance mismatch'}
              />
            </View>

            <View style={styles.filtersCard}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search member name, username or member ID"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
              />

              <Text style={styles.filterLabel}>ACCOUNT</Text>
              <View style={styles.chipRow}>
                {(['ALL', 'ACTIVE', 'INACTIVE'] as AccountFilter[]).map((value) => (
                  <FilterChip
                    key={value}
                    label={value === 'ALL' ? 'All Accounts' : value}
                    active={accountFilter === value}
                    onPress={() => setAccountFilter(value)}
                  />
                ))}
              </View>

              <Text style={styles.filterLabel}>POINT STATUS</Text>
              <View style={styles.chipRow}>
                <FilterChip
                  label="All"
                  active={pointFilter === 'ALL'}
                  onPress={() => setPointFilter('ALL')}
                />
                <FilterChip
                  label="Has Points"
                  active={pointFilter === 'HAS_POINTS'}
                  onPress={() => setPointFilter('HAS_POINTS')}
                />
                <FilterChip
                  label="Pending Claim"
                  active={pointFilter === 'PENDING'}
                  onPress={() => setPointFilter('PENDING')}
                />
                <FilterChip
                  label="Needs Review"
                  active={pointFilter === 'REVIEW'}
                  onPress={() => setPointFilter('REVIEW')}
                />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>MEMBER DIRECTORY</Text>
                <Text style={styles.sectionTitle}>
                  {filteredMembers.length.toLocaleString('en-PH')} matching members
                </Text>
              </View>
              <Pressable
                onPress={() => void exportAudit()}
                disabled={exporting}
                style={[styles.exportButton, exporting && { opacity: 0.55 }]}
              >
                <MaterialCommunityIcons
                  name="file-excel-outline"
                  size={17}
                  color={colors.greenDark}
                />
                <Text style={styles.exportText}>
                  {exporting ? 'EXPORTING…' : 'EXPORT AUDIT'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.memberList}>
              {filteredMembers.slice(0, visibleLimit).map((profile) => {
                const userId = String(profile.id);
                const summary =
                  pointSummaryMap.get(userId) ?? {
                    lifetime: 0,
                    available: 0,
                    pending: 0,
                    committedCredits: 0,
                    debits: 0,
                    ledgerEntries: 0,
                    pendingEntries: 0,
                    lifetimeMismatch: false,
                    availableMismatch: false,
                    status: 'NO_ACTIVITY' as const,
                  };
                const activeScopes = (membershipsByUser.get(userId) ?? []).filter(
                  (row) =>
                    String(row.membership_status).toUpperCase() === 'ACTIVE',
                );

                return (
                  <Pressable
                    key={userId}
                    onPress={() => setSelectedUserId(userId)}
                    style={[
                      styles.memberCard,
                      selectedUserId === userId && styles.memberCardSelected,
                    ]}
                  >
                    <View style={styles.memberHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {profile.full_name || 'Unnamed Member'}
                        </Text>
                        <Text style={styles.memberMeta}>
                          {profile.username ? `@${profile.username} · ` : ''}
                          {profile.is_active ? 'ACTIVE' : 'INACTIVE'} · {activeScopes.length} active scope{activeScopes.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <StatusPill status={summary.status} />
                    </View>

                    <View style={styles.memberPointRow}>
                      <Text style={styles.memberPoint}>
                        Lifetime {formatNumber(summary.lifetime)}
                      </Text>
                      <Text style={styles.memberPoint}>
                        Available {formatNumber(summary.available)}
                      </Text>
                      <Text style={styles.memberPoint}>
                        Pending {formatNumber(summary.pending)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {visibleLimit < filteredMembers.length ? (
              <Pressable
                onPress={() => setVisibleLimit((current) => current + 100)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>SHOW MORE MEMBERS</Text>
              </Pressable>
            ) : null}

            {selectedProfile && selectedSummary ? (
              <View style={styles.detailSection}>
                <View style={styles.detailHero}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionEyebrow}>SELECTED MEMBER</Text>
                    <Text style={styles.detailName}>
                      {selectedProfile.full_name || 'Unnamed Member'}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {selectedProfile.username ? `@${selectedProfile.username} · ` : ''}
                      {selectedProfile.is_active ? 'ACTIVE' : 'INACTIVE'} · joined {formatDate(selectedProfile.created_at)}
                    </Text>
                  </View>
                  <StatusPill status={selectedSummary.status} />
                </View>

                <View style={styles.grid}>
                  <Metric
                    label="Lifetime"
                    value={formatNumber(selectedSummary.lifetime)}
                    note="Claimed + legacy credits"
                  />
                  <Metric
                    label="Available"
                    value={formatNumber(selectedSummary.available)}
                    note="Current spendable Points"
                  />
                  <Metric
                    label="Pending Claimable"
                    value={formatNumber(selectedSummary.pending)}
                    note={`${selectedSummary.pendingEntries} pending entries`}
                  />
                  <Metric
                    label="Committed Credits"
                    value={formatNumber(selectedSummary.committedCredits)}
                  />
                  <Metric
                    label="Debits"
                    value={formatNumber(selectedSummary.debits)}
                  />
                  <Metric
                    label="Ledger Entries"
                    value={selectedSummary.ledgerEntries.toLocaleString('en-PH')}
                  />
                </View>

                <View
                  style={[
                    styles.auditCard,
                    selectedSummary.status === 'REVIEW' && styles.auditCardWarning,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      selectedSummary.status === 'REVIEW'
                        ? 'alert-circle-outline'
                        : 'check-decagram-outline'
                    }
                    size={21}
                    color={
                      selectedSummary.status === 'REVIEW'
                        ? '#8A5B19'
                        : colors.greenDark
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.auditTitle}>POINT BALANCE AUDIT</Text>
                    <Text style={styles.auditText}>
                      Lifetime balance {selectedSummary.lifetimeMismatch ? 'DOES NOT MATCH' : 'matches'} claimed/legacy credits. Available balance {selectedSummary.availableMismatch ? 'DOES NOT MATCH' : 'matches'} committed credits minus debits.
                    </Text>
                  </View>
                </View>

                <View style={styles.twoColumn}>
                  <View style={styles.detailCard}>
                    <Text style={styles.cardTitle}>Scope memberships</Text>
                    {selectedMemberships.length ? (
                      selectedMemberships.map((row) => {
                        const scope = scopeMap.get(String(row.scope_id));
                        return (
                          <View key={String(row.id)} style={styles.detailRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailRowTitle}>
                                {scope?.name || 'Unknown scope'}
                              </Text>
                              <Text style={styles.detailRowMeta}>
                                {scope?.scope_type || 'SCOPE'} · {row.membership_status || 'UNKNOWN'}
                              </Text>
                            </View>
                            <Text style={styles.smallDate}>
                              {row.joined_at ? formatDate(row.joined_at) : ''}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No scope membership records.</Text>
                    )}
                  </View>

                  <View style={styles.detailCard}>
                    <Text style={styles.cardTitle}>Scoped roles</Text>
                    {selectedRoles.length ? (
                      selectedRoles.map((row) => {
                        const scope = scopeMap.get(String(row.scope_id));
                        return (
                          <View key={String(row.id)} style={styles.detailRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailRowTitle}>
                                {String(row.role_key || 'ROLE').replace(/_/g, ' ')}
                              </Text>
                              <Text style={styles.detailRowMeta}>
                                {scope?.name || 'Unknown scope'} · {row.status || 'UNKNOWN'}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No scoped-role records.</Text>
                    )}
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.cardTitle}>Point ledger</Text>
                  <Text style={styles.cardHint}>
                    Latest 80 entries · Pending is not yet part of Lifetime or Available Points.
                  </Text>

                  {selectedLedger.length ? (
                    selectedLedger.slice(0, 80).map((row) => {
                      const isDebit = String(row.direction).toLowerCase() === 'debit';
                      return (
                        <View key={String(row.id)} style={styles.ledgerRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerActivity}>
                              {String(row.activity_type || 'Point activity').replace(/_/g, ' ')}
                            </Text>
                            <Text style={styles.ledgerMeta}>
                              {String(row.claim_state || 'unknown').toUpperCase()} · {formatDate(row.created_at)}
                            </Text>
                            {!!row.description && (
                              <Text style={styles.ledgerDescription}>
                                {String(row.description)}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.ledgerPoints,
                              isDebit && styles.ledgerPointsDebit,
                            ]}
                          >
                            {isDebit ? '−' : '+'}{formatNumber(row.points)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No point ledger activity.</Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.selectHint}>
                <MaterialCommunityIcons
                  name="cursor-default-click-outline"
                  size={20}
                  color={colors.greenDark}
                />
                <Text style={styles.selectHintText}>
                  Select a member above to open the individual Point Audit.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 100, gap: 14 },
  backRow: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.7,
  },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.greenDark,
    marginBottom: 4,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D5E7DC',
    backgroundColor: '#EEF8F2',
  },
  noticeText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.muted,
  },
  loadingCard: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 20,
  },
  errorTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    minWidth: 145,
    flexGrow: 1,
    flexBasis: '30%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  metricValue: { fontSize: 16, fontWeight: '900', color: colors.greenDark },
  metricLabel: { marginTop: 4, fontSize: 9.5, fontWeight: '800', color: colors.text },
  metricNote: { marginTop: 2, fontSize: 8.5, lineHeight: 12, color: colors.muted },
  filtersCard: {
    gap: 9,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  searchInput: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAFCFB',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 11,
  },
  filterLabel: {
    marginTop: 2,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { borderColor: '#9BC6AA', backgroundColor: '#E8F4EC' },
  chipText: { fontSize: 9.5, fontWeight: '800', color: colors.muted },
  chipTextActive: { color: colors.greenDark },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.muted,
  },
  sectionTitle: { marginTop: 2, fontSize: 17, fontWeight: '900', color: colors.text },
  exportButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDCC9',
    backgroundColor: '#EEF8F2',
  },
  exportText: { fontSize: 9, fontWeight: '900', color: colors.greenDark },
  memberList: { gap: 7 },
  memberCard: {
    padding: 12,
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  memberCardSelected: { borderColor: '#74A887', backgroundColor: '#F4FAF6' },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { fontSize: 12.5, fontWeight: '900', color: colors.text },
  memberMeta: { marginTop: 2, fontSize: 9, color: colors.muted },
  memberPointRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  memberPoint: { fontSize: 9.5, fontWeight: '800', color: colors.greenDark },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EDF0EE',
  },
  statusPillOk: { backgroundColor: '#DCFCE7' },
  statusPillWarning: { backgroundColor: '#FFF2CC' },
  statusPillText: { fontSize: 8, fontWeight: '900', color: colors.muted },
  statusPillTextOk: { color: '#166534' },
  statusPillTextWarning: { color: '#8A5B19' },
  primaryButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.greenDark,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  secondaryButtonText: { fontSize: 9.5, fontWeight: '900', color: colors.greenDark },
  detailSection: { gap: 10, marginTop: 4 },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#173B2F',
  },
  detailName: { marginTop: 2, fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  detailMeta: { marginTop: 3, fontSize: 9.5, color: 'rgba(255,255,255,0.75)' },
  auditCard: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDCC9',
    backgroundColor: '#EEF8F2',
  },
  auditCardWarning: { borderColor: '#E8D0A2', backgroundColor: '#FFF8EA' },
  auditTitle: { fontSize: 9.5, fontWeight: '900', color: colors.text },
  auditText: { marginTop: 2, fontSize: 9.5, lineHeight: 14, color: colors.muted },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 260,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  cardTitle: { fontSize: 12, fontWeight: '900', color: colors.text },
  cardHint: { marginTop: 2, marginBottom: 4, fontSize: 8.5, color: colors.muted },
  detailRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  detailRowTitle: { fontSize: 10, fontWeight: '800', color: colors.text },
  detailRowMeta: { marginTop: 2, fontSize: 8.5, color: colors.muted },
  smallDate: { maxWidth: 120, fontSize: 8, color: colors.muted, textAlign: 'right' },
  ledgerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 6,
  },
  ledgerActivity: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'capitalize',
  },
  ledgerMeta: { marginTop: 2, fontSize: 8.5, color: colors.muted },
  ledgerDescription: { marginTop: 2, fontSize: 8.5, lineHeight: 12, color: colors.muted },
  ledgerPoints: { fontSize: 12, fontWeight: '900', color: '#166534' },
  ledgerPointsDebit: { color: '#991B1B' },
  emptyText: { marginTop: 7, fontSize: 9.5, lineHeight: 14, color: colors.muted },
  selectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  selectHintText: { flex: 1, fontSize: 10, color: colors.muted },
});
