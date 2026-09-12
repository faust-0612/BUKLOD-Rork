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
import {
  getReportDefinition,
  REPORT_RECURRENCE_OPTIONS,
  upsertReportDefinition,
} from '@/lib/buklodReportDomain';
import type {
  ReportDefinitionRow,
  ReportRecurrenceKind,
} from '@/lib/buklodReportContracts';
import {
  flattenReportTemplateSections,
  makeReportFieldId,
  pickAndAnalyzeReportTemplate,
  type ReportTemplateField,
  type ReportTemplateFieldType,
  type ReportTemplateImportResult,
  type ReportTemplateSection,
} from '@/lib/buklodReportTemplateImport';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

const FIELD_TYPES: Array<{ value: ReportTemplateFieldType; label: string }> = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'choice', label: 'Choices' },
];

const EMPTY_META = {
  code: '',
  title: '',
  category: 'CUSTOM',
  description: '',
  instructions: '',
  recurrenceKind: 'MONTHLY' as ReportRecurrenceKind,
  isRequired: true,
};

type ImportMeta = Pick<ReportTemplateImportResult, 'provider' | 'model' | 'source_file'> & {
  confidence: number;
  warnings: string[];
};

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function isMzbTemplate(row: ReportDefinitionRow | null | undefined) {
  const requirements = objectValue(row?.content_requirements);
  return (
    String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1' ||
    String(requirements.schema ?? '') === 'BUKLOD_QUICK_WEEKLY_V1'
  );
}

function safeFieldType(value: unknown): ReportTemplateFieldType {
  const candidate = String(value ?? '').trim() as ReportTemplateFieldType;
  return FIELD_TYPES.some((row) => row.value === candidate) ? candidate : 'long_text';
}

function sectionsFromDefinition(row: ReportDefinitionRow): ReportTemplateSection[] {
  const requirements = objectValue(row.content_requirements);
  if (Array.isArray(requirements.sections)) {
    return requirements.sections.flatMap((sectionValue: unknown, sectionIndex: number) => {
      const section = objectValue(sectionValue);
      const id = String(section.id ?? `section_${sectionIndex + 1}`);
      const fields = (Array.isArray(section.fields) ? section.fields : []).flatMap(
        (fieldValue: unknown, fieldIndex: number) => {
          const field = objectValue(fieldValue);
          const label = String(field.label ?? '').trim();
          if (!label) return [];
          return [{
            id: String(field.id ?? `field_${sectionIndex + 1}_${fieldIndex + 1}`),
            section_id: id,
            label,
            type: safeFieldType(field.type),
            required: field.required === true,
            help: field.help ? String(field.help) : null,
            options: Array.isArray(field.options)
              ? field.options.map((item: unknown) => String(item).trim()).filter(Boolean)
              : [],
          } satisfies ReportTemplateField];
        }
      );
      return [{
        id,
        title: String(section.title ?? `Section ${sectionIndex + 1}`),
        description: section.description ? String(section.description) : null,
        fields,
      } satisfies ReportTemplateSection];
    });
  }

  if (Array.isArray(requirements.fields) && requirements.fields.length) {
    const sectionId = 'report_fields';
    return [{
      id: sectionId,
      title: 'Report fields',
      description: null,
      fields: requirements.fields.flatMap((fieldValue: unknown, fieldIndex: number) => {
        const field = objectValue(fieldValue);
        const label = String(field.label ?? '').trim();
        if (!label) return [];
        return [{
          id: String(field.id ?? `field_${fieldIndex + 1}`),
          section_id: sectionId,
          label,
          type: safeFieldType(field.type),
          required: field.required === true,
          help: field.help ? String(field.help) : null,
          options: Array.isArray(field.options)
            ? field.options.map((item: unknown) => String(item).trim()).filter(Boolean)
            : [],
        } satisfies ReportTemplateField];
      }),
    }];
  }

  return [];
}

