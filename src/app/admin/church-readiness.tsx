import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import {
  fetchChurchReadinessSummary,
  type ChurchReadinessRow,
  type ChurchReadinessSummary,
} from '@/lib/buklodChurchFinder';

const LABELS: Record<ChurchReadinessRow['bucket'], string> = {
  ready: 'Ready',
  missing_pastor_mentor: 'Missing Pastor/Mentor',
  missing_map: 'Missing Map Location',
  private_invite: 'Private/Invite Only',
  pending_setup: 'Pending Setup',
};

export default function ChurchReadinessAdminScreen() {
  const [summary, setSummary] = useState<ChurchReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      setSummary(await fetchChurchReadinessSummary());
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not load church readiness.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
          />
        }
      >
        <Text style={styles.title}>Church Readiness</Text>
        <Text style={styles.subtitle}>
          Churches need a Pastor or Mentor and a map location before they
          count as accountability-ready for Nearby discovery.
        </Text>

        {loading ? (
          <ActivityIndicator color="#2D6A4F" />
        ) : error ? (
          <Text style={styles.warn}>{error}</Text>
        ) : summary ? (
          <>
            <View style={styles.counts}>
              <CountCard label="Ready" value={summary.ready} />
              <CountCard
                label="Missing Pastor-Mentor"
                value={summary.missing_pastor_mentor}
              />
              <CountCard label="Missing Map" value={summary.missing_map} />
              <CountCard
                label="Private / Invite"
                value={summary.private_invite}
              />
              <CountCard label="Pending Setup" value={summary.pending_setup} />
            </View>

            {summary.rows.map((row) => (
              <Pressable
                key={row.scope_id}
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/churches/[id]' as any,
                    params: { id: row.scope_id },
                  } as any)
                }
              >
                <Text style={styles.name}>{row.scope_name}</Text>
                <Text style={styles.meta}>
                  {LABELS[row.bucket]}
                  {row.accountability_ready ? ' • Accountability Ready' : ''}
                  {row.has_map ? '' : ' • No map pin'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </AdminGate>
  );
}

function CountCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.countCard}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#19362A',
  },
  subtitle: {
    color: '#66756D',
    lineHeight: 20,
  },
  warn: {
    color: '#8A5A12',
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countCard: {
    width: '31%',
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 12,
    padding: 10,
  },
  countValue: {
    fontWeight: '900',
    fontSize: 20,
    color: '#19362A',
  },
  countLabel: {
    color: '#66756D',
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  name: {
    fontWeight: '900',
    color: '#1A3329',
  },
  meta: {
    color: '#748079',
    fontSize: 12,
  },
});
