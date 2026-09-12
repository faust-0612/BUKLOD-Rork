import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodWeeklyReportForm from '@/components/BuklodWeeklyReportForm';
import { setPreferredReportAssignment } from '@/lib/buklodReportDomain';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type DynamicFieldType = 'short_text' | 'long_text' | 'number' | 'date' | 'yes_no' | 'choice';
type DynamicField = {
  id: string;
  label: string;
  type: DynamicFieldType;
  required?: boolean;
  help?: string;
  options?: string[];
};

type ReportContext = {
  scope_id: string;
  scope_name: string;
  scope_type: string;
  report_definition_id: string;
  report_code: string;
  report_title: string;
  report_description: string | null;
  report_instructions: string | null;
  form_mode: string;
  form_schema: string;
  content_requirements: Record<string, unknown>;
  report_period_id: string;
  report_assignment_id: string;
  period_title: string;
  period_key: string;
  opens_at: string | null;
  deadline_at: string;
  closes_at: string | null;
  assignment_status: string;
  submission_id: string | null;
  submission_status: string | null;
  content: Record<string, any>;
};

type Props = {
  scopeId: string;
  assignmentId?: string | null;
  onSubmitted?: () => void;
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function readFields(requirements: Record<string, unknown>): DynamicField[] {
  const source = Array.isArray(requirements.fields) ? requirements.fields : [];
  return source.flatMap((value: unknown, index: number) => {
    const row = objectValue(value);
    const id = String(row.id ?? row.key ?? `field_${index + 1}`).trim();
    const label = String(row.label ?? row.title ?? '').trim();
    const type = String(row.type ?? 'long_text').trim().toLowerCase() as DynamicFieldType;
    if (!id || !label || !['short_text', 'long_text', 'number', 'date', 'yes_no', 'choice'].includes(type)) {
      return [];
    }
    return [{
      id,
      label,
      type,
      required: row.required === true,
      help: row.help ? String(row.help) : undefined,
      options: Array.isArray(row.options)
        ? row.options.map((item: unknown) => String(item).trim()).filter(Boolean)
        : undefined,
    }];
  });
}

function isMzbMinisterialTemplate(context: ReportContext) {
  const requirements = objectValue(context.content_requirements);
  return String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1' ||
    context.form_schema === 'BUKLOD_QUICK_WEEKLY_V1';
}

export default function BuklodReportAssignmentForm({ scopeId, assignmentId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<ReportContext | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedLabel, setSavedLabel] = useState('');

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-report-api-v1', {
        body: {
          action: 'bootstrap_scope',
          scope_id: scopeId,
          assignment_id: assignmentId ?? null,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(String(data?.error ?? 'Unable to open report.'));
      const next = data.context as ReportContext;
      setContext(next);
      setPreferredReportAssignment(scopeId, next.report_assignment_id);
      const storedAnswers = objectValue(objectValue(next.content).answers);
      const flat: Record<string, string> = {};
      Object.entries(storedAnswers).forEach(([key, value]) => {
        flat[key] = value == null ? '' : String(value);
      });
      setAnswers(flat);
    } catch (loadError: any) {
      const message = String(loadError?.message ?? 'Unable to open report.');
      setContext(null);
      setError(
        message.includes('no_report_assignment')
          ? 'No active report assignment. Published Organization or Cluster reports will appear here.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const fields = useMemo(
    () => readFields(objectValue(context?.content_requirements)),
    [context?.content_requirements]
  );
  const readOnly = Boolean(
    context?.submission_status && !['DRAFT', 'NEEDS_REVISION', 'REJECTED'].includes(context.submission_status)
  );

  const save = useCallback(async (submit: boolean) => {
    if (!context || saving || readOnly || fields.length === 0) return;
    if (submit) {
      const missing = fields.find((field) => field.required && !String(answers[field.id] ?? '').trim());
      if (missing) {
        setError(`${missing.label} is required.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('buklod-report-api-v1', {
        body: {
          action: 'save_report',
          scope_id: scopeId,
          assignment_id: context.report_assignment_id,
          content: { schema: context.form_schema || 'BUKLOD_DYNAMIC_FORM_V1', answers },
          submit,
          idempotency_key: submit ? `${context.report_assignment_id}:${Date.now()}` : null,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(String(data?.error ?? 'Report could not be saved.'));
      const result = objectValue(data.result);
      setContext((current) => current ? {
        ...current,
        submission_id: result.submission_id ? String(result.submission_id) : current.submission_id,
        submission_status: result.submission_status ? String(result.submission_status) : current.submission_status,
        assignment_status: result.assignment_status ? String(result.assignment_status) : current.assignment_status,
        content: objectValue(result.content),
      } : current);
      setSavedLabel(submit ? 'Report submitted' : 'Draft saved');
      if (submit) onSubmitted?.();
    } catch (saveError: any) {
      setError(saveError?.message || 'Report could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [answers, context, fields, onSubmitted, readOnly, saving, scopeId]);

  if (loading) {
    return <View style={styles.card}><ActivityIndicator color={colors.green} /><Text style={styles.muted}>Opening assigned report…</Text></View>;
  }

  if (!context) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="clipboard-text-outline" size={24} color={colors.greenDark} />
        <View style={{ flex: 1 }}><Text style={styles.emptyTitle}>No report to submit right now</Text><Text style={styles.muted}>{error}</Text></View>
      </View>
    );
  }

  if (isMzbMinisterialTemplate(context)) {
    return (
      <View style={styles.stack}>
        <View style={styles.templateBanner}>
          <MaterialCommunityIcons name="church-outline" size={20} color={colors.greenDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>MZB MINISTERIAL TEMPLATE</Text>
            <Text style={styles.title}>{context.report_title || 'Ministerial Report'}</Text>
            <Text style={styles.muted}>{context.period_title}</Text>
          </View>
        </View>
        <BuklodWeeklyReportForm scopeId={scopeId} onSubmitted={onSubmitted} />
      </View>
    );
  }

  if (fields.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#92400E" />
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>Report template needs fields</Text>
          <Text style={styles.muted}>This template has no configured fields. BUKLOD will not invent a fallback field; the administrator must review the template.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}><MaterialCommunityIcons name="file-document-edit-outline" size={22} color={colors.greenDark} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ASSIGNED REPORT</Text>
          <Text style={styles.title}>{context.report_title || 'Report'}</Text>
          <Text style={styles.muted}>{context.period_title}</Text>
        </View>
      </View>

      {context.report_description ? <Text style={styles.description}>{context.report_description}</Text> : null}
      {context.report_instructions ? <View style={styles.infoBox}><Text style={styles.eyebrow}>INSTRUCTIONS</Text><Text style={styles.description}>{context.report_instructions}</Text></View> : null}
      <View style={styles.deadlineRow}><MaterialCommunityIcons name="clock-outline" size={17} color="#7A5A10" /><Text style={styles.deadlineText}>Deadline: {formatDateTime(context.deadline_at)}</Text></View>

      {fields.map((field) => {
        const value = answers[field.id] ?? '';
        return (
          <View key={field.id} style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
            {field.help ? <Text style={styles.fieldHelp}>{field.help}</Text> : null}
            {field.type === 'yes_no' || (field.type === 'choice' && field.options?.length) ? (
              <View style={styles.choiceRow}>
                {(field.type === 'yes_no' ? ['Yes', 'No'] : field.options || []).map((option) => (
                  <Pressable
                    key={option}
                    disabled={readOnly}
                    onPress={() => setAnswers((current) => ({ ...current, [field.id]: option }))}
                    style={[styles.choice, value === option && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, value === option && styles.choiceTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <TextInput
                editable={!readOnly}
                value={value}
                onChangeText={(next) => setAnswers((current) => ({ ...current, [field.id]: next }))}
                multiline={field.type === 'long_text'}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                placeholder={field.type === 'date' ? 'YYYY-MM-DD' : 'Enter response'}
                placeholderTextColor={colors.muted}
                style={[styles.input, field.type === 'long_text' && styles.inputLong, readOnly && styles.inputReadOnly]}
              />
            )}
          </View>
        );
      })}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {savedLabel ? <Text style={styles.savedText}>{savedLabel}</Text> : null}
      <View style={styles.actions}>
        {!readOnly ? (
          <>
            <Pressable disabled={saving} onPress={() => void save(false)} style={[styles.secondaryButton, saving && styles.disabled]}><Text style={styles.secondaryText}>{saving ? 'Saving…' : 'Save draft'}</Text></Pressable>
            <Pressable disabled={saving} onPress={() => void save(true)} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryText}>Submit report</Text></Pressable>
          </>
        ) : (
          <View style={styles.submittedPill}><MaterialCommunityIcons name="check-circle" size={17} color="#166534" /><Text style={styles.submittedText}>Submitted</Text></View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, gap: 12 },
  emptyCard: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emptyTitle: { color: '#173B2F', fontSize: 12, fontWeight: '900', marginBottom: 3 },
  templateBanner: { borderRadius: 14, borderWidth: 1, borderColor: '#CFE3D8', backgroundColor: '#F1F8F4', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  title: { color: '#173B2F', fontSize: 16, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  description: { color: '#4B5D54', fontSize: 11, lineHeight: 16 },
  infoBox: { borderRadius: 11, backgroundColor: '#F6F8F7', padding: 10, gap: 3 },
  deadlineRow: { borderRadius: 10, backgroundColor: '#FFFBEB', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineText: { color: '#7A5A10', fontSize: 10, fontWeight: '800' },
  fieldWrap: { gap: 5 },
  fieldLabel: { color: '#173B2F', fontSize: 11, fontWeight: '900' },
  fieldHelp: { color: '#6C7B73', fontSize: 9, lineHeight: 13 },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 9, color: '#173B2F' },
  inputLong: { minHeight: 96, textAlignVertical: 'top' },
  inputReadOnly: { backgroundColor: '#F3F5F4' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: '#DCE5E0', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { borderColor: colors.greenDark, backgroundColor: '#EAF5EF' },
  choiceText: { color: '#52645B', fontSize: 10, fontWeight: '800' },
  choiceTextSelected: { color: colors.greenDark },
  errorText: { color: '#991B1B', fontSize: 10, lineHeight: 15 },
  savedText: { color: '#166534', fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 43, borderRadius: 10, backgroundColor: colors.greenDark, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#DCE5E0', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  submittedPill: { borderRadius: 999, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  submittedText: { color: '#166534', fontSize: 10, fontWeight: '900' },
});
