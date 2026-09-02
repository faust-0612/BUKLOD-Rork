import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { exportEducationClassCsv } from '@/lib/education/exportClassCsv';
import { supabase } from '@/lib/supabase';

type ReportRow = {
  display_name: string | null;
  username: string | null;
  current_weighted_grade: number | null;
  released_components: number | null;
};

type SummaryRow = {
  student_user_id: string;
  display_name: string;
  current_percent: number | null;
  final_grade: number | null;
  final_status: string | null;
  ready_for_final: boolean;
};

export default function FacultyProgressScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();

  const [report, setReport] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [reportRes, summaryRes] = await Promise.all([
      supabase.rpc('buklod_education_class_report_v1', { p_classroom_id: classroomId }),
      supabase.rpc('buklod_education_faculty_final_grade_summary_v1', { p_classroom_id: classroomId }),
    ]);

    if (reportRes.error) Alert.alert('Class report', reportRes.error.message);
    if (summaryRes.error) Alert.alert('Final standing', summaryRes.error.message);

    setReport((reportRes.data ?? []) as ReportRow[]);
    setSummary((summaryRes.data ?? []) as SummaryRow[]);
  }, [classroomId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    try {
      await exportEducationClassCsv(classroomId, classroomName);
    } catch (error) {
      Alert.alert('Export', error instanceof Error ? error.message : 'Export failed.');
    }
  };

  const statusFor = (name: string | null, username: string | null) => {
    const match = summary.find(item =>
      item.display_name === name || (username && item.display_name.includes(username))
    );
    return match;
  };

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />
        }
      >
        <FacultyClassHeader
          classroomName={classroomName}
          eyebrow="PROGRESS & REPORTS"
          title="Class standing"
          subtitle="Figures come from released/locked grades only. CSV is Excel-ready; xlsx is not installed."
        />

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
            onPress={exportCsv}
          >
            <Text style={styles.primaryText}>Export CSV</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondary, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: '/profile/buklod-faculty-final-grades' as any,
                params: { classroomId, id: classroomId, name: classroomName },
              })
            }
          >
            <Text style={{ color: theme.accent, fontWeight: '900' }}>Open gradebook</Text>
          </Pressable>
        </View>

        {report.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted }}>No enrolled students to report.</Text>
          </View>
        ) : (
          report.map((row, index) => {
            const extra = statusFor(row.display_name, row.username);
            return (
              <View key={`${row.username ?? row.display_name ?? index}`} style={[styles.card, { backgroundColor: theme.surface }]}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>
                  {row.display_name || row.username || 'BUKLOD Student'}
                </Text>
                {!!row.username && (
                  <Text style={[styles.meta, { color: theme.textMuted }]}>@{row.username}</Text>
                )}
                <View style={styles.metrics}>
                  <View style={[styles.metric, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {row.current_weighted_grade == null ? '—' : Number(row.current_weighted_grade).toFixed(2)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Weighted</Text>
                  </View>
                  <View style={[styles.metric, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {row.released_components ?? 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Released items</Text>
                  </View>
                  <View style={[styles.metric, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
                      {extra?.final_grade == null ? '—' : Number(extra.final_grade).toFixed(2)}
                    </Text>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                      {extra?.final_status ?? 'Not computed'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  primary: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  empty: { borderRadius: 15, padding: 16 },
  card: { borderRadius: 16, padding: 14, marginBottom: 9 },
  name: { fontWeight: '900', fontSize: 16 },
  meta: { marginTop: 2, fontSize: 12 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1, borderRadius: 11, padding: 9 },
  metricValue: { fontWeight: '900', fontSize: 16 },
  metricLabel: { fontSize: 10, marginTop: 2 },
  pressed: { opacity: 0.88 },
});
