import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodReportScrollView from '@/components/BuklodReportScrollView';
import { fetchMyReportActions, updateMyReportAction } from '@/lib/buklodReportActions';
import type { ScopeManagementAction } from '@/lib/buklodReportConsolidation';
import { reportColors as colors, reportTheme } from '@/lib/buklodReportTheme';

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BuklodReportMyActionsScreen() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [rows, setRows] = useState<ScopeManagementAction[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchMyReportActions(scopeId || null);
      setRows(next);
      setOutcomes((current) => {
        const result = { ...current };
        for (const action of next) if (result[action.id] == null) result[action.id] = action.outcome ?? '';
        return result;
      });
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not load assigned actions.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (action: ScopeManagementAction, status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'DONE') => {
    if (busyId) return;
    setBusyId(action.id);
    try {
      await updateMyReportAction({ actionId: action.id, status, outcome: outcomes[action.id] || null });
      await load();
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not update the assigned action.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'My Report Actions' }} />
      <BuklodReportScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>BUKLOD Report</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>FOLLOW-UP • CARE • COMPLETION</Text>
          <Text style={styles.heroTitle}>My Actions</Text>
          <Text style={styles.heroText}>These are follow-up or support actions assigned from reporting. Acknowledge the action, work on it, and mark it done with the actual outcome.</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.greenDark} /><Text style={styles.note}>Loading actions…</Text></View>
        ) : rows.length === 0 ? (
          <View style={styles.card}><MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} /><Text style={styles.title}>No active assigned action</Text><Text style={styles.note}>Completed or cancelled actions remain in the supervisor audit history.</Text></View>
        ) : rows.map((action) => {
          const busy = busyId === action.id;
          return (
            <View key={action.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.flexCopy}>
                  <Text style={styles.type}>{label(action.action_type)} · {action.priority}</Text>
                  <Text style={styles.title}>{action.title}</Text>
                </View>
                <View style={[styles.statusPill, action.status === 'DONE' && styles.donePill]}><Text style={[styles.statusText, action.status === 'DONE' && styles.doneText]}>{label(action.status)}</Text></View>
              </View>
              {action.rationale ? <Text style={styles.note}>{action.rationale}</Text> : null}
              <Text style={styles.meta}>Due: {formatDate(action.due_at)}</Text>
              {action.next_action ? <View style={styles.nextBox}><Text style={styles.nextLabel}>NEXT ACTION</Text><Text style={styles.nextText}>{action.next_action}</Text></View> : null}
              <TextInput
                value={outcomes[action.id] ?? ''}
                onChangeText={(value) => setOutcomes((current) => ({ ...current, [action.id]: value }))}
                placeholder="Outcome / what was completed"
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
              />
              <View style={styles.actions}>
                {action.status === 'PLANNED' || action.status === 'SUGGESTED' ? <ActionButton label="Acknowledge" icon="hand-okay" disabled={busy} onPress={() => void setStatus(action, 'ACKNOWLEDGED')} /> : null}
                {action.status !== 'IN_PROGRESS' && action.status !== 'DONE' ? <ActionButton label="Start" icon="play-outline" disabled={busy} onPress={() => void setStatus(action, 'IN_PROGRESS')} /> : null}
                {action.status !== 'DONE' ? <ActionButton label="Mark done" icon="check-circle-outline" disabled={busy} onPress={() => void setStatus(action, 'DONE')} primary /> : null}
              </View>
            </View>
          );
        })}
      </BuklodReportScrollView>
    </>
  );
}

function ActionButton({ label, icon, onPress, disabled, primary = false }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, primary && styles.actionPrimary, disabled && styles.disabled]}><MaterialCommunityIcons name={icon} size={15} color={primary ? colors.white : colors.greenDark} /><Text style={[styles.actionText, primary && styles.actionPrimaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: reportTheme.layout.mobilePadding, gap: 12, backgroundColor: colors.background },
  flexCopy: { flex: 1, minWidth: 0 },
  backRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: reportTheme.radius.xl, padding: 16, backgroundColor: colors.greenDark, gap: 5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: colors.white, fontSize: 21, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 16 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 13, gap: 9 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  type: { color: colors.greenDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: colors.textStrong, fontSize: 13, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  meta: { color: colors.text, fontSize: 9, fontWeight: '700' },
  statusPill: { borderRadius: 999, backgroundColor: colors.amberSoft, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { color: colors.amber, fontSize: 8, fontWeight: '900' },
  donePill: { backgroundColor: colors.successSoft },
  doneText: { color: colors.success },
  nextBox: { borderRadius: 10, backgroundColor: colors.surfaceMuted, padding: 9, gap: 3 },
  nextLabel: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  nextText: { color: colors.textStrong, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  input: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontSize: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionButton: { minHeight: 35, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionPrimary: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  actionText: { color: colors.greenDark, fontSize: 9, fontWeight: '900' },
  actionPrimaryText: { color: colors.white },
  disabled: { opacity: 0.5 },
});
