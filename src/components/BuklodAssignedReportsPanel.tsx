import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodAssignedReportForm from '@/components/BuklodAssignedReportForm';
import BuklodWeeklyReportForm from '@/components/BuklodWeeklyReportForm';
import type { ReportAssignmentCard } from '@/lib/buklodReportContracts';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Props = {
  scopeId: string;
  onSubmitted?: () => void;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function readAssignments(data: unknown): ReportAssignmentCard[] {
  const raw = asObject(data);
  const rows = Array.isArray(raw.assignments) ? raw.assignments : [];
  return rows.flatMap((value: unknown) => {
    const row = asObject(value);
    if (!row.report_assignment_id || !row.report_definition_id || !row.report_period_id || !row.scope_id) {
      return [];
    }
    return [{
      report_assignment_id: String(row.report_assignment_id),
      report_definition_id: String(row.report_definition_id),
      report_period_id: String(row.report_period_id),
      scope_id: String(row.scope_id),
      scope_label: row.scope_label ? String(row.scope_label) : undefined,
      report_title: String(row.report_title ?? 'Report'),
      period_label: String(row.period_label ?? ''),
      deadline_at: String(row.deadline_at ?? ''),
      assignment_status: String(row.assignment_status ?? 'OPEN') as ReportAssignmentCard['assignment_status'],
      submission_status: row.submission_status
        ? String(row.submission_status) as ReportAssignmentCard['submission_status']
        : null,
      home_status: String(row.home_status ?? 'DUE') as ReportAssignmentCard['home_status'],
      submission_id: row.submission_id ? String(row.submission_id) : null,
      has_unread_remarks: Boolean(row.has_unread_remarks),
    }];
  });
}

function deadlineLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'No deadline';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isCompleted(row: ReportAssignmentCard) {
  return row.assignment_status === 'SUBMITTED'
    || ['SUBMITTED', 'APPROVED', 'AUTO_APPROVED', 'CLOSED'].includes(String(row.submission_status ?? ''));
}

export default function BuklodAssignedReportsPanel({ scopeId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReportAssignmentCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'buklod_report_my_assignments_v1',
        { p_scope_id: scopeId, p_limit: 50 }
      );
      if (rpcError) throw rpcError;
      setRows(readAssignments(data));
    } catch (loadError: any) {
      setError(loadError?.message || 'Could not load your assigned reports.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const completedDelta = Number(isCompleted(a)) - Number(isCompleted(b));
    if (completedDelta !== 0) return completedDelta;
    return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime();
  }), [rows]);

  const selected = selectedId
    ? sorted.find((row) => row.report_assignment_id === selectedId) ?? null
    : null;

  if (loading) {
    return (
      <View style={styles.centerCard}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Loading your assigned reports…</Text>
      </View>
    );
  }

  if (error && rows.length === 0) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.retryButton}>
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  if (selected) {
    return (
      <BuklodAssignedReportForm
        key={selected.report_assignment_id}
        scopeId={scopeId}
        assignmentId={selected.report_assignment_id}
        onClose={() => setSelectedId(null)}
        onSubmitted={() => {
          void load();
          onSubmitted?.();
        }}
      />
    );
  }

  if (sorted.length === 0) {
    return (
      <BuklodWeeklyReportForm
        scopeId={scopeId}
        onSubmitted={() => {
          void load();
          onSubmitted?.();
        }}
      />
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={23} color={colors.greenDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>YOUR ASSIGNED REPORTS</Text>
          <Text style={styles.summaryTitle}>
            {sorted.filter((row) => !isCompleted(row)).length} report(s) need attention
          </Text>
          <Text style={styles.muted}>
            Reports published by this Organization or Cluster appear here automatically.
          </Text>
        </View>
      </View>

      {sorted.map((row) => {
        const completed = isCompleted(row);
        return (
          <View key={row.report_assignment_id} style={[styles.rowCard, completed && styles.rowCardDone]}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.rowTitle}>{row.report_title}</Text>
                <Text style={styles.rowMeta}>{row.period_label || 'Assigned report'}</Text>
                <Text style={styles.deadline}>Due: {deadlineLabel(row.deadline_at)}</Text>
              </View>
              <View style={[styles.statusPill, completed && styles.statusPillDone]}>
                <Text style={[styles.statusText, completed && styles.statusTextDone]}>
                  {(row.submission_status || row.home_status || row.assignment_status).replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setSelectedId(row.report_assignment_id)}
              style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name={completed ? 'eye-outline' : 'file-document-edit-outline'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.openText}>{completed ? 'VIEW REPORT' : 'OPEN REPORT'}</Text>
            </Pressable>
          </View>
        );
      })}

      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  centerCard: { minHeight: 110, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  summaryCard: { borderRadius: 16, borderWidth: 1, borderColor: '#CFE0D6', backgroundColor: '#F3FAF6', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#E1F2E8', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.65 },
  summaryTitle: { color: '#173B2F', fontSize: 14, fontWeight: '900' },
  muted: { color: '#77857E', fontSize: 10, lineHeight: 14 },
  rowCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 13, gap: 10 },
  rowCardDone: { backgroundColor: '#FBFDFC' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { color: '#173B2F', fontSize: 13, fontWeight: '900' },
  rowMeta: { color: '#6C7B73', fontSize: 9 },
  deadline: { color: '#8A5A12', fontSize: 9, fontWeight: '800' },
  statusPill: { borderRadius: 999, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4 },
  statusPillDone: { backgroundColor: '#DCFCE7' },
  statusText: { color: '#92400E', fontSize: 8, fontWeight: '900' },
  statusTextDone: { color: '#166534' },
  openButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#173B2F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  openText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12, gap: 8 },
  errorText: { color: '#991B1B', fontSize: 10, lineHeight: 15 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#991B1B', paddingHorizontal: 10, paddingVertical: 7 },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  inlineError: { color: '#991B1B', fontSize: 9 },
  pressed: { opacity: 0.72 },
});
