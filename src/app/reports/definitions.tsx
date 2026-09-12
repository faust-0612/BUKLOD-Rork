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
import { colors } from '@/lib/theme';
import {
  listReportDefinitions,
  REPORT_DEFINITION_STATUS_OPTIONS,
  REPORT_RECURRENCE_OPTIONS,
  setReportDefinitionStatus,
  upsertReportDefinition,
} from '@/lib/buklodReportDomain';
import {
  formatManilaInput,
  parseManilaDateTime,
  publishReportDeadline,
} from '@/lib/buklodReportDeadlines';
import type {
  ReportDefinitionRow,
  ReportDefinitionStatus,
  ReportRecurrenceKind,
} from '@/lib/buklodReportContracts';
import { readReportScopeId } from '@/lib/buklodReportRoutes';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';

const EMPTY_FORM = {
  code: '',
  title: '',
  description: '',
  instructions: '',
  recurrenceKind: 'MONTHLY' as ReportRecurrenceKind,
  status: 'DRAFT' as ReportDefinitionStatus,
  isRequired: true,
  effectiveFrom: '',
  effectiveTo: '',
  dueRuleKind: 'END_OF_PERIOD',
  dueOffsetDays: '0',
};

const EMPTY_DEADLINE = {
  opensAt: '',
  deadlineAt: '',
  closesAt: '',
};

