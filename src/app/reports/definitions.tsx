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

export default function BuklodReportDefinitionsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readReportScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<ReportDefinitionRow[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<ReportDefinitionRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

      const definitions = await listReportDefinitions(scopeId, includeArchived);
      setRows(definitions);
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error
          ? error.message
          : 'Could not load report definitions.'
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId, includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (row: ReportDefinitionRow) => {
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

  const save = async () => {
    if (!scopeId) {
      return;
    }

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
        submitterRules: {
          mode: 'SCOPE_FUNCTIONAL_ROLES',
        },
        recipientRules: {
          mode: 'SCOPE_ADMINS',
        },
      });

      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
      Alert.alert('BUKLOD Report', 'Report definition saved.');
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Report',
        error instanceof Error
          ? error.message
          : 'Could not save report definition.'
      );
    } finally {
      setSaving(false);
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
        error instanceof Error
          ? error.message
          : 'Could not update report status.'
      );
    }
  };

  const editorVisible = editing !== null || form.code !== '' || form.title !== '';

  const statusChips = useMemo(
    () => REPORT_DEFINITION_STATUS_OPTIONS,
    []
  );

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
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.greenDark}
          />
          <Text style={styles.backText}>BUKLOD Report</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Report definitions</Text>
          <Text style={styles.heroSubtitle}>
            Configure required reports for this exact scope. Submissions and
            reminders arrive in the next phase.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} />
        ) : !allowed ? (
          <View style={styles.card}>
            <Text style={styles.note}>
              Exact-scope admin access is required to manage BUKLOD Report
              definitions.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Pressable onPress={startCreate} style={styles.primaryButton}>
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>New definition</Text>
              </Pressable>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show archived</Text>
                <Switch
                  value={includeArchived}
                  onValueChange={setIncludeArchived}
                />
              </View>
            </View>

            {editorVisible ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {editing ? 'Edit definition' : 'New definition'}
                </Text>

                <Field
                  label="CODE"
                  value={form.code}
                  onChangeText={(code) => setForm((current) => ({ ...current, code }))}
                  placeholder="MONTHLY_MEMBERSHIP"
                  autoCapitalize="characters"
                />
                <Field
                  label="TITLE"
                  value={form.title}
                  onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                  placeholder="Monthly membership report"
                />
                <Field
                  label="DESCRIPTION"
                  value={form.description}
                  onChangeText={(description) =>
                    setForm((current) => ({ ...current, description }))
                  }
                  multiline
                />
                <Field
                  label="INSTRUCTIONS"
                  value={form.instructions}
                  onChangeText={(instructions) =>
                    setForm((current) => ({ ...current, instructions }))
                  }
                  multiline
                />

                <Text style={styles.fieldLabel}>RECURRENCE</Text>
                <View style={styles.chipRow}>
                  {REPORT_RECURRENCE_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={form.recurrenceKind === option}
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          recurrenceKind: option,
                        }))
                      }
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.chipRow}>
                  {statusChips.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      selected={form.status === option}
                      onPress={() =>
                        setForm((current) => ({ ...current, status: option }))
                      }
                    />
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Required report</Text>
                  <Switch
                    value={form.isRequired}
                    onValueChange={(isRequired) =>
                      setForm((current) => ({ ...current, isRequired }))
                    }
                  />
                </View>

                <Field
                  label="EFFECTIVE FROM (YYYY-MM-DD)"
                  value={form.effectiveFrom}
                  onChangeText={(effectiveFrom) =>
                    setForm((current) => ({ ...current, effectiveFrom }))
                  }
                  placeholder="2026-01-01"
                />
                <Field
                  label="EFFECTIVE TO (YYYY-MM-DD)"
                  value={form.effectiveTo}
                  onChangeText={(effectiveTo) =>
                    setForm((current) => ({ ...current, effectiveTo }))
                  }
                  placeholder="Optional"
                />
                <Field
                  label="DUE RULE KIND"
                  value={form.dueRuleKind}
                  onChangeText={(dueRuleKind) =>
                    setForm((current) => ({ ...current, dueRuleKind }))
                  }
                  placeholder="END_OF_PERIOD"
                />
                <Field
                  label="DUE OFFSET DAYS"
                  value={form.dueOffsetDays}
                  onChangeText={(dueOffsetDays) =>
                    setForm((current) => ({ ...current, dueOffsetDays }))
                  }
                  keyboardType="number-pad"
                />

                <View style={styles.formActions}>
                  <Pressable
                    disabled={saving}
                    onPress={() => void save()}
                    style={[styles.primaryButton, saving && styles.disabled]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {saving ? 'Saving...' : 'Save definition'}
                    </Text>
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>DEFINITIONS</Text>
              {rows.length === 0 ? (
                <Text style={styles.note}>No report definitions yet.</Text>
              ) : (
                rows.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      <Text style={styles.rowMeta}>
                        {row.code} · {row.recurrence_kind} · {row.status}
                        {row.is_required ? ' · Required' : ' · Optional'}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => startEdit(row)}>
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={20}
                          color={colors.greenDark}
                        />
                      </Pressable>
                      {row.status !== 'ARCHIVED' ? (
                        <Pressable
                          onPress={() => void changeStatus(row, 'ARCHIVED')}
                        >
                          <MaterialCommunityIcons
                            name="archive-outline"
                            size={20}
                            color={colors.muted}
                          />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => void changeStatus(row, 'DRAFT')}
                        >
                          <MaterialCommunityIcons
                            name="restore"
                            size={20}
                            color={colors.greenDark}
                          />
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
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
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.4,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  toolbar: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.3,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFCFB',
    color: colors.text,
    fontSize: 13,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
  },
  chipTextSelected: {
    color: colors.greenDark,
  },
  formActions: {
    gap: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  rowMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disabled: {
    opacity: 0.6,
  },
});
