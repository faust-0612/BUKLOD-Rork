import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row = {
  approval_id: string;
  scope_id: string;
  scope_name: string;
  item_kind: string;
  item_id: string;
  learner_id: string;
  learner_name: string;
  title: string;
  subtitle: string | null;
  submitted_at: string;
  decided_at: string | null;
  status: string;
};

function kindLabel(value: string) {
  if (value === 'DAILY_READING') return 'Daily Reading';
  if (value === 'DAILY_DEVOTION') return 'Daily Devotion';
  if (value === 'LESSON') return 'BUKLOD Lesson';
  return String(value || 'Submission').replace(/_/g, ' ');
}

function statusLabel(value: string) {
  if (value === 'APPROVED') return 'APPROVED';
  if (value === 'REJECTED') return 'NEEDS REVISION';
  if (value === 'EVALUATING') return 'CHECKING';
  if (value === 'PENDING') return 'CHECKING';
  return String(value || 'UNKNOWN').replace(/_/g, ' ');
}

function submittedLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString();
}

export default function BuklodScopeFormationRecentSubmissions({
  scopeId,
}: {
  scopeId: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result =
        await (supabase as any).rpc(
          'buklod_scope_formation_submission_history_v1',
          {
            p_scope_id: scopeId,
            p_limit: 100,
          },
        );

      if (result.error) {
        throw result.error;
      }

      setRows(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (loadError: any) {
      setRows([]);
      setError(
        String(
          loadError?.message ??
            'Could not load recent submissions.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Latest Formation activity
          </Text>
          <Text style={shared.muted}>
            Shows who submitted, what they submitted,
            when it was submitted, and the current result.
          </Text>
        </View>

        <Pressable
          onPress={() => void load()}
          style={styles.refresh}
          accessibilityLabel="Refresh recent submissions"
        >
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color={colors.greenDark}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>
            Loading recent submissionsâ€¦
          </Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : rows.length ? (
        <View style={styles.list}>
          {rows.map(row => {
            const canOpen =
              row.item_kind === 'DAILY_READING';

            return (
              <Pressable
                key={row.approval_id}
                disabled={!canOpen}
                onPress={() => {
                  if (!canOpen) return;

                  router.push({
                    pathname:
                      '/scope/faith-monitoring/daily-reading/[submissionId]' as any,
                    params: {
                      submissionId: row.item_id,
                      scopeId: row.scope_id,
                      approvalId: row.approval_id,
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed &&
                  canOpen &&
                  styles.rowPressed,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {row.learner_name}
                  </Text>

                  <Text style={styles.meta}>
                    {kindLabel(row.item_kind)}
                    {' Â· '}
                    {row.title}
                  </Text>

                  {!!row.subtitle && (
                    <Text style={styles.meta}>
                      {row.subtitle}
                    </Text>
                  )}

                  <Text style={styles.time}>
                    {row.scope_name}
                    {' Â· Submitted '}
                    {submittedLabel(row.submitted_at)}
                  </Text>
                </View>

                <View style={styles.status}>
                  <Text style={styles.statusText}>
                    {statusLabel(row.status)}
                  </Text>

                  {canOpen ? (
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.greenDark}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={shared.muted}>
          No recent Formation submissions yet.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  refresh: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  loading: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  error: {
    marginTop: 12,
    color: '#B3261E',
    fontSize: 11,
    lineHeight: 17,
  },
  list: {
    marginTop: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
  },
  rowPressed: {
    opacity: 0.72,
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  time: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  status: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  statusText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'right',
  },
});