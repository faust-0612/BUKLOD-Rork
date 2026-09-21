import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';
import { fetchMyActionableReportAssignments } from '@/lib/buklodReportDomain';
import {
  loadBuklodOrganizationWorkspaceRuntime,
} from '@/lib/buklodOrganizationWorkspaceRuntime';

type CalendarItem = {
  id: string;
  source: 'EVENTS' | 'REPORTS';
  title: string;
  at: string;
  subtitle?: string | null;
  route: string;
};

export default function OrganizationCalendarScreen() {
  const params = useLocalSearchParams();
  const scopeId = readOrganizationScopeId(
    params as Record<string, unknown>,
  );
  const [name, setName] = useState('Organization');
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }

    try {
      const runtime =
        await loadBuklodOrganizationWorkspaceRuntime(scopeId);
      setName(runtime.scope.name);

      const [eventsResult, reportsResult] =
        await Promise.allSettled([
          supabase
            .from('attendance_events')
            .select('id,title,starts_at,ends_at,location')
            .eq('scope_id', scopeId)
            .gte(
              'starts_at',
              new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            )
            .order('starts_at', { ascending: true })
            .limit(100),
          fetchMyActionableReportAssignments(100, scopeId),
        ]);

      const next: CalendarItem[] = [];
      const failures: string[] = [];

      if (
        eventsResult.status === 'fulfilled' &&
        !eventsResult.value.error
      ) {
        for (const row of eventsResult.value.data ?? []) {
          next.push({
            id: `event:${row.id}`,
            source: 'EVENTS',
            title: row.title,
            at: row.starts_at,
            subtitle: row.location,
            route:
              `/organizations/events-attendance?organization=${encodeURIComponent(
                scopeId,
              )}`,
          });
        }
      } else {
        failures.push('Events');
      }

      if (reportsResult.status === 'fulfilled') {
        for (const row of reportsResult.value) {
          if (!row.deadline_at) continue;
          next.push({
            id: `report:${row.report_assignment_id}`,
            source: 'REPORTS',
            title: row.report_title || 'Report',
            at: row.deadline_at,
            subtitle:
              row.period_label || 'Report deadline',
            route:
              `/reports?scope_id=${encodeURIComponent(
                scopeId,
              )}`,
          });
        }
      } else {
        failures.push('Reports');
      }

      next.sort(
        (a, b) =>
          new Date(a.at).getTime() -
          new Date(b.at).getTime(),
      );

      setItems(next);
      setFailedSources(failures);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const date = new Date(item.at);
      const key = Number.isNaN(date.getTime())
        ? 'Unscheduled'
        : date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
      const rows = map.get(key) ?? [];
      rows.push(item);
      map.set(key, rows);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={20}
          color={colors.greenDark}
        />
        <Text style={styles.backText}>
          Back to Organization
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          UNIFIED CALENDAR
        </Text>
        <Text style={styles.title}>
          {name}
        </Text>
        <Text style={styles.subtitle}>
          Authorized Organization dates are aggregated here. Each item remains
          owned by its original module.
        </Text>
      </View>

      {failedSources.length > 0 && (
        <View style={styles.warning}>
          <MaterialCommunityIcons
            name="alert-outline"
            size={19}
            color="#7B5C15"
          />
          <Text style={styles.warningText}>
            {failedSources.join(' and ')} could not be loaded. Other calendar
            sources are still available.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>
            Loading Organization calendar…
          </Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="calendar-blank-outline"
            size={36}
            color={colors.muted}
          />
          <Text style={styles.emptyTitle}>
            No upcoming Organization dates.
          </Text>
          <Text style={styles.emptyText}>
            Events and authorized Report deadlines will appear here when
            available.
          </Text>
        </View>
      ) : (
        <View style={styles.groups}>
          {grouped.map(([date, rows]) => (
            <View key={date} style={styles.day}>
              <Text style={styles.dayTitle}>
                {date}
              </Text>
              {rows.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push(item.route as any)
                  }
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.sourceIcon}>
                    <MaterialCommunityIcons
                      name={
                        item.source === 'EVENTS'
                          ? 'calendar-star'
                          : 'file-clock-outline'
                      }
                      size={20}
                      color={colors.greenDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemSource}>
                      {item.source}
                    </Text>
                    <Text style={styles.itemTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {new Date(item.at).toLocaleTimeString(
                        undefined,
                        {
                          hour: 'numeric',
                          minute: '2-digit',
                        },
                      )}
                      {item.subtitle
                        ? ` • ${item.subtitle}`
                        : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    padding: 18,
    paddingBottom: 42,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  header: {
    marginTop: 8,
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  warning: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7D39E',
    borderRadius: 12,
    backgroundColor: '#FFF8E8',
    padding: 11,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    color: '#6D571E',
    fontSize: 12,
    lineHeight: 17,
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    minHeight: 190,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  groups: {
    gap: 15,
  },
  day: {
    gap: 7,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  item: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#EAF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSource: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  itemTitle: {
    marginTop: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  itemMeta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
  },
});