export default function BuklodReportDefinitionsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<ReportDefinitionRow[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<ReportDefinitionRow | null>(null);
  const [publishTarget, setPublishTarget] = useState<ReportDefinitionRow | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deadline, setDeadline] = useState(EMPTY_DEADLINE);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      setAllowed(false);
      return;
    }

    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      if (!access.allowed) {
        setRows([]);
        return;
      }
      setRows(await listReportDefinitions(scopeId, includeArchived));
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error ? error.message : 'Could not load report definitions.'
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId, includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setPublishTarget(null);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (row: ReportDefinitionRow) => {
    setPublishTarget(null);
    setEditing(row);
    setForm({
      code: row.code,
      title: row.title,
      description: row.description ?? '',
      instructions: row.instructions ?? '',
      recurrenceKind: row.recurrence_kind,
      status: row.status,
      isRequired: row.is_required,
      effectiveFrom: row.effective_from ?? '',
      effectiveTo: row.effective_to ?? '',
      dueRuleKind: String(row.due_rule?.kind ?? 'END_OF_PERIOD'),
      dueOffsetDays: String(row.due_rule?.offset_days ?? 0),
    });
  };

  const startPublish = (row: ReportDefinitionRow) => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPublishTarget(row);
    setPublishConfirmed(false);
    setDeadline({
      opensAt: formatManilaInput(),
      deadlineAt: '',
      closesAt: '',
    });
  };

  const save = async () => {
    if (!scopeId) return;
    if (!form.code.trim() || !form.title.trim()) {
      Alert.alert('BUKLOD Report', 'Code and title are required.');
      return;
    }

    setSaving(true);
    try {
      await upsertReportDefinition({
        scopeId,
        definitionId: editing?.id ?? null,
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        recurrenceKind: form.recurrenceKind,
        status: form.status,
        isRequired: form.isRequired,
        effectiveFrom: form.effectiveFrom.trim() || undefined,
        effectiveTo: form.effectiveTo.trim() || undefined,
        dueRule: {
          kind: form.dueRuleKind.trim() || 'END_OF_PERIOD',
          offset_days: Number(form.dueOffsetDays || 0),
        },
        submitterRules: { mode: 'SCOPE_FUNCTIONAL_ROLES' },
        recipientRules: { mode: 'SCOPE_ADMINS' },
      });
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
      Alert.alert(
        'Definition saved',
        'This is still a template. No member was notified. Use Publish deadline when you are ready to create the real report assignment.'
      );
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error ? error.message : 'Could not save report definition.'
      );
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!publishTarget || !publishConfirmed) return;
    if (!deadline.deadlineAt.trim()) {
      Alert.alert('BUKLOD Report', 'Enter the real deadline date and time.');
      return;
    }

    setPublishing(true);
    try {
      const dueAt = parseManilaDateTime(deadline.deadlineAt);
      const opensAt = deadline.opensAt.trim()
        ? parseManilaDateTime(deadline.opensAt)
        : null;
      const closesAt = deadline.closesAt.trim()
        ? parseManilaDateTime(deadline.closesAt)
        : null;

      const result = await publishReportDeadline({
        definitionId: publishTarget.id,
        title: publishTarget.title,
        opensAt,
        dueAt,
        closesAt,
      });

      if (result.alreadyPublished) {
        Alert.alert(
          'Deadline already published',
          `The same deadline already exists for ${result.scopeName}. The original member snapshot was kept unchanged.`
        );
      } else {
        Alert.alert(
          'Deadline published',
          `${result.assignedCount} member assignment${result.assignedCount === 1 ? '' : 's'} created. ${result.notificationCount} notification${result.notificationCount === 1 ? '' : 's'} queued for in-app and push delivery.`
        );
      }

      setPublishTarget(null);
      setPublishConfirmed(false);
      setDeadline(EMPTY_DEADLINE);
      await load();
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error ? error.message : 'Could not publish the deadline.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const changeStatus = async (
    row: ReportDefinitionRow,
    status: ReportDefinitionStatus
  ) => {
    try {
      await setReportDefinitionStatus(row.id, status);
      await load();
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error ? error.message : 'Could not update report status.'
      );
    }
  };

  const editorVisible = editing !== null || form.code !== '' || form.title !== '';
  const statusChips = useMemo(() => REPORT_DEFINITION_STATUS_OPTIONS, []);

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No scope selected</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report Definitions' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.greenDark} />
          <Text style={styles.backText}>BUKLOD Report</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Report definitions & deadlines</Text>
          <Text style={styles.heroSubtitle}>
            Save templates without notifying members. Publish a real deadline only when the report is ready; publishing freezes the current active member list and sends assignments.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} />
        ) : !allowed ? (
          <View style={styles.card}>
            <Text style={styles.note}>
              Exact-scope admin access is required to manage BUKLOD Report definitions and deadlines.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Pressable onPress={startCreate} style={styles.primaryButton}>
                <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>New definition</Text>
              </Pressable>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show archived</Text>
                <Switch value={includeArchived} onValueChange={setIncludeArchived} />
              </View>
            </View>

            {editorVisible ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{editing ? 'Edit definition' : 'New definition'}</Text>
                <Text style={styles.note}>
                  Saving this section does not create a deadline and does not notify members.
                </Text>
                <Field
                  label="CODE"
                  value={form.code}
                  onChangeText={(code) => setForm((current) => ({ ...current, code }))}
                  placeholder="WEEKLY_MINISTRY"
                  autoCapitalize="characters"
                />
                <Field
                  label="TITLE"
                  value={form.title}
                  onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                  placeholder="Weekly Ministry Report"
                />
                <Field
                  label="DESCRIPTION"
                  value={form.description}
                  onChangeText={(description) => setForm((current) => ({ ...current, description }))}
                  multiline
                />
                <Field
                  label="INSTRUCTIONS"
                  value={form.instructions}
                  onChangeText={(instructions) => setForm((current) => ({ ...current, instructions }))}
                  multiline
                />

                <Text style={styles.fieldLabel}>RECURRENCE</Text>
                <View style={styles.chipRow}>
                  {REPORT_RECURRENCE_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={form.recurrenceKind === option}
                      onPress={() => setForm((current) => ({ ...current, recurrenceKind: option }))}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>TEMPLATE STATUS</Text>
                <View style={styles.chipRow}>
                  {statusChips.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={form.status === option}
                      onPress={() => setForm((current) => ({ ...current, status: option }))}
                    />
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Required report</Text>
                  <Switch
                    value={form.isRequired}
                    onValueChange={(isRequired) => setForm((current) => ({ ...current, isRequired }))}
                  />
                </View>

                <Field
                  label="EFFECTIVE FROM (YYYY-MM-DD)"
                  value={form.effectiveFrom}
                  onChangeText={(effectiveFrom) => setForm((current) => ({ ...current, effectiveFrom }))}
                  placeholder="2026-09-13"
                />
                <Field
                  label="EFFECTIVE TO (YYYY-MM-DD)"
                  value={form.effectiveTo}
                  onChangeText={(effectiveTo) => setForm((current) => ({ ...current, effectiveTo }))}
                  placeholder="Optional"
                />
                <Field
                  label="DUE RULE KIND"
                  value={form.dueRuleKind}
                  onChangeText={(dueRuleKind) => setForm((current) => ({ ...current, dueRuleKind }))}
                  placeholder="END_OF_PERIOD"
                />
                <Field
                  label="DUE OFFSET DAYS"
                  value={form.dueOffsetDays}
                  onChangeText={(dueOffsetDays) => setForm((current) => ({ ...current, dueOffsetDays }))}
                  keyboardType="number-pad"
                />

                <View style={styles.formActions}>
                  <Pressable
                    disabled={saving}
                    onPress={() => void save()}
                    style={[styles.primaryButton, saving && styles.disabled]}
                  >
                    <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save template'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditing(null);
                      setForm(EMPTY_FORM);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {publishTarget ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>PUBLISH REAL DEADLINE</Text>
                <Text style={styles.publishTitle}>{publishTarget.title}</Text>
                <Text style={styles.note}>
                  This is the live action. Publishing creates one assignment for every active member currently in this Organization/Cluster. That member list is frozen for this deadline; retries will not silently add new members.
                </Text>
                <Field
                  label="OPENS — MANILA TIME (YYYY-MM-DD HH:mm)"
                  value={deadline.opensAt}
                  onChangeText={(opensAt) => setDeadline((current) => ({ ...current, opensAt }))}
                  placeholder="2026-09-13 08:00"
                />
                <Field
                  label="DEADLINE — MANILA TIME (YYYY-MM-DD HH:mm)"
                  value={deadline.deadlineAt}
                  onChangeText={(deadlineAt) => setDeadline((current) => ({ ...current, deadlineAt }))}
                  placeholder="2026-09-19 21:00"
                />
                <Field
                  label="CLOSES — OPTIONAL (YYYY-MM-DD HH:mm)"
                  value={deadline.closesAt}
                  onChangeText={(closesAt) => setDeadline((current) => ({ ...current, closesAt }))}
                  placeholder="Leave blank to allow late submission"
                />

                <View style={styles.confirmBox}>
                  <Switch value={publishConfirmed} onValueChange={setPublishConfirmed} />
                  <Text style={styles.confirmText}>
                    I understand that Publish & notify immediately creates member assignments and queues in-app/push notifications.
                  </Text>
                </View>

                <View style={styles.formActions}>
                  <Pressable
                    disabled={publishing || !publishConfirmed || !deadline.deadlineAt.trim()}
                    onPress={() => void publish()}
                    style={[
                      styles.primaryButton,
                      (publishing || !publishConfirmed || !deadline.deadlineAt.trim()) && styles.disabled,
                    ]}
                  >
                    {publishing ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {publishing ? 'Publishing...' : 'Publish & notify members'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={publishing}
                    onPress={() => {
                      setPublishTarget(null);
                      setPublishConfirmed(false);
                      setDeadline(EMPTY_DEADLINE);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>DEFINITIONS</Text>
              <Text style={styles.note}>
                Bell = create the actual deadline. Pencil = edit the template. Draft/template changes alone never notify members.
              </Text>
              {rows.length === 0 ? (
                <Text style={styles.note}>No report definitions yet.</Text>
              ) : (
                rows.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      <Text style={styles.rowMeta}>
                        {row.code} · {row.recurrence_kind} · {row.status}
                        {row.is_required ? ' · Required' : ' · Optional'}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      {row.status !== 'ARCHIVED' ? (
                        <Pressable
                          accessibilityLabel={`Publish deadline for ${row.title}`}
                          onPress={() => startPublish(row)}
                          style={styles.iconButton}
                        >
                          <MaterialCommunityIcons name="bell-plus-outline" size={21} color={colors.greenDark} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => startEdit(row)} style={styles.iconButton}>
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.greenDark} />
                      </Pressable>
                      {row.status !== 'ARCHIVED' ? (
                        <Pressable onPress={() => void changeStatus(row, 'ARCHIVED')} style={styles.iconButton}>
                          <MaterialCommunityIcons name="archive-outline" size={20} color={colors.muted} />
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => void changeStatus(row, 'DRAFT')} style={styles.iconButton}>
                          <MaterialCommunityIcons name="restore" size={20} color={colors.greenDark} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words';
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.greenDark,
  },
  hero: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.greenDark,
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.86)',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.greenDark,
  },
  publishTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.muted,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.greenDark,
    backgroundColor: colors.greenDark,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  confirmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
  },
  confirmText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.text,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  rowMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 7,
  },
});
