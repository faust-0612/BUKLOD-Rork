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
  setReportDefinitionStatus,
  upsertReportDefinition,
} from '@/lib/buklodReportDomain';
import type { ReportDefinitionRow, ReportRecurrenceKind } from '@/lib/buklodReportContracts';
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
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function safeFieldType(value: unknown): ReportTemplateFieldType {
  const candidate = String(value ?? '').trim() as ReportTemplateFieldType;
  return FIELD_TYPES.some((row) => row.value === candidate) ? candidate : 'long_text';
}
function isMzbTemplate(row: ReportDefinitionRow | null | undefined) {
  const requirements = objectValue(row?.content_requirements);
  return String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1' || String(requirements.schema ?? '') === 'BUKLOD_QUICK_WEEKLY_V1';
}
function definitionCode(title: string, category: string) {
  const base = `${category}_${title}`.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56);
  return `${base || 'CUSTOM'}_REPORT`.slice(0, 64);
}
function baseCode(code: string) {
  return code.replace(/_V\d+$/i, '').slice(0, 54);
}
function sectionsFromDefinition(row: ReportDefinitionRow): ReportTemplateSection[] {
  const requirements = objectValue(row.content_requirements);
  if (Array.isArray(requirements.sections)) {
    return requirements.sections.flatMap((sectionValue: unknown, sectionIndex: number) => {
      const section = objectValue(sectionValue);
      const id = String(section.id ?? `section_${sectionIndex + 1}`);
      const fields = (Array.isArray(section.fields) ? section.fields : []).flatMap((fieldValue: unknown, fieldIndex: number) => {
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
          options: Array.isArray(field.options) ? field.options.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
        } satisfies ReportTemplateField];
      });
      return [{ id, title: String(section.title ?? `Section ${sectionIndex + 1}`), description: section.description ? String(section.description) : null, fields }];
    });
  }
  if (Array.isArray(requirements.fields) && requirements.fields.length) {
    const sectionId = 'report_fields';
    return [{
      id: sectionId,
      title: 'Report fields',
      description: null,
      fields: requirements.fields.flatMap((fieldValue: unknown, index: number) => {
        const field = objectValue(fieldValue);
        const label = String(field.label ?? '').trim();
        if (!label) return [];
        return [{ id: String(field.id ?? `field_${index + 1}`), section_id: sectionId, label, type: safeFieldType(field.type), required: field.required === true, help: field.help ? String(field.help) : null, options: Array.isArray(field.options) ? field.options.map(String) : [] }];
      }),
    }];
  }
  return [];
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
    if (!scopeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      if (!access.allowed) return;
      if (!definitionId) {
        setExisting(null); setMeta(EMPTY_META); setSections([]); setImportMeta(null); return;
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
        const info = objectValue(requirements.import_meta);
        setImportMeta({
          source_file: requirements.source_file,
          provider: String(info.provider ?? ''),
          model: String(info.model ?? ''),
          confidence: Number(info.confidence ?? 0),
          warnings: Array.isArray(info.warnings) ? info.warnings.map(String) : [],
        });
      }
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not open template builder.');
    } finally { setLoading(false); }
  }, [definitionId, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const analyzeFile = async () => {
    if (!scopeId || mzb || importing) return;
    setImporting(true);
    try {
      const result = await pickAndAnalyzeReportTemplate({ scopeId, reportKindHint: importKindHint });
      if (!result) return;
      setSections(result.draft.sections);
      setImportMeta({ provider: result.provider, model: result.model, source_file: result.source_file, confidence: result.draft.confidence, warnings: result.draft.warnings });
      setMeta((current) => ({
        ...current,
        code: current.code || definitionCode(result.draft.title, result.draft.category),
        title: result.draft.title || current.title,
        category: result.draft.category || current.category,
        description: result.draft.description ?? current.description,
        instructions: result.draft.instructions ?? current.instructions,
      }));
      if (result.draft.fields.length === 0) Alert.alert('No reliable fields detected', 'Nothing was auto-added. Review the source and add the actual fields manually.');
    } catch (error: unknown) {
      Alert.alert('Could not analyze reporting layout', error instanceof Error ? error.message : 'Import failed.');
    } finally { setImporting(false); }
  };

  const addSection = () => setSections((current) => [...current, { id: `section_${Date.now()}`, title: 'New section', description: null, fields: [] }]);
  const updateSection = (sectionId: string, patch: Partial<Pick<ReportTemplateSection, 'title' | 'description'>>) => setSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  const removeSection = (sectionId: string) => setSections((current) => current.filter((section) => section.id !== sectionId));
  const moveSection = (sectionId: string, delta: number) => setSections((current) => {
    const index = current.findIndex((row) => row.id === sectionId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const addField = (sectionId: string) => setSections((current) => {
    const id = makeReportFieldId(`field_${Date.now()}`, flattenReportTemplateSections(current).map((field) => field.id));
    return current.map((section) => section.id === sectionId ? { ...section, fields: [...section.fields, { id, section_id: sectionId, label: '', type: 'short_text', required: false, help: null, options: [] }] } : section);
  });
  const updateField = (sectionId: string, fieldId: string, patch: Partial<ReportTemplateField>) => setSections((current) => current.map((section) => section.id === sectionId ? { ...section, fields: section.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) } : section));
  const removeField = (sectionId: string, fieldId: string) => setSections((current) => current.map((section) => section.id === sectionId ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) } : section));
  const moveField = (sectionId: string, fieldId: string, delta: number) => setSections((current) => current.map((section) => {
    if (section.id !== sectionId) return section;
    const index = section.fields.findIndex((row) => row.id === fieldId); const target = index + delta;
    if (index < 0 || target < 0 || target >= section.fields.length) return section;
    const next = [...section.fields]; [next[index], next[target]] = [next[target], next[index]];
    return { ...section, fields: next };
  }));

  const save = async () => {
    if (!scopeId || saving || mzb) return;
    if (!meta.code.trim() || !meta.title.trim()) { Alert.alert('BUKLOD Report', 'Report code and title are required.'); return; }
    if (fields.length === 0) { Alert.alert('Add report fields', 'Import or add the actual fields required by this report.'); return; }
    if (fields.some((field) => !field.label.trim())) { Alert.alert('BUKLOD Report', 'Every field must have a label.'); return; }
    if (fields.some((field) => field.type === 'choice' && field.options.length === 0)) { Alert.alert('BUKLOD Report', 'Every Choices field needs at least one option.'); return; }

    setSaving(true);
    try {
      const existingRequirements = objectValue(existing?.content_requirements);
      const oldVersion = Math.max(1, Number(existingRequirements.version ?? 1) || 1);
      const version = existing ? oldVersion + 1 : 1;
      const nextCode = existing ? `${baseCode(existing.code)}_V${version}`.slice(0, 64) : meta.code.trim().toUpperCase();
      const contentRequirements = {
        ...existingRequirements,
        schema: 'BUKLOD_DYNAMIC_FORM_V1',
        template_key: importMeta ? 'BUKLOD_ORG_IMPORTED_V1' : String(existingRequirements.template_key ?? 'BUKLOD_CUSTOM_REPORT_V1'),
        template_label: meta.title.trim(),
        category: meta.category.trim().toUpperCase() || 'CUSTOM',
        version,
        supersedes_definition_id: existing?.id ?? null,
        sections,
        fields,
        source_file: importMeta?.source_file ?? existingRequirements.source_file ?? null,
        import_meta: importMeta ? {
          provider: importMeta.provider,
          model: importMeta.model,
          confidence: importMeta.confidence,
          warnings: importMeta.warnings,
          analyzed_at: new Date().toISOString(),
        } : existingRequirements.import_meta ?? null,
      };

      await upsertReportDefinition({
        scopeId,
        definitionId: null,
        code: nextCode,
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
        status: 'DRAFT',
        isRequired: meta.isRequired,
      });
      if (existing) await setReportDefinitionStatus(existing.id, 'ARCHIVED');
      Alert.alert('Template saved', existing ? `Version ${version} created. The previous version was archived and historical submissions remain linked to it.` : 'Draft template created. No member was notified.');
      router.back();
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not save report template.');
    } finally { setSaving(false); }
  };

  if (!scopeId) return <View style={styles.center}><Text style={styles.title}>No Organization/Cluster scope selected.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Opening template builder…</Text></View>;
  if (!allowed) return <View style={styles.center}><Text style={styles.title}>Exact-scope admin access is required.</Text></View>;

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'New Template Version' : 'Build Report Template' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}><MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} /><Text style={styles.backText}>Report Library</Text></Pressable>
        <View style={styles.hero}><Text style={styles.heroTitle}>{mzb ? 'MZB Ministerial Report' : 'Adaptive Report Builder'}</Text><Text style={styles.heroText}>{mzb ? 'The current MZB Ministerial layout is protected and remains unchanged.' : existing ? 'Edits are saved as a new immutable version; old reporting periods keep the exact template they used.' : 'Upload an existing reporting layout or build it manually. Nothing is published until a deadline is explicitly created.'}</Text></View>

        {mzb ? (
          <View style={styles.mzbCard}><MaterialCommunityIcons name="shield-lock-outline" size={26} color={colors.greenDark} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>MZB TEMPLATE LOCKED</Text><Text style={styles.note}>Activities, attendance, concerns, goals, assistance and notes remain on the established MZB layout. This builder will not rewrite it.</Text></View></View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>UPLOAD REPORTING LAYOUT</Text>
              <Text style={styles.note}>PDF, Word, Excel/CSV, text or image. Analysis creates a draft only; review every field before saving.</Text>
              <Field label="REPORT TYPE — OPTIONAL HINT" value={importKindHint} onChangeText={setImportKindHint} placeholder="HRMO, RRMO, Finance, Compliance…" />
              <Pressable disabled={importing} onPress={() => void analyzeFile()} style={[styles.primaryButton, importing && styles.disabled]}>{importing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="file-upload-outline" size={18} color="#FFFFFF" />}<Text style={styles.primaryText}>{importing ? 'Analyzing…' : 'Choose file & build draft'}</Text></Pressable>
              {importMeta ? <View style={styles.sourceBox}><MaterialCommunityIcons name="file-check-outline" size={20} color={colors.greenDark} /><View style={{ flex: 1 }}><Text style={styles.sourceTitle}>{importMeta.source_file.name}</Text><Text style={styles.note}>Analyzer confidence {Math.round(importMeta.confidence * 100)}% · review required</Text></View></View> : null}
              {importMeta?.warnings.map((warning, index) => <Text key={`${warning}-${index}`} style={styles.warning}>• {warning}</Text>)}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>REPORT CARD DETAILS</Text>
              <Field label="CODE" value={meta.code} onChangeText={(code) => setMeta((current) => ({ ...current, code }))} placeholder="FINANCE_MONTHLY_REPORT" />
              <Field label="TITLE" value={meta.title} onChangeText={(title) => setMeta((current) => ({ ...current, title }))} placeholder="Finance Report" />
              <Field label="CATEGORY" value={meta.category} onChangeText={(category) => setMeta((current) => ({ ...current, category }))} placeholder="FINANCE" />
              <Field label="DESCRIPTION" value={meta.description} onChangeText={(description) => setMeta((current) => ({ ...current, description }))} multiline />
              <Field label="INSTRUCTIONS" value={meta.instructions} onChangeText={(instructions) => setMeta((current) => ({ ...current, instructions }))} multiline />
              <Text style={styles.fieldLabel}>RECURRENCE</Text>
              <View style={styles.chips}>{REPORT_RECURRENCE_OPTIONS.map((option) => <Chip key={option} label={option} selected={meta.recurrenceKind === option} onPress={() => setMeta((current) => ({ ...current, recurrenceKind: option }))} />)}</View>
              <View style={styles.switchRow}><Text style={styles.switchText}>Required report</Text><Switch value={meta.isRequired} onValueChange={(isRequired) => setMeta((current) => ({ ...current, isRequired }))} /></View>
            </View>

            <View style={styles.card}>
              <View style={styles.builderHeader}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>REPORT FIELDS</Text><Text style={styles.note}>Add, remove and reorder sections/fields. No automatic fallback field is invented.</Text></View><Pressable onPress={addSection} style={styles.smallButton}><MaterialCommunityIcons name="plus" size={15} color={colors.greenDark} /><Text style={styles.smallText}>Section</Text></Pressable></View>
              {sections.length === 0 ? <View style={styles.emptyBox}><Text style={styles.note}>No fields yet.</Text><Pressable onPress={addSection} style={styles.secondaryButton}><Text style={styles.secondaryText}>Add first section</Text></Pressable></View> : sections.map((section, sectionIndex) => (
                <View key={section.id} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>SECTION {sectionIndex + 1}</Text><View style={styles.inlineActions}><IconButton icon="arrow-up" onPress={() => moveSection(section.id, -1)} /><IconButton icon="arrow-down" onPress={() => moveSection(section.id, 1)} /><IconButton icon="trash-can-outline" danger onPress={() => removeSection(section.id)} /></View></View>
                  <Field label="SECTION TITLE" value={section.title} onChangeText={(title) => updateSection(section.id, { title })} />
                  <Field label="SECTION DESCRIPTION — OPTIONAL" value={section.description ?? ''} onChangeText={(description) => updateSection(section.id, { description })} multiline />
                  {section.fields.map((field, fieldIndex) => (
                    <View key={field.id} style={styles.fieldCard}>
                      <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>FIELD {fieldIndex + 1}</Text><View style={styles.inlineActions}><IconButton icon="arrow-up" onPress={() => moveField(section.id, field.id, -1)} /><IconButton icon="arrow-down" onPress={() => moveField(section.id, field.id, 1)} /><IconButton icon="close" danger onPress={() => removeField(section.id, field.id)} /></View></View>
                      <Field label="FIELD LABEL" value={field.label} onChangeText={(label) => updateField(section.id, field.id, { label })} placeholder="Question / field name" />
                      <Field label="HELP / INSTRUCTION — OPTIONAL" value={field.help ?? ''} onChangeText={(help) => updateField(section.id, field.id, { help })} multiline />
                      <Text style={styles.fieldLabel}>TYPE</Text>
                      <View style={styles.chips}>{FIELD_TYPES.map((option) => <Chip key={option.value} label={option.label} selected={field.type === option.value} onPress={() => updateField(section.id, field.id, { type: option.value, options: option.value === 'choice' ? field.options : [] })} />)}</View>
                      {field.type === 'choice' ? <Field label="CHOICES — ONE PER LINE" value={field.options.join('\n')} onChangeText={(value) => updateField(section.id, field.id, { options: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })} multiline /> : null}
                      <View style={styles.switchRow}><Text style={styles.switchText}>Required field</Text><Switch value={field.required} onValueChange={(required) => updateField(section.id, field.id, { required })} /></View>
                    </View>
                  ))}
                  <Pressable onPress={() => addField(section.id)} style={styles.secondaryButton}><MaterialCommunityIcons name="plus" size={16} color={colors.greenDark} /><Text style={styles.secondaryText}>Add field</Text></Pressable>
                </View>
              ))}
            </View>

            <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="content-save-outline" size={19} color="#FFFFFF" />}<Text style={styles.primaryText}>{saving ? 'Saving…' : existing ? 'Save as new version' : 'Save draft template'}</Text></Pressable>
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}
function IconButton({ icon, onPress, danger = false }: { icon: any; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} style={styles.iconButton}><MaterialCommunityIcons name={icon} size={17} color={danger ? '#9A3412' : colors.greenDark} /></Pressable>;
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
  primaryButton: { minHeight: 43, borderRadius: 10, backgroundColor: colors.greenDark, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 39, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secondaryText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  sourceBox: { borderRadius: 11, padding: 10, backgroundColor: '#F1F8F4', flexDirection: 'row', gap: 8, alignItems: 'center' },
  sourceTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  warning: { color: '#92400E', fontSize: 9, lineHeight: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: colors.greenDark, backgroundColor: '#EAF5EF' },
  chipText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  chipTextSelected: { color: colors.greenDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  builderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallButton: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallText: { color: colors.greenDark, fontSize: 9, fontWeight: '900' },
  emptyBox: { borderRadius: 11, padding: 12, backgroundColor: '#F7F9F8', gap: 8 },
  sectionCard: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE5E0', padding: 11, gap: 9 },
  fieldCard: { borderRadius: 11, backgroundColor: '#F7F9F8', padding: 10, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  inlineActions: { flexDirection: 'row', gap: 3 },
  iconButton: { width: 31, height: 31, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  saveButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.greenDark, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabled: { opacity: 0.45 },
});
