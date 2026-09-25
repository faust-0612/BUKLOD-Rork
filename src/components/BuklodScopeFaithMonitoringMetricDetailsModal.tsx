import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { fetchScopeMembers } from '@/lib/buklodScopeMembers';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export type FaithMonitoringMetricKey =
  | 'OVERVIEW_ACTIVE_MEMBERS'
  | 'DAILY_READING_SUBMITTED_TODAY'
  | 'DAILY_READING_APPROVED_TODAY'
  | 'DAILY_READING_CHECKING'
  | 'DAILY_READING_NEEDS_REVISION'
  | 'DAILY_READING_NOT_SUBMITTED'
  | 'DEVOTION_SUBMITTED_TODAY'
  | 'DEVOTION_APPROVED_TODAY'
  | 'DEVOTION_CHECKING'
  | 'DEVOTION_NEEDS_REVISION'
  | 'DEVOTION_NOT_COMPLETED'
  | 'LESSON_SUBMITTED_TODAY'
  | 'LESSON_APPROVED_TODAY'
  | 'LESSON_CHECKING'
  | 'LESSON_NEEDS_REVISION'
  | 'LESSON_ACTIVITY'
  | 'LESSON_NOT_STARTED';

type DetailRow = {
  user_id: string;
  member_name: string;
  avatar_url: string | null;
  status: string;
  item_kind: string;
  item_id: string | null;
  title: string;
  submitted_at: string | null;
  why: string;
  automatic_feedback: string;
};

type Props = {
  visible: boolean;
  scopeId: string;
  metric: FaithMonitoringMetricKey | null;
  title: string;
  onClose: () => void;
};

function formatWhen(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BuklodScopeFaithMonitoringMetricDetailsModal({
  visible,
  scopeId,
  metric,
  title,
  onClose,
}: Props) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!visible || !metric || !scopeId) return;

    setLoading(true);
    setError(null);

    try {
      if (metric === 'OVERVIEW_ACTIVE_MEMBERS') {
        const members = await fetchScopeMembers({
          scopeId,
          status: 'ACTIVE',
          limit: 250,
        });

        setRows(
          members.map((member) => ({
            user_id: member.user_id,
            member_name:
              member.full_name?.trim() || 'BUKLOD Member',
            avatar_url: member.avatar_url ?? null,
            status: 'ACTIVE',
            item_kind: 'OVERVIEW',
            item_id: null,
            title: 'Active member',
            submitted_at: null,
            why: 'Active member of this workspace.',
            automatic_feedback: '',
          }))
        );
        return;
      }

      const result = await (supabase as any).rpc(
        'buklod_scope_faith_monitoring_metric_details_v1',
        {
          p_scope_id: scopeId,
          p_metric: metric,
        }
      );

      if (result.error) {
        throw result.error;
      }

      setRows(
        Array.isArray(result.data)
          ? (result.data as DetailRow[])
          : []
      );
    } catch (loadError: any) {
      setRows([]);
      setError(
        String(
          loadError?.message ??
            'Could not load report details.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [metric, scopeId, visible]);

  useEffect(() => {
    void load();
  }, [load]);

  const revisionCount = useMemo(
    () =>
      rows.filter(
        (row) => row.status === 'REJECTED'
      ).length,
    [rows]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                REPORT DETAILS
              </Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {rows.length} member{rows.length === 1 ? '' : 's'}
                {revisionCount > 0
                  ? ` · ${revisionCount} need${revisionCount === 1 ? 's' : ''} revision`
                  : ''}
              </Text>
            </View>

            <Pressable
              style={styles.close}
              onPress={onClose}
              accessibilityLabel="Close details"
            >
              <MaterialCommunityIcons
                name="close"
                size={21}
                color={colors.greenDark}
              />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={styles.muted}>
                Loading specifics…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Pressable style={styles.retry} onPress={() => void load()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : rows.length ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {rows.map((row, index) => {
                const needsRevision =
                  row.status === 'REJECTED';

                return (
                  <View
                    key={`${row.user_id}-${row.item_id ?? index}-${index}`}
                    style={styles.row}
                  >
                    <View style={styles.rowHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {row.member_name}
                        </Text>
                        <Text style={styles.itemTitle}>
                          {row.title}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          needsRevision &&
                            styles.statusPillRevision,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            needsRevision &&
                              styles.statusTextRevision,
                          ]}
                        >
                          {row.status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>

                    {row.submitted_at ? (
                      <Text style={styles.when}>
                        {formatWhen(row.submitted_at)}
                      </Text>
                    ) : null}

                    <View
                      style={[
                        styles.reasonBox,
                        needsRevision &&
                          styles.reasonBoxRevision,
                      ]}
                    >
                      <Text style={styles.reasonLabel}>
                        WHY
                      </Text>
                      <Text style={styles.reasonText}>
                        {row.why ||
                          'No additional reason recorded.'}
                      </Text>
                    </View>

                    {row.automatic_feedback ? (
                      <View style={styles.feedbackBox}>
                        <Text style={styles.feedbackLabel}>
                          AUTOMATIC FEEDBACK
                        </Text>
                        <Text style={styles.feedbackText}>
                          {row.automatic_feedback}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="account-search-outline"
                size={30}
                color={colors.muted}
              />
              <Text style={styles.muted}>
                No members match this metric right now.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 31, 24, 0.28)',
  },
  sheet: {
    maxHeight: '86%',
    minHeight: '44%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EFEA',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 3,
    color: colors.greenDark,
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAF9',
  },
  center: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  muted: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  error: {
    color: '#B3261E',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  retry: {
    borderRadius: 10,
    backgroundColor: colors.green,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  scroll: {
    flexGrow: 0,
  },
  list: {
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  itemTitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillRevision: {
    backgroundColor: '#FDECEC',
  },
  statusText: {
    color: colors.greenDark,
    fontSize: 8,
    fontWeight: '900',
  },
  statusTextRevision: {
    color: '#B3261E',
  },
  when: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  reasonBox: {
    borderRadius: 11,
    backgroundColor: '#F8FAF9',
    padding: 10,
    gap: 3,
  },
  reasonBoxRevision: {
    backgroundColor: '#FFF7F6',
  },
  reasonLabel: {
    color: colors.greenDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reasonText: {
    color: '#173B2F',
    fontSize: 10,
    lineHeight: 15,
  },
  feedbackBox: {
    borderRadius: 11,
    backgroundColor: '#F3F7FF',
    padding: 10,
    gap: 3,
  },
  feedbackLabel: {
    color: '#31528A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  feedbackText: {
    color: '#263A5B',
    fontSize: 10,
    lineHeight: 15,
  },
});
