import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { ScopeHomeSummary } from '@/lib/buklodScopeMembers';

type Props = {
  scopeId: string;
  summary: ScopeHomeSummary | null;
  isAdmin: boolean;
};

type OverviewData = {
  units: number | null;
  announcements: number | null;
  upcomingEvents: Array<{
    id: string;
    title: string;
    starts_at: string;
  }>;
};

const EMPTY: OverviewData = {
  units: null,
  announcements: null,
  upcomingEvents: [],
};

export default function BuklodInstitutionOverviewSummary({
  scopeId,
  summary,
  isAdmin,
}: Props) {
  const [data, setData] = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);

    const now = new Date().toISOString();
    const [units, announcements, events] =
      await Promise.allSettled([
        supabase
          .from('buklod_scopes')
          .select('id', { count: 'exact', head: true })
          .eq('parent_scope_id', scopeId)
          .eq('scope_type', 'ORGANIZATION')
          .neq('status', 'DELETED'),
        supabase
          .from('buklod_scope_bulletins')
          .select('id', { count: 'exact', head: true })
          .eq('scope_id', scopeId)
          .eq('is_published', true),
        supabase
          .from('attendance_events')
          .select('id,title,starts_at')
          .eq('scope_id', scopeId)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(3),
      ]);

    setData({
      units:
        units.status === 'fulfilled' &&
        !units.value.error
          ? Number(units.value.count ?? 0)
          : null,
      announcements:
        announcements.status === 'fulfilled' &&
        !announcements.value.error
          ? Number(announcements.value.count ?? 0)
          : null,
      upcomingEvents:
        events.status === 'fulfilled' &&
        !events.value.error
          ? (events.value.data ?? [])
          : [],
    });
    setLoading(false);
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View>
          <Text style={styles.eyebrow}>
            ORGANIZATION OVERVIEW
          </Text>
          <Text style={styles.title}>
            What is happening here?
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.green}
          />
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat
          value={summary?.active_members ?? null}
          label="ACTIVE MEMBERS"
        />
        <Stat
          value={data.units}
          label="UNITS"
        />
        <Stat
          value={data.announcements}
          label="ANNOUNCEMENTS"
        />
        <Stat
          value={data.upcomingEvents.length}
          label="UPCOMING"
        />
      </View>

      <View style={styles.upcoming}>
        <View style={styles.rowHead}>
          <Text style={styles.sectionTitle}>
            UPCOMING
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/organizations/module' as any,
                params: {
                  scopeId,
                  module: 'calendar',
                },
              })
            }
          >
            <Text style={styles.link}>
              CALENDAR
            </Text>
          </Pressable>
        </View>

        {data.upcomingEvents.length === 0 ? (
          <Text style={styles.empty}>
            No upcoming events.
          </Text>
        ) : (
          data.upcomingEvents.map(event => (
            <Pressable
              key={event.id}
              onPress={() =>
                router.push({
                  pathname:
                    '/organizations/module' as any,
                  params: {
                    scopeId,
                    module: 'events',
                  },
                })
              }
              style={styles.eventRow}
            >
              <View style={styles.eventIcon}>
                <MaterialCommunityIcons
                  name="calendar-star"
                  size={18}
                  color={colors.greenDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={styles.eventTitle}
                >
                  {event.title}
                </Text>
                <Text style={styles.eventDate}>
                  {new Date(
                    event.starts_at,
                  ).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {isAdmin &&
      Number(summary?.pending_join_requests ?? 0) > 0 ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname:
                '/organizations/join-requests' as any,
              params: {
                organization: scopeId,
                scopeId,
              },
            })
          }
          style={styles.notice}
        >
          <MaterialCommunityIcons
            name="account-clock-outline"
            size={20}
            color="#8A5A00"
          />
          <Text style={styles.noticeText}>
            {summary?.pending_join_requests} membership request(s) need review.
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={19}
            color="#8A5A00"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value == null ? '—' : value.toLocaleString()}
      </Text>
      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#D7E3DB',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  stat: {
    minWidth: 100,
    flexGrow: 1,
    borderRadius: 11,
    backgroundColor: '#F3F7F4',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statValue: {
    color: colors.greenDark,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  upcoming: {
    gap: 5,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  link: {
    color: colors.greenDark,
    fontSize: 9.5,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    fontSize: 11.5,
  },
  eventRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4EAE6',
    paddingTop: 6,
  },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#EAF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '900',
  },
  eventDate: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9.5,
  },
  notice: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FFF7E5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  noticeText: {
    flex: 1,
    color: '#72551A',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
