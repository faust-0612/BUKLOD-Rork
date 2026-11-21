import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import type { ReportDefinitionRow } from '@/lib/buklodReportContracts';
import { listReportDefinitions } from '@/lib/buklodReportDomain';
import { readReportScopeId } from '@/lib/buklodReportRoutes';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Preview = {
  scope_id: string;
  scope_name: string;
  scope_type: string;
  report_definition_id: string;
  report_title: string;
  eligible_member_count: number;
  audience_mode: string;
  membership_snapshot_on_publish: boolean;
};

type PublishResult = {
  report_period_id: string;
  period_title: string;
  deadline_at: string;
  assigned_count: number;
  notification_count: number;
  already_published: boolean;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function parseManilaDateTime(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) throw new Error('Use YYYY-MM-DD HH:mm, for example 2026-09-20 21:00.');
  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error('The deadline date/time is invalid.');
  if (date.getTime() <= Date.now()) throw new Error('Deadline must be in the future.');
  return date.toISOString();
}

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function BuklodReportPublishScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState<ReportDefinitionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [deadlineText, setDeadlineText] = useState('');
  const [periodTitle, setPeriodTitle] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublishResult | null>(null);

  const selected = useMemo(
    () => definitions.find((row) => row.id === selectedId) ?? null,
    [definitions, selectedId]
  );

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await listReportDefinitions(scopeId, false);
      const publishable = rows.filter((row) => row.status !== 'ARCHIVED');
      setDefinitions(publishable);
      setSelectedId((current) => current && publishable.some((row) => row.id === current)
        ? current
        : publishable[0]?.id ?? null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Report definitions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runPreview = useCallback(async (definitionId: string) => {
    if (!definitionId) return;
    setPreviewing(true);
    setError('');
    setResult(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'buklod_report_deadline_preview_v1',
        { p_definition_id: definitionId }
      );
      if (rpcError) throw rpcError;
      const raw = asObject(data);
      setPreview({
        scope_id: String(raw.scope_id ?? ''),
        scope_name: String(raw.scope_name ?? 'Selected scope'),
        scope_type: String(raw.scope_type ?? ''),
        report_definition_id: String(raw.report_definition_id ?? definitionId),
        report_title: String(raw.report_title ?? 'Report'),
        eligible_member_count: Number(raw.eligible_member_count ?? 0),
        audience_mode: String(raw.audience_mode ?? 'ALL_ACTIVE_SCOPE_MEMBERS'),
        membership_snapshot_on_publish: raw.membership_snapshot_on_publish !== false,
      });
    } catch (previewError: any) {
      setPreview(null);
      setError(previewError?.message || 'Audience preview failed.');
    } finally {
      setPreviewing(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return;
    }
    setPeriodTitle('');
    setResult(null);
    void runPreview(selectedId);
  }, [runPreview, selectedId]);

  const publish = useCallback(() => {
    if (!scopeId || !selected || !preview || publishing) return;

    let dueAt = '';
    try {
      dueAt = parseManilaDateTime(deadlineText);
    } catch (parseError: any) {
      setError(parseError?.message || 'Enter a valid future deadline.');
      return;
    }

    if (preview.eligible_member_count < 1) {
      setError('No active members are available in this scope.');
      return;
    }

    Alert.alert(
      'Publish report deadline?',
      `${selected.title} will be assigned to ${preview.eligible_member_count} active member(s). Each member will receive their own assignment and reminder.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () => {
            setPublishing(true);
            setError('');
            setResult(null);
            void (supabase as any).rpc('buklod_report_publish_deadline_v1', {
              p_definition_id: selected.id,
              p_due_at: dueAt,
              p_opens_at: null,
              p_closes_at: null,
              p_title: periodTitle.trim() || null,
            }).then(({ data, error: rpcError }: any) => {
              if (rpcError) throw rpcError;
              const raw = asObject(data);
              setResult({
                report_period_id: String(raw.report_period_id ?? ''),
                period_title: String(raw.period_title ?? selected.title),
                deadline_at: String(raw.deadline_at ?? dueAt),
                assigned_count: Number(raw.assigned_count ?? 0),
                notification_count: Number(raw.notification_count ?? 0),
                already_published: Boolean(raw.already_published),
              });
              void runPreview(selected.id);
            }).catch((publishError: any) => {
              setError(publishError?.message || 'Report deadline could not be published.');
            }).finally(() => {
              setPublishing(false);
            });
          },
        },
      ]
    );
  }, [deadlineText, periodTitle, preview, publishing, runPreview, scopeId, selected]);

  return (
    <>
      <Stack.Screen options={{ title: 'Publish Report' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="account-multiple-check-outline" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Publish to Members</Text>
            <Text style={styles.heroText}>
              Set the real deadline. BUKLOD snapshots current active members, creates one assignment per member, and sends the report notification.
            </Text>
          </View>
        </View>

        {!scopeId ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>Open this page from an Organization or Cluster Report workspace.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Loading report definitions…</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.eyebrow}>1 · REPORT TEMPLATE</Text>
              <Text style={styles.sectionTitle}>Choose what members will answer</Text>
              {definitions.length ? (
                <View style={styles.optionList}>
                  {definitions.map((row) => (
                    <Pressable
                      key={row.id}
                      onPress={() => setSelectedId(row.id)}
                      style={[styles.definitionRow, selectedId === row.id && styles.definitionRowOn]}
                    >
                      <MaterialCommunityIcons
                        name={selectedId === row.id ? 'radiobox-marked' : 'radiobox-blank'}
                        size={20}
                        color={selectedId === row.id ? colors.greenDark : '#7C8A83'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.definitionTitle}>{row.title}</Text>
                        <Text style={styles.muted}>{row.code} · {row.status}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>No publishable report definition exists in this scope yet.</Text>
              )}
            </View>

            {selected ? (
              <View style={styles.sectionCard}>
                <Text style={styles.eyebrow}>2 · AUDIENCE PREVIEW</Text>
                <Text style={styles.sectionTitle}>Who will receive it?</Text>
                {previewing ? (
                  <ActivityIndicator color={colors.green} />
                ) : preview ? (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewCount}>{preview.eligible_member_count}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewTitle}>active member(s)</Text>
                      <Text style={styles.muted}>{preview.scope_name} · {preview.scope_type}</Text>
                      <Text style={styles.muted}>Audience is snapshotted when Publish is pressed.</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {selected && preview ? (
              <View style={styles.sectionCard}>
                <Text style={styles.eyebrow}>3 · DEADLINE</Text>
                <Text style={styles.sectionTitle}>Set the actual due date</Text>
                <Text style={styles.fieldLabel}>Deadline · Asia/Manila</Text>
                <TextInput
                  value={deadlineText}
                  onChangeText={setDeadlineText}
                  placeholder="YYYY-MM-DD HH:mm"
                  placeholderTextColor="#9AA7A0"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.help}>Example format: 2026-09-20 21:00. The deadline must be in the future.</Text>

                <Text style={styles.fieldLabel}>Period title (optional)</Text>
                <TextInput
                  value={periodTitle}
                  onChangeText={setPeriodTitle}
                  placeholder={selected.title}
                  placeholderTextColor="#9AA7A0"
                  style={styles.input}
                />

                <Pressable
                  disabled={publishing || !deadlineText.trim()}
                  onPress={publish}
                  style={[styles.publishButton, (publishing || !deadlineText.trim()) && styles.disabled]}
                >
                  {publishing ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send-clock-outline" size={20} color="#FFFFFF" />}
                  <Text style={styles.publishText}>{publishing ? 'PUBLISHING…' : 'PUBLISH & ASSIGN TO MEMBERS'}</Text>
                </Pressable>
              </View>
            ) : null}

            {result ? (
              <View style={styles.successCard}>
                <MaterialCommunityIcons name="check-decagram" size={25} color="#166534" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>{result.already_published ? 'Deadline already published' : 'Published successfully'}</Text>
                  <Text style={styles.successText}>{result.period_title}</Text>
                  <Text style={styles.successText}>Due {formatDeadline(result.deadline_at)}</Text>
                  <Text style={styles.successText}>{result.assigned_count} assignment(s) · {result.notification_count} notification(s)</Text>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={17} color={colors.greenDark} />
              <Text style={styles.backText}>Back to Report workspace</Text>
            </Pressable>
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  hero: { borderRadius: 18, padding: 15, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  heroText: { marginTop: 3, color: 'rgba(255,255,255,0.84)', fontSize: 10, lineHeight: 15 },
  sectionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  eyebrow: { color: '#61766C', fontSize: 9, fontWeight: '900', letterSpacing: 0.65 },
  sectionTitle: { color: '#173B2F', fontSize: 14, fontWeight: '900' },
  optionList: { gap: 8 },
  definitionRow: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: '#E0E7E3', backgroundColor: '#FAFBFA', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  definitionRowOn: { borderColor: '#69A982', backgroundColor: '#EFF9F3' },
  definitionTitle: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  muted: { color: '#77857E', fontSize: 9, lineHeight: 14 },
  previewBox: { borderRadius: 13, backgroundColor: '#F3FAF6', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewCount: { color: colors.greenDark, fontSize: 30, fontWeight: '900' },
  previewTitle: { color: '#173B2F', fontSize: 12, fontWeight: '900' },
  fieldLabel: { color: '#4F6259', fontSize: 10, fontWeight: '900' },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#FAFBFA', color: '#173B2F', paddingHorizontal: 11, fontSize: 11 },
  help: { color: '#819087', fontSize: 9, lineHeight: 13 },
  publishButton: { minHeight: 50, borderRadius: 12, backgroundColor: '#173B2F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  publishText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  successCard: { borderRadius: 15, borderWidth: 1, borderColor: '#BBE4C9', backgroundColor: '#ECFDF3', padding: 13, flexDirection: 'row', gap: 9 },
  successTitle: { color: '#166534', fontSize: 12, fontWeight: '900' },
  successText: { color: '#3E6E50', fontSize: 9, lineHeight: 14 },
  centerCard: { minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12 },
  errorText: { color: '#991B1B', fontSize: 10, lineHeight: 15 },
  backButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.52 },
});
