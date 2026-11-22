import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { listReportDefinitions } from '@/lib/buklodReportDomain';
import {
  formatManilaInput,
  parseManilaDateTime,
  previewReportDeadlineAudience,
  publishReportDeadline,
  type ReportDeadlineAudiencePreview,
} from '@/lib/buklodReportDeadlines';
import type { ReportDefinitionRow } from '@/lib/buklodReportContracts';
import { readReportScopeId } from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

type ReportCadence = 'ONE_TIME' | 'WEEKLY' | 'MONTHLY';

const EMPTY_DEADLINE = { opensAt: '', deadlineAt: '', closesAt: '' };

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

function displayTitle(row: ReportDefinitionRow) {
  const requirements = objectValue(row.content_requirements);
  return String(requirements.template_label ?? '').trim() || row.title;
}

function autoScheduleActive(row: ReportDefinitionRow) {
  const settings = objectValue(row.recurrence_config);
  const auto = objectValue(settings.auto_collection);
  return (row.recurrence_kind === 'WEEKLY' || row.recurrence_kind === 'MONTHLY') && auto.enabled === true;
}

function category(row: ReportDefinitionRow) {
  const requirements = objectValue(row.content_requirements);
  if (String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1') return 'MINISTRY';
  return String(requirements.category ?? 'CUSTOM').toUpperCase();
}

export default function BuklodReportDeadlineManagerScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);
  const preferredDefinitionId = firstParam(params.definitionId ?? params.definition_id);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [scopeName, setScopeName] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<ReportDefinitionRow[]>([]);
  const [publishTarget, setPublishTarget] = useState<ReportDefinitionRow | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<ReportDeadlineAudiencePreview | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [deadline, setDeadline] = useState(EMPTY_DEADLINE);
  const [cadence, setCadence] = useState<ReportCadence>('WEEKLY');

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      setScopeName(access.scopeName ?? 'Selected scope');
      if (!access.allowed) {
        setRows([]);
        return;
      }
      setRows(await listReportDefinitions(scopeId, includeArchived));
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not load report templates.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const startPublish = useCallback(async (row: ReportDefinitionRow) => {
    setPublishTarget(row);
    setAudiencePreview(null);
    setPublishConfirmed(false);
    setCadence(row.recurrence_kind === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY');
    setDeadline({
      opensAt: formatManilaInput(),
      deadlineAt: formatManilaInput(new Date(Date.now() + 7 * 86400000)),
      closesAt: '',
    });
    setPreviewing(true);
    try {
      setAudiencePreview(await previewReportDeadlineAudience(row.id));
    } catch (error: unknown) {
      Alert.alert('Could not preview recipients', error instanceof Error ? error.message : 'The target members could not be resolved.');
    } finally {
      setPreviewing(false);
    }
  }, []);

  useEffect(() => {
    if (!preferredDefinitionId || publishTarget || rows.length === 0) return;
    const row = rows.find((item) => item.id === preferredDefinitionId);
    if (row && row.status !== 'ARCHIVED') void startPublish(row);
  }, [preferredDefinitionId, publishTarget, rows, startPublish]);

  const closePublisher = () => {
    setPublishTarget(null);
    setAudiencePreview(null);
    setPublishConfirmed(false);
    setDeadline(EMPTY_DEADLINE);
    setCadence('WEEKLY');
  };

  const publish = async () => {
    if (!publishTarget || !publishConfirmed) return;
    if (!audiencePreview || audiencePreview.eligibleMemberCount < 1) {
      Alert.alert('BUKLOD Report', 'No eligible active member is available for this deadline.');
      return;
    }
    if (!deadline.deadlineAt.trim()) {
      Alert.alert('BUKLOD Report', 'Enter the real deadline date and time.');
      return;
    }

    let dueAt: string, opensAt: string | null, closesAt: string | null;
    try {
      dueAt = parseManilaDateTime(deadline.deadlineAt);
      opensAt = deadline.opensAt.trim() ? parseManilaDateTime(deadline.opensAt) : null;
      closesAt = deadline.closesAt.trim() ? parseManilaDateTime(deadline.closesAt) : null;
      if (Date.parse(dueAt) <= Date.now()) throw new Error('Deadline must be in the future.');
      if (opensAt && Date.parse(opensAt) > Date.parse(dueAt)) throw new Error('Opening cannot be after deadline.');
      if (closesAt && Date.parse(closesAt) < Date.parse(dueAt)) throw new Error('Closing cannot be before deadline.');
    } catch (error: any) {
      Alert.alert('Correct collection schedule', error?.message || 'Invalid deadline.');
      return;
    }
    setPublishing(true);
    try {
      const result = await publishReportDeadline({
        definitionId: publishTarget.id,
        title: displayTitle(publishTarget),
        opensAt,
        dueAt,
        closesAt,
        cadence,
      });

      Alert.alert(
        result.alreadyPublished ? 'Deadline already published' : 'Deadline published',
        result.alreadyPublished
          ? `The same deadline already exists for ${result.scopeName}. The original member snapshot remains unchanged.`
          : `${result.assignedCount} assignment${result.assignedCount === 1 ? '' : 's'} created, ${result.notificationCount} notifications queued. ${cadence === 'ONE_TIME' ? 'One-time collection.' : `${cadence === 'WEEKLY' ? 'Weekly' : 'Monthly'} recurrence enabled.`}`
      );
      closePublisher();
      await load();
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not publish the deadline.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = Boolean(
    !previewing && audiencePreview && audiencePreview.eligibleMemberCount > 0 && publishConfirmed && deadline.deadlineAt.trim() && (() => { try { const due = parseManilaDateTime(deadline.deadlineAt); const open = deadline.opensAt.trim() ? parseManilaDateTime(deadline.opensAt) : null; const close = deadline.closesAt.trim() ? parseManilaDateTime(deadline.closesAt) : null; return Date.parse(due) > Date.now() && (!open || Date.parse(open) <= Date.parse(due)) && (!close || Date.parse(close) >= Date.parse(due)); } catch { return false; } })()
  );

  const visibleRows = useMemo(
    () => preferredDefinitionId
      ? rows.slice().sort((a, b) => Number(b.id === preferredDefinitionId) - Number(a.id === preferredDefinitionId))
      : rows,
    [preferredDefinitionId, rows]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Report Deadline Manager' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>Report Library</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>LIVE ASSIGNMENT CONTROL</Text>
          <Text style={styles.heroTitle}>Deadline Manager</Text>
          <Text style={styles.heroText}>{scopeName}. Saved templates do not notify anyone. Only Publish creates the frozen member assignment snapshot and queues notifications.</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Loading templates…</Text></View>
        ) : !allowed ? (
          <View style={styles.card}><Text style={styles.note}>Exact-scope admin access is required.</Text></View>
        ) : (
          <>
            <View style={styles.switchRow}><Text style={styles.switchText}>Show archived</Text><Switch value={includeArchived} onValueChange={setIncludeArchived} /></View>

            {publishTarget ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>PUBLISH REAL DEADLINE</Text>
                <Text style={styles.publishTitle}>{displayTitle(publishTarget)}</Text>
                <Text style={styles.note}>Recipients are previewed first. Each period snapshots its eligible active members; prior snapshots stay unchanged.</Text>

                {previewing ? (
                  <View style={styles.previewBox}><ActivityIndicator size="small" color={colors.greenDark} /><Text style={styles.note}>Resolving current recipients…</Text></View>
                ) : audiencePreview ? (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewCount}>{audiencePreview.eligibleMemberCount}</Text>
                    <View style={{ flex: 1 }}><Text style={styles.previewTitle}>active member{audiencePreview.eligibleMemberCount === 1 ? '' : 's'} will receive this report</Text><Text style={styles.note}>{audiencePreview.scopeName} · {audiencePreview.scopeType}</Text></View>
                  </View>
                ) : <View style={styles.previewBox}><Text style={styles.note}>Recipients could not be resolved. Publishing is disabled.</Text></View>}

                <View style={styles.frequencyPanel}>
                  <Text style={styles.fieldLabel}>REPORT COLLECTION FREQUENCY</Text>
                  <View style={styles.frequencyChoices}>
                    {([
                      ['WEEKLY', 'Weekly'],
                      ['MONTHLY', 'Monthly'],
                      ['ONE_TIME', 'One time'],
                    ] as const).map(([value, label]) => (
                      <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: cadence === value }} onPress={() => setCadence(value)}
                        style={[styles.frequencyButton, cadence === value && styles.frequencyButtonOn]}>
                        <Text style={[styles.frequencyLabel, cadence === value && styles.frequencyLabelOn]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.note}>
                    {cadence === 'WEEKLY' ? 'Same weekday and Manila time every 7 days.' :
                      cadence === 'MONTHLY' ? 'Same calendar day each month. Last-day deadline stays last day.' :
                      'No recurring assignments.'}
                    {' '}Reminders 24h and 3h before deadline, and overdue when still pending.
                  </Text>
                </View>
                <Field label="OPENS — MANILA TIME (YYYY-MM-DD HH:mm)" value={deadline.opensAt} onChangeText={(opensAt) => setDeadline((current) => ({ ...current, opensAt }))} />
                <Field label="DEADLINE — MANILA TIME (YYYY-MM-DD HH:mm)" value={deadline.deadlineAt} onChangeText={(deadlineAt) => setDeadline((current) => ({ ...current, deadlineAt }))} placeholder="Future Manila date and time" />
                <Field label="CLOSES — OPTIONAL" value={deadline.closesAt} onChangeText={(closesAt) => setDeadline((current) => ({ ...current, closesAt }))} placeholder="Leave blank to allow late submission" />

                <View style={styles.confirmBox}>
                  <Switch disabled={!audiencePreview || audiencePreview.eligibleMemberCount < 1} value={publishConfirmed} onValueChange={setPublishConfirmed} />
                  <Text style={styles.confirmText}>I understand that Publish creates the previewed member assignments and queues their report notification.</Text>
                </View>

                <View style={styles.actions}>
                  <Pressable disabled={publishing || !canPublish} onPress={() => void publish()} style={[styles.primaryButton, (publishing || !canPublish) && styles.disabled]}>
                    {publishing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="bell-plus-outline" size={17} color="#FFFFFF" />}
                    <Text style={styles.primaryText}>{publishing ? 'Publishing…' : 'Publish & notify members'}</Text>
                  </Pressable>
                  <Pressable disabled={publishing} onPress={closePublisher} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
                </View>
              </View>
            ) : null}

            {visibleRows.length === 0 ? (
              <View style={styles.card}><Text style={styles.note}>No report templates. Create one from Report Library first.</Text></View>
            ) : visibleRows.map((row) => (
              <View key={row.id} style={[styles.reportRow, row.status === 'ARCHIVED' && styles.archived]}>
                <View style={styles.reportIcon}><MaterialCommunityIcons name="file-document-outline" size={20} color={colors.greenDark} /></View>
                <View style={{ flex: 1 }}><Text style={styles.category}>{category(row)}</Text><Text style={styles.rowTitle}>{displayTitle(row)}</Text><Text style={styles.rowMeta}>{row.recurrence_kind} · {row.status} · {autoScheduleActive(row) ? 'AUTO NOTIFY ON' : 'AUTO NOTIFY OFF'}</Text></View>
                {row.status !== 'ARCHIVED' ? (
                  <Pressable onPress={() => void startPublish(row)} style={styles.bellButton} accessibilityLabel={`Publish deadline for ${displayTitle(row)}`}>
                    <MaterialCommunityIcons name="bell-plus-outline" size={21} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: 18, padding: 16, backgroundColor: colors.greenDark, gap: 5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 16 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  card: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', padding: 13, gap: 10 },
  cardTitle: { color: colors.greenDark, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  publishTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  previewBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewCount: { minWidth: 35, color: colors.greenDark, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  previewTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  frequencyPanel: { gap: 8, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F7FAF8' },
  frequencyChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  frequencyButton: { minHeight: 39, minWidth: 75, flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  frequencyButtonOn: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  frequencyLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
  frequencyLabelOn: { color: '#FFFFFF' },
  fieldWrap: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  input: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingHorizontal: 11, color: colors.text },
  confirmBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  confirmText: { flex: 1, color: colors.text, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 43, borderRadius: 10, backgroundColor: colors.greenDark, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  reportRow: { borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  archived: { opacity: 0.55 },
  reportIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EAF5EF', alignItems: 'center', justifyContent: 'center' },
  category: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  rowTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  rowMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  bellButton: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
});
