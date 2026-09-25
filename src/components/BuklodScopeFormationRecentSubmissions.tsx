import React, {
  useCallback,
  useEffect,
  useMemo,
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
  why?: string | null;
  automatic_feedback?: string | null;
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

function manilaDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return 'UNKNOWN';

  return date.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function dayLabel(key: string) {
  if (key === 'UNKNOWN') return 'Unknown date';

  const today = manilaDateKey(new Date());
  const yesterday = manilaDateKey(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';

  const date = new Date(`${key}T12:00:00+08:00`);

  return date.toLocaleDateString(undefined, {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function submittedLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString(undefined, {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isMissingRpc(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

export default function BuklodScopeFormationRecentSubmissions({
  scopeId,
}: {
  scopeId: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<
    Record<string, boolean>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let result = await (supabase as any).rpc(
        'buklod_scope_formation_submission_history_v2',
        {
          p_scope_id: scopeId,
          p_limit: 150,
        },
      );

      if (
        result.error &&
        isMissingRpc(String(result.error?.message ?? ''))
      ) {
        result = await (supabase as any).rpc(
          'buklod_scope_formation_submission_history_v1',
          {
            p_scope_id: scopeId,
            p_limit: 150,
          },
        );
      }

      if (result.error) {
        throw result.error;
      }

      const nextRows = Array.isArray(result.data)
        ? (result.data as Row[])
        : [];

      setRows(nextRows);

      const today = manilaDateKey(new Date());
      setExpandedDays((current) => ({
        ...current,
        [today]:
          current[today] == null
            ? true
            : current[today],
      }));
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

  const groups = useMemo(() => {
    const byDay = new Map<string, Row[]>();

    for (const row of rows) {
      const key = manilaDateKey(row.submitted_at);
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }

    return Array.from(byDay.entries()).map(
      ([dateKey, dayRows]) => {
        const byKind = new Map<string, Row[]>();

        for (const row of dayRows) {
          byKind.set(
            row.item_kind,
            [...(byKind.get(row.item_kind) ?? []), row]
          );
        }

        return {
          dateKey,
          rows: dayRows,
          kinds: Array.from(byKind.entries()).map(
            ([kind, kindRows]) => ({
              kind,
              rows: kindRows,
            })
          ),
        };
      }
    );
  }, [rows]);

  return (
    <Card>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Latest Formation activity
          </Text>
          <Text style={shared.muted}>
            Grouped by day and activity. Open a day to see
            names, status, and revision reasons.
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
            Loading recent submissions…
          </Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : groups.length ? (
        <View style={styles.dayList}>
          {groups.map((group) => {
            const expanded =
              expandedDays[group.dateKey] ??
              group.dateKey === manilaDateKey(new Date());

            return (
              <View
                key={group.dateKey}
                style={styles.dayGroup}
              >
                <Pressable
                  style={styles.dayHeader}
                  onPress={() =>
                    setExpandedDays((current) => ({
                      ...current,
                      [group.dateKey]: !expanded,
                    }))
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayTitle}>
                      {dayLabel(group.dateKey)}
                    </Text>
                    <Text style={styles.dayMeta}>
                      {group.rows.length} submission
                      {group.rows.length === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name={
                      expanded
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={20}
                    color={colors.greenDark}
                  />
                </Pressable>

                {expanded ? (
                  <View style={styles.kindList}>
                    {group.kinds.map((kindGroup) => (
                      <View
                        key={kindGroup.kind}
                        style={styles.kindGroup}
                      >
                        <View style={styles.kindHeader}>
                          <Text style={styles.kindTitle}>
                            {kindLabel(kindGroup.kind)}
                          </Text>
                          <Text style={styles.kindCount}>
                            {kindGroup.rows.length}
                          </Text>
                        </View>

                        <View style={styles.list}>
                          {kindGroup.rows.map((row) => {
                            const canOpen =
                              row.item_kind ===
                              'DAILY_READING';
                            const needsRevision =
                              row.status === 'REJECTED';

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
                                      submissionId:
                                        row.item_id,
                                      scopeId:
                                        row.scope_id,
                                      approvalId:
                                        row.approval_id,
                                    },
                                  });
                                }}
                                style={({ pressed }) => [
                                  styles.row,
                                  needsRevision &&
                                    styles.rowRevision,
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
                                    {row.title}
                                  </Text>

                                  {!!row.subtitle && (
                                    <Text
                                      style={styles.meta}
                                    >
                                      {row.subtitle}
                                    </Text>
                                  )}

                                  <Text style={styles.time}>
                                    Submitted{' '}
                                    {submittedLabel(
                                      row.submitted_at
                                    )}
                                  </Text>

                                  {needsRevision &&
                                  row.why?.trim() ? (
                                    <View
                                      style={styles.reasonBox}
                                    >
                                      <Text
                                        style={
                                          styles.reasonLabel
                                        }
                                      >
                                        WHY
                                      </Text>
                                      <Text
                                        style={
                                          styles.reasonText
                                        }
                                      >
                                        {row.why}
                                      </Text>

                                      {row.automatic_feedback?.trim() &&
                                      row.automatic_feedback !==
                                        row.why ? (
                                        <>
                                          <Text
                                            style={
                                              styles.feedbackLabel
                                            }
                                          >
                                            AUTO FEEDBACK
                                          </Text>
                                          <Text
                                            style={
                                              styles.feedbackText
                                            }
                                          >
                                            {
                                              row.automatic_feedback
                                            }
                                          </Text>
                                        </>
                                      ) : null}
                                    </View>
                                  ) : null}
                                </View>

                                <View style={styles.status}>
                                  <Text
                                    style={[
                                      styles.statusText,
                                      needsRevision &&
                                        styles.statusRevision,
                                    ]}
                                  >
                                    {statusLabel(
                                      row.status
                                    )}
                                  </Text>

                                  {canOpen ? (
                                    <MaterialCommunityIcons
                                      name="chevron-right"
                                      size={20}
                                      color={
                                        colors.greenDark
                                      }
                                    />
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
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
  dayList: {
    marginTop: 12,
    gap: 10,
  },
  dayGroup: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAF9',
  },
  dayHeader: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayTitle: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
  },
  dayMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  kindList: {
    borderTopWidth: 1,
    borderTopColor: '#E8EFEA',
    padding: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  kindGroup: {
    gap: 7,
  },
  kindHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindTitle: {
    color: '#476055',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  kindCount: {
    minWidth: 22,
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  list: {
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.white,
  },
  rowRevision: {
    borderColor: '#F0C9C4',
    backgroundColor: '#FFFAF9',
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
  reasonBox: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#FFF1EF',
    padding: 9,
    gap: 3,
  },
  reasonLabel: {
    color: '#B3261E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  reasonText: {
    color: '#6C2A24',
    fontSize: 10,
    lineHeight: 15,
  },
  feedbackLabel: {
    marginTop: 5,
    color: '#31528A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedbackText: {
    color: '#263A5B',
    fontSize: 10,
    lineHeight: 15,
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
  statusRevision: {
    color: '#B3261E',
  },
});