function definitionCode(title: string, category: string) {
  const base = `${category}_${title}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
  return `${base || 'CUSTOM'}_REPORT`.slice(0, 64);
}

export default function BuklodReportTemplateBuilderScreen() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const definitionId = firstParam(params.definitionId ?? params.definition_id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [existing, setExisting] = useState<ReportDefinitionRow | null>(null);
  const [meta, setMeta] = useState(EMPTY_META);
  const [sections, setSections] = useState<ReportTemplateSection[]>([]);
  const [importKindHint, setImportKindHint] = useState('');
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);

  const mzb = useMemo(() => isMzbTemplate(existing), [existing]);
  const fields = useMemo(() => flattenReportTemplateSections(sections), [sections]);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      if (!access.allowed) return;

      if (!definitionId) {
        setExisting(null);
        setMeta(EMPTY_META);
        setSections([]);
        setImportMeta(null);
        return;
      }

      const row = await getReportDefinition(definitionId);
      if (row.scope_id !== scopeId) throw new Error('This report template belongs to a different scope.');
      const requirements = objectValue(row.content_requirements);
      setExisting(row);
      setMeta({
        code: row.code,
        title: row.title,
        category: String(requirements.category ?? (isMzbTemplate(row) ? 'MINISTRY' : 'CUSTOM')),
        description: row.description ?? '',
        instructions: row.instructions ?? '',
        recurrenceKind: row.recurrence_kind,
        isRequired: row.is_required,
      });
      setSections(isMzbTemplate(row) ? [] : sectionsFromDefinition(row));
      if (requirements.source_file) {
        const importInfo = objectValue(requirements.import_meta);
        setImportMeta({
          source_file: requirements.source_file,
          provider: String(importInfo.provider ?? ''),
          model: String(importInfo.model ?? ''),
          confidence: Number(importInfo.confidence ?? 0),
          warnings: Array.isArray(importInfo.warnings)
            ? importInfo.warnings.map((item: unknown) => String(item))
            : [],
        });
      }
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not open template builder.');
    } finally {
      setLoading(false);
    }
  }, [definitionId, scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analyzeFile = async () => {
    if (!scopeId || mzb || importing) return;
    setImporting(true);
    try {
      const result = await pickAndAnalyzeReportTemplate({ scopeId, reportKindHint: importKindHint });
      if (!result) return;
      setSections(result.draft.sections);
      setImportMeta({
        provider: result.provider,
        model: result.model,
        source_file: result.source_file,
        confidence: result.draft.confidence,
        warnings: result.draft.warnings,
      });
      setMeta((current) => ({
        ...current,
        code: current.code || definitionCode(result.draft.title, result.draft.category),
        title: result.draft.title || current.title,
        category: result.draft.category || current.category,
        description: result.draft.description ?? current.description,
        instructions: result.draft.instructions ?? current.instructions,
      }));
      if (result.draft.fields.length === 0) {
        Alert.alert(
          'No reliable fields detected',
          'No automatic field was added. Add only the fields that truly belong to this reporting form.'
        );
      }
    } catch (error: unknown) {
      Alert.alert('Could not analyze reporting layout', error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const addSection = () => {
    setSections((current) => [
      ...current,
      { id: `section_${Date.now()}`, title: 'New section', description: null, fields: [] },
    ]);
  };

  const updateSection = (
    sectionId: string,
    patch: Partial<Pick<ReportTemplateSection, 'title' | 'description'>>
  ) => {
    setSections((current) => current.map((section) => (
      section.id === sectionId ? { ...section, ...patch } : section
    )));
  };

  const removeSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId));
  };

  const addField = (sectionId: string) => {
    setSections((current) => {
      const id = makeReportFieldId(
        `field_${Date.now()}`,
        flattenReportTemplateSections(current).map((field) => field.id)
      );
      return current.map((section) => section.id === sectionId
        ? {
            ...section,
            fields: [
              ...section.fields,
              {
                id,
                section_id: sectionId,
                label: '',
                type: 'short_text',
                required: false,
                help: null,
                options: [],
              },
            ],
          }
        : section
      );
    });
  };

  const updateField = (
    sectionId: string,
    fieldId: string,
    patch: Partial<ReportTemplateField>
  ) => {
    setSections((current) => current.map((section) => section.id === sectionId
      ? {
          ...section,
          fields: section.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
        }
      : section
    ));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) }
      : section
    ));
  };

  const save = async () => {
    if (!scopeId || saving) return;
    if (!meta.code.trim() || !meta.title.trim()) {
      Alert.alert('BUKLOD Report', 'Report code and title are required.');
      return;
    }

    if (!mzb) {
      if (fields.length === 0) {
        Alert.alert(
          'Add report fields',
          'BUKLOD will not add an automatic fallback field. Import or add the actual fields required by this report.'
        );
        return;
      }
      if (fields.some((field) => !field.label.trim())) {
        Alert.alert('BUKLOD Report', 'Every field must have a label.');
        return;
      }
      if (fields.some((field) => field.type === 'choice' && field.options.length === 0)) {
        Alert.alert('BUKLOD Report', 'Every Choices field needs at least one option.');
        return;
      }
    }

    setSaving(true);
    try {
      const existingRequirements = objectValue(existing?.content_requirements);
      const contentRequirements = mzb
        ? existingRequirements
        : {
            ...existingRequirements,
            schema: 'BUKLOD_DYNAMIC_FORM_V1',
            template_key: importMeta
              ? 'BUKLOD_ORG_IMPORTED_V1'
              : String(existingRequirements.template_key ?? 'BUKLOD_CUSTOM_REPORT_V1'),
            template_label: meta.title.trim(),
            category: meta.category.trim().toUpperCase() || 'CUSTOM',
            sections,
            fields,
            source_file: importMeta?.source_file ?? existingRequirements.source_file ?? null,
            import_meta: importMeta
              ? {
                  provider: importMeta.provider,
                  model: importMeta.model,
                  confidence: importMeta.confidence,
                  warnings: importMeta.warnings,
                  analyzed_at: new Date().toISOString(),
                }
              : existingRequirements.import_meta ?? null,
          };

      await upsertReportDefinition({
        scopeId,
        definitionId: existing?.id ?? null,
        code: meta.code.trim().toUpperCase(),
        title: meta.title.trim(),
        description: meta.description.trim(),
        instructions: meta.instructions.trim(),
        recurrenceKind: meta.recurrenceKind,
        recurrenceConfig: existing?.recurrence_config ?? {},
        submitterRules: existing?.submitter_rules ?? { mode: 'SCOPE_FUNCTIONAL_ROLES' },
        recipientRules: existing?.recipient_rules ?? { mode: 'SCOPE_ADMINS' },
        contentRequirements,
        validationConfig: existing?.validation_config ?? {},
        autoApprovalConfig: existing?.auto_approval_config ?? {},
        formMode: existing?.form_mode ?? 'FLEXIBLE',
        reminderConfig: existing?.reminder_config ?? [],
        rawRetentionDays: existing?.raw_retention_days ?? 30,
        status: existing?.status ?? 'DRAFT',
        isRequired: meta.isRequired,
      });

      Alert.alert('Template saved', 'No member was notified. The report card is ready for deadline publishing.');
      router.back();
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not save report template.');
    } finally {
      setSaving(false);
    }
  };

  if (!scopeId) {
    return <View style={styles.center}><Text style={styles.title}>No Organization/Cluster scope selected.</Text></View>;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Opening template builder…</Text></View>;
  }

  if (!allowed) {
    return <View style={styles.center}><Text style={styles.title}>Exact-scope admin access is required.</Text></View>;
  }

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit Report Template' : 'Build Report Template' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>Report Library</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{mzb ? 'MZB Ministerial Report' : 'Adaptive Report Builder'}</Text>
          <Text style={styles.heroText}>
            {mzb
              ? 'The current MZB Ministerial reporting layout is preserved as a dedicated template.'
              : 'Upload the Organization/Cluster reporting form, then review, add, remove, or correct fields before saving.'}
          </Text>
        </View>

        {!mzb ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>UPLOAD REPORTING LAYOUT</Text>
            <Text style={styles.note}>
              PDF, Word, Excel/CSV, text, or photo. This analyzes the blank form structure only. It does not submit a report or affect the Quick Weekly file/photo import.
            </Text>
            <Field
              label="REPORT TYPE — OPTIONAL HINT"
              value={importKindHint}
              onChangeText={setImportKindHint}
              placeholder="HRMO, RRMO, Finance, Compliance, etc."
            />
            <Pressable disabled={importing} onPress={() => void analyzeFile()} style={[styles.primaryButton, importing && styles.disabled]}>
              {importing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="file-upload-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{importing ? 'Analyzing…' : 'Choose file & build draft'}</Text>
            </Pressable>
            {importMeta ? (
              <View style={styles.sourceBox}>
                <MaterialCommunityIcons name="file-check-outline" size={20} color={colors.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceTitle}>{importMeta.source_file.name}</Text>
                  <Text style={styles.note}>Analyzer confidence {Math.round(importMeta.confidence * 100)}% · source stored privately</Text>
                </View>
              </View>
            ) : null}
            {importMeta?.warnings.map((warning, index) => (
              <Text key={`${warning}-${index}`} style={styles.warning}>• {warning}</Text>
            ))}
          </View>
        ) : (
          <View style={styles.mzbCard}>
            <MaterialCommunityIcons name="church-outline" size={26} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>CURRENT MZB LAYOUT PRESERVED</Text>
              <Text style={styles.note}>Activities, people/attendance, concerns, next-period goals, assistance and notes stay on the existing MZB form.</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>REPORT CARD DETAILS</Text>
          <Field label="CODE" value={meta.code} onChangeText={(code) => setMeta((current) => ({ ...current, code }))} placeholder="FINANCE_MONTHLY_REPORT" autoCapitalize="characters" />
          <Field label="TITLE" value={meta.title} onChangeText={(title) => setMeta((current) => ({ ...current, title }))} placeholder="Finance Report" />
          <Field label="CATEGORY" value={meta.category} onChangeText={(category) => setMeta((current) => ({ ...current, category }))} placeholder="FINANCE" autoCapitalize="characters" />
          <Field label="DESCRIPTION" value={meta.description} onChangeText={(description) => setMeta((current) => ({ ...current, description }))} multiline />
          <Field label="INSTRUCTIONS" value={meta.instructions} onChangeText={(instructions) => setMeta((current) => ({ ...current, instructions }))} multiline />

          <Text style={styles.fieldLabel}>RECURRENCE</Text>
          <View style={styles.chips}>
            {REPORT_RECURRENCE_OPTIONS.map((option) => (
              <Chip key={option} label={option} selected={meta.recurrenceKind === option} onPress={() => setMeta((current) => ({ ...current, recurrenceKind: option }))} />
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Required report</Text>
            <Switch value={meta.isRequired} onValueChange={(isRequired) => setMeta((current) => ({ ...current, isRequired }))} />
          </View>
        </View>

        {!mzb ? (
          <View style={styles.card}>
            <View style={styles.builderHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>REPORT FIELDS</Text>
                <Text style={styles.note}>No automatic fallback field. Keep only the fields this reporting system truly requires.</Text>
              </View>
              <Pressable onPress={addSection} style={styles.smallButton}>
                <MaterialCommunityIcons name="plus" size={15} color={colors.greenDark} />
                <Text style={styles.smallText}>Section</Text>
              </Pressable>
            </View>

            {sections.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.note}>No fields yet.</Text>
                <Pressable onPress={addSection} style={styles.secondaryButton}><Text style={styles.secondaryText}>Add first section</Text></Pressable>
              </View>
            ) : sections.map((section, sectionIndex) => (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>SECTION {sectionIndex + 1}</Text>
                  <Pressable onPress={() => removeSection(section.id)} style={styles.iconButton}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#9A3412" /></Pressable>
                </View>
                <Field label="SECTION TITLE" value={section.title} onChangeText={(title) => updateSection(section.id, { title })} />
                <Field label="SECTION DESCRIPTION — OPTIONAL" value={section.description ?? ''} onChangeText={(description) => updateSection(section.id, { description })} multiline />

                {section.fields.map((field, fieldIndex) => (
                  <View key={field.id} style={styles.fieldCard}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>FIELD {fieldIndex + 1}</Text>
                      <Pressable onPress={() => removeField(section.id, field.id)} style={styles.iconButton}><MaterialCommunityIcons name="close" size={18} color="#9A3412" /></Pressable>
                    </View>
                    <Field label="FIELD LABEL" value={field.label} onChangeText={(label) => updateField(section.id, field.id, { label })} placeholder="Question / field name" />
                    <Field label="HELP / INSTRUCTION — OPTIONAL" value={field.help ?? ''} onChangeText={(help) => updateField(section.id, field.id, { help })} multiline />
                    <Text style={styles.fieldLabel}>TYPE</Text>
                    <View style={styles.chips}>
                      {FIELD_TYPES.map((option) => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          selected={field.type === option.value}
                          onPress={() => updateField(section.id, field.id, {
                            type: option.value,
                            options: option.value === 'choice' ? field.options : [],
                          })}
                        />
                      ))}
                    </View>
                    {field.type === 'choice' ? (
                      <Field
                        label="CHOICES — ONE PER LINE"
                        value={field.options.join('\n')}
                        onChangeText={(value) => updateField(section.id, field.id, {
                          options: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                        })}
                        multiline
                      />
                    ) : null}
                    <View style={styles.switchRow}>
                      <Text style={styles.switchText}>Required field</Text>
                      <Switch value={field.required} onValueChange={(required) => updateField(section.id, field.id, { required })} />
                    </View>
                  </View>
                ))}

                <Pressable onPress={() => addField(section.id)} style={styles.secondaryButton}>
                  <MaterialCommunityIcons name="plus" size={16} color={colors.greenDark} />
                  <Text style={styles.secondaryText}>Add field</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="content-save-outline" size={19} color="#FFFFFF" />}
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save report template'}</Text>
        </Pressable>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, backgroundColor: colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: 18, padding: 16, gap: 6, backgroundColor: colors.greenDark },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 17 },
  card: { borderRadius: 15, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  mzbCard: { borderRadius: 15, padding: 14, gap: 10, borderWidth: 1, borderColor: '#CFE3D8', backgroundColor: '#F1F8F4', flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: colors.greenDark, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  fieldWrap: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  input: { minHeight: 43, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 9, color: colors.text },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  primaryButton: { minHeight: 43, borderRadius: 10, backgroundColor: colors.greenDark, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.greenDark, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  sourceBox: { borderRadius: 11, backgroundColor: '#F4F8F6', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  sourceTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  warning: { color: '#92400E', fontSize: 10, lineHeight: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  chipSelected: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  chipText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  chipTextSelected: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchText: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '800' },
  builderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  emptyBox: { gap: 8, paddingVertical: 6 },
  sectionCard: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FAFCFB', padding: 11, gap: 9 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionLabel: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  iconButton: { padding: 5 },
  fieldCard: { borderRadius: 11, borderWidth: 1, borderColor: '#E6ECE8', backgroundColor: '#FFFFFF', padding: 10, gap: 8 },
});
