import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type LegacyRow = {
  attempt_id: string;
  member_name: string;
  church_name: string | null;
  lesson_title: string;
  lesson_number: number;
  track_title: string;
  pastor_name: string | null;
};

export default function LearningApprovalsScreen() {
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await (supabase as any).rpc('admin_get_learning_approval_queue_v2');
      if (result.error) throw result.error;
      setRows((result.data ?? []) as LegacyRow[]);
    } catch {
      setRows([]);
      setError('Cannot load the legacy audit list. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? rows.filter(row => [row.member_name, row.church_name, row.track_title,
          row.lesson_title].some(value => (value ?? '').toLowerCase().includes(q)))
      : rows;
  }, [rows, search]);

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={s.eyebrow}>FORMATION · READ-ONLY AUDIT</Text>
        <Text style={shared.h1}>Automatic Learning Validation</Text>
        <Card>
          <Text style={shared.body}>
            BUKLOD AI checks each lesson answer and personal reflection against
            the assigned lesson. Approved work and points are recorded automatically.
            No Pastor, Mentor, or System Admin approval is required.
          </Text>
          <Text style={s.hint}>
            This screen retains legacy records for audit only. It cannot approve,
            reject, or issue points.
          </Text>
        </Card>
        <SectionTitle>LEGACY RECORDS · MONITOR ONLY</SectionTitle>
        <TextInput
          style={s.search}
          placeholder="Search member, cluster, or lesson"
          value={search}
          onChangeText={setSearch}
        />
        {loading && <ActivityIndicator color={colors.green} />}
        {!!error && <Text style={s.error}>{error}</Text>}
        {!loading && !error && filtered.length === 0 && (
          <Card><Text style={shared.muted}>No legacy records currently need reconciliation.</Text></Card>
        )}
        {!loading && !error && filtered.map(row => (
          <Card key={row.attempt_id}>
            <Text style={s.member}>{row.member_name}</Text>
            <Text style={s.hint}>{row.church_name || 'Unassigned cluster'}</Text>
            <Text style={s.lesson}>Lesson {row.lesson_number}: {row.lesson_title}</Text>
            <Text style={s.hint}>{row.track_title}</Text>
            <View style={s.audit}>
              <Text style={s.auditLabel}>
                Historical queue record — no human approval or points action available
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </AdminGate>
  );
}

const s = StyleSheet.create({
  content: { padding: 14, paddingBottom: 28, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: colors.greenDark },
  search: { borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    padding: 12, backgroundColor: colors.white, fontSize: 15 },
  member: { fontSize: 16, fontWeight: '800', color: colors.text },
  lesson: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  error: { color: '#A33E34', fontSize: 14 },
  audit: { backgroundColor: '#F2F6F3', padding: 10, borderRadius: 10 },
  auditLabel: { fontSize: 12, color: colors.greenDark },
});