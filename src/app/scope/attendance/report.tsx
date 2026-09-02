import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { BuklodAttendanceReportCharts } from '@/components/attendance/BuklodAttendanceReportCharts';
import { BuklodAttendanceReportNarrative } from '@/components/attendance/BuklodAttendanceReportNarrative';
import { BuklodSyncStatusBadge } from '@/components/BuklodSyncStatusBadge';
import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useAttendancePermissions } from '@/hooks/useAttendancePermissions';
import { useAttendanceWorkspaceScope } from '@/hooks/useAttendanceWorkspaceScope';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import {
  attendanceRecordsToCsvRows,
  buildReportDataset,
  fetchScopeAttendanceRecords,
  generateAttendanceNarrative,
} from '@/lib/attendance';
import type {
  AttendanceMethod,
  AttendanceScopeFilter,
  AttendanceStatus,
  NormalizedAttendanceRecord,
} from '@/lib/attendance';
import {
  attendanceReportCacheKey,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { scopeRouteParams } from '@/lib/buklodScopeManage';
import { shareCsv } from '@/lib/reports/export';
import { supabase } from '@/lib/supabase';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return localDateString(date);
}

const STATUS_OPTIONS: Array<AttendanceStatus | 'all'> = [
  'all',
  'present',
  'late',
  'absent',
  'excused',
];

const METHOD_OPTIONS: Array<AttendanceMethod | 'all'> = [
  'all',
  'qr',
  'face',
  'device_biometric',
  'manual',
  'cluster_self',
];

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

type AttendanceReportCache = {
  records: NormalizedAttendanceRecord[];
  fetchedAt: string;
};

export default function ScopeAttendanceReportScreen() {
  const params = useLocalSearchParams();
  const eventId = firstString(params.eventId);
  const eventTitle = firstString(params.eventTitle);
  const eventSeriesTitle =
    firstString(params.eventSeriesTitle) || '';
  const anchorEventId = firstString(params.anchorEventId);
  const seriesMode = Boolean(eventSeriesTitle) && !eventId;

  const { workspaceScope, access, scopesLoading } =
    useAttendanceWorkspaceScope();
  const { canOperateScope, canManageEvent } =
    useAttendancePermissions(workspaceScope);

  const [eventCreatorId, setEventCreatorId] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(defaultFromDate);
  const [dateTo, setDateTo] = useState(localDateString());
  const [memberQuery, setMemberQuery] = useState('');
  const [status, setStatus] = useState<AttendanceStatus | 'all'>('all');
  const [method, setMethod] = useState<AttendanceMethod | 'all'>('all');
  const [verified, setVerified] = useState<'all' | 'verified' | 'unverified'>(
    'all'
  );
  const [exporting, setExporting] = useState(false);

  const permissionEventId = eventId || anchorEventId;

  const canViewReport =
    canOperateScope ||
    (permissionEventId
      ? canManageEvent({ created_by: eventCreatorId })
      : false);

  const reportCacheKey = useMemo(() => {
    if (!workspaceScope?.scope_id) {
      return '';
    }

    return attendanceReportCacheKey(
      workspaceScope.scope_id,
      dateFrom,
      dateTo,
      eventId || 'all',
      seriesMode ? eventSeriesTitle : ''
    );
  }, [
    workspaceScope?.scope_id,
    dateFrom,
    dateTo,
    eventId,
    eventSeriesTitle,
    seriesMode,
  ]);

  const {
    data: reportCache,
    loading,
    refreshing,
    syncing,
    fromCache,
    online,
    refresh,
    error: loadError,
  } = useBuklodOfflineCache<AttendanceReportCache>({
    cacheKey: reportCacheKey,
    enabled: Boolean(workspaceScope?.scope_id && canViewReport && reportCacheKey),
    fetcher: async () => {
      if (!workspaceScope?.scope_id) {
        return { records: [], fetchedAt: new Date().toISOString() };
      }

      const records = await fetchScopeAttendanceRecords({
        scopeId: workspaceScope.scope_id,
        scopeType: workspaceScope.scope_type,
        dateFrom,
        dateTo,
        isAdmin: canViewReport,
        eventId: seriesMode ? null : eventId || null,
        eventTitle: seriesMode ? eventSeriesTitle : null,
      });

      return {
        records,
        fetchedAt: new Date().toISOString(),
      };
    },
  });

  const rawRecords = reportCache?.records ?? [];

  const syncStatus = useMemo((): BuklodSyncStatus | null => {
    if (syncing) {
      return 'syncing';
    }

    if (!online && reportCache) {
      return 'saved_offline';
    }

    if (fromCache && online) {
      return 'waiting_to_sync';
    }

    if (reportCache && !fromCache) {
      return 'synced';
    }

    return null;
  }, [syncing, online, fromCache, reportCache]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewReport || fromCache) {
        return;
      }

      void refresh();
    }, [canViewReport, fromCache, refresh])
  );

  useFocusEffect(
    useCallback(() => {
      if (!permissionEventId) {
        setEventCreatorId(null);
        return;
      }

      let cancelled = false;

      void (async () => {
        const { data } = await supabase
          .from('attendance_events')
          .select('created_by')
          .eq('id', permissionEventId)
          .maybeSingle();

        if (!cancelled) {
          setEventCreatorId(
            String(data?.created_by ?? '').trim() || null
          );
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [permissionEventId])
  );

  const filters: AttendanceScopeFilter | null = useMemo(() => {
    if (!workspaceScope?.scope_id) {
      return null;
    }

    const memberMatch = memberQuery.trim().toLowerCase();
    const memberId =
      memberMatch.length > 0
        ? rawRecords.find(row =>
            `${row.full_name ?? ''} ${row.user_id}`
              .toLowerCase()
              .includes(memberMatch)
          )?.user_id ?? '__no_match__'
        : null;

    return {
      scopeId: workspaceScope.scope_id,
      scopeType:
        workspaceScope.scope_type === 'CLUSTER'
          ? 'CLUSTER'
          : workspaceScope.parent_scope_id
            ? 'SUB_ORGANIZATION'
            : 'ORGANIZATION',
      dateFrom,
      dateTo,
      memberId,
      status,
      method,
      verified,
      eventId: seriesMode ? null : eventId || null,
      eventTitle: seriesMode ? eventSeriesTitle : null,
    };
  }, [
    workspaceScope,
    dateFrom,
    dateTo,
    memberQuery,
    method,
    rawRecords,
    status,
    verified,
    eventId,
    eventSeriesTitle,
    seriesMode,
  ]);

  const sessionCount = useMemo(() => {
    if (!seriesMode) {
      return null;
    }

    return new Set(
      rawRecords
        .map(row => row.event_id)
        .filter(Boolean)
    ).size;
  }, [rawRecords, seriesMode]);

  const dataset = useMemo(() => {
    if (!filters) {
      return null;
    }

    return buildReportDataset(rawRecords, filters);
  }, [filters, rawRecords]);

  const narrative = useMemo(
    () => (dataset ? generateAttendanceNarrative(dataset) : []),
    [dataset]
  );

  const exportReport = useCallback(async () => {
    if (!dataset || !workspaceScope?.scope_id) {
      return;
    }

    setExporting(true);

    try {
      const rows = attendanceRecordsToCsvRows(dataset.records);
      const safeName = workspaceScope.name
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

      await shareCsv(
        `attendance-report-${safeName || 'scope'}-${dateFrom}-to-${dateTo}.csv`,
        rows
      );
    } catch (error) {
      Alert.alert(
        'Export',
        String(
          (error as Error)?.message ?? 'Could not export attendance report.'
        )
      );
    } finally {
      setExporting(false);
    }
  }, [dataset, workspaceScope?.name, workspaceScope?.scope_id, dateFrom, dateTo]);

  if (scopesLoading) {
    return (
      <View style={styles.center}>
        <Text style={shared.muted}>Loading attendance report...</Text>
      </View>
    );
  }

  if (
    access !== 'authorized' ||
    !workspaceScope ||
    !['ORGANIZATION', 'CLUSTER'].includes(workspaceScope.scope_type)
  ) {
    return (
      <View style={styles.center}>
        <Text style={shared.h2}>Report unavailable</Text>
        <Text style={shared.muted}>
          Open an Organization or Cluster scope first.
        </Text>
      </View>
    );
  }

  if (!canViewReport) {
    return (
      <View style={styles.center}>
        <Text style={shared.h2}>Report access required</Text>
        <Text style={shared.muted}>
          Attendance reports are limited to the event creator, attendance
          operator, or scope admin.
        </Text>
      </View>
    );
  }

  return (
    <BuklodScopedWorkspaceScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void refresh();
          }}
        />
      }
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Attendance Report</Text>
          <Text style={shared.muted}>{workspaceScope.name}</Text>
          {!!eventTitle && !seriesMode && (
            <Text style={styles.eventContext}>
              Event: {eventTitle}
            </Text>
          )}
          {seriesMode && (
            <Text style={styles.eventContext}>
              All sessions: {eventSeriesTitle}
            </Text>
          )}
          {syncStatus ? (
            <View style={styles.syncRow}>
              <BuklodSyncStatusBadge status={syncStatus} compact />
              {reportCache?.fetchedAt ? (
                <Text style={styles.syncMeta}>
                  Last updated {new Date(reportCache.fetchedAt).toLocaleString()}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.exportBtn,
            (exporting || !dataset || dataset.records.length === 0) &&
              styles.exportBtnDisabled,
          ]}
          disabled={exporting || !dataset || dataset.records.length === 0}
          onPress={() => void exportReport()}
          accessibilityLabel="Export attendance report"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.greenDark} />
          ) : (
            <MaterialCommunityIcons
              name="export-variant"
              size={20}
              color={colors.greenDark}
            />
          )}
        </Pressable>
      </View>

      {!!loadError && (
        <Card>
          <Text style={shared.muted}>{loadError}</Text>
        </Card>
      )}

      {!!eventId && (
        <Card>
          <Text style={styles.eventContext}>
            Showing report and analytics for one attendance session only.
            Check-in data is preserved when the session is closed or refreshed.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/scope/attendance/report',
                params: scopeRouteParams(workspaceScope.scope_id),
              } as any)
            }
            style={styles.clearEventFilter}
          >
            <Text style={styles.clearEventFilterText}>
              VIEW ALL EVENTS IN RANGE
            </Text>
          </Pressable>
        </Card>
      )}

      {seriesMode && (
        <Card>
          <Text style={styles.eventContext}>
            Combined analytics for every session named "{eventSeriesTitle}"
            between {dateFrom} and {dateTo}.
            {sessionCount != null
              ? ` ${sessionCount} session${sessionCount === 1 ? '' : 's'} found.`
              : ''}{' '}
            Pull down to refresh. Older sessions stay saved when you refresh
            attendance for a new date.
          </Text>
          {!!anchorEventId && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/scope/attendance/report',
                  params: scopeRouteParams(workspaceScope.scope_id, {
                    eventId: anchorEventId,
                    eventTitle: eventSeriesTitle,
                  }),
                } as any)
              }
              style={styles.clearEventFilter}
            >
              <Text style={styles.clearEventFilterText}>
                VIEW ONE SESSION ONLY
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      <SectionTitle>FILTERS</SectionTitle>
      <Card>
        <Text style={styles.label}>From</Text>
        <TextInput
          style={styles.input}
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Text style={styles.label}>To</Text>
        <TextInput
          style={styles.input}
          value={dateTo}
          onChangeText={setDateTo}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Member search</Text>
        <TextInput
          style={styles.input}
          value={memberQuery}
          onChangeText={setMemberQuery}
          placeholder="Name or member id fragment"
        />

        <Text style={styles.label}>Status</Text>
        <View style={styles.chips}>
          {STATUS_OPTIONS.map(option => (
            <Pressable
              key={option}
              onPress={() => setStatus(option)}
              style={[styles.chip, status === option && styles.chipOn]}
            >
              <Text
                style={[
                  styles.chipText,
                  status === option && styles.chipTextOn,
                ]}
              >
                {option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Method</Text>
        <View style={styles.chips}>
          {METHOD_OPTIONS.map(option => (
            <Pressable
              key={option}
              onPress={() => setMethod(option)}
              style={[styles.chip, method === option && styles.chipOn]}
            >
              <Text
                style={[
                  styles.chipText,
                  method === option && styles.chipTextOn,
                ]}
              >
                {option.replaceAll('_', ' ').toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Verification</Text>
        <View style={styles.chips}>
          {(['all', 'verified', 'unverified'] as const).map(option => (
            <Pressable
              key={option}
              onPress={() => setVerified(option)}
              style={[styles.chip, verified === option && styles.chipOn]}
            >
              <Text
                style={[
                  styles.chipText,
                  verified === option && styles.chipTextOn,
                ]}
              >
                {option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading || !dataset ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>Building report...</Text>
        </View>
      ) : (
        <>
          <SectionTitle>SUMMARY METRICS</SectionTitle>
          <View style={styles.stats}>
            <Metric
              label="RECORDS"
              value={dataset.metrics.totalRecords}
            />
            <Metric
              label="PARTICIPANTS"
              value={dataset.metrics.uniqueParticipants}
            />
            <Metric
              label="RATE"
              value={`${dataset.metrics.attendanceRate}%`}
            />
          </View>

          <SectionTitle>CHARTS</SectionTitle>
          <Card>
            <BuklodAttendanceReportCharts metrics={dataset.metrics} />
          </Card>

          <SectionTitle>NARRATIVE</SectionTitle>
          <BuklodAttendanceReportNarrative sections={narrative} />

          <SectionTitle>ATTENDANCE LOG</SectionTitle>
          {dataset.records.length === 0 ? (
            <Card>
              <Text style={shared.muted}>
                No records for the selected filters.
              </Text>
            </Card>
          ) : (
            dataset.records.map(row => (
              <View key={row.id} style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logName}>
                    {resolvePersonDisplayName(
                      row.full_name,
                      row.user_id,
                    )}
                  </Text>
                  <Text style={styles.logMeta}>
                    {row.local_date} • {row.event_title || row.source} •{' '}
                    {row.status.toUpperCase()} •{' '}
                    {row.method.replaceAll('_', ' ')} •{' '}
                    {row.verified ? 'verified' : 'unverified'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </BuklodScopedWorkspaceScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  exportBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  exportBtnDisabled: {
    opacity: 0.45,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  syncMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 9,
    color: colors.text,
    backgroundColor: colors.white,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.muted,
  },
  chipTextOn: {
    color: colors.greenDark,
  },
  loading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.greenDark,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '900',
    color: colors.muted,
  },
  logRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 7,
    backgroundColor: colors.white,
  },
  logName: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  logMeta: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: colors.muted,
  },
  eventContext: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    color: colors.greenDark,
  },
  clearEventFilter: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.greenSoft,
  },
  clearEventFilterText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
  },
});
