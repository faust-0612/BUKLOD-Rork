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

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type DynamicField = {
  id: string;
  section_id?: string | null;
  label: string;
  type: string;
  required?: boolean;
  help?: string | null;
  options?: string[];
};

type DynamicSection = {
  id: string;
  title: string;
  description?: string | null;
  fields: DynamicField[];
};

type AssignedContext = {
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
  content_requirements: Record<string, any>;
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
  reminder?: Record<string, any>;
};

type Props = {
  scopeId: string;
  assignmentId: string;
  onClose?: () => void;
  onSubmitted?: () => void;
};

const QUICK_WEEK_OPTIONS = [
  'Active / Normal',
  'Good Week',
  'Had Challenges',
  'Limited Activity',
  'No Major Activity',
];

const QUICK_ACTIVITIES = [
  ['worship', 'Worship'],
  ['bible_study', 'Bible Study'],
  ['home_visitation', 'Home Visitation'],
  ['evangelism', 'Evangelism / Soulwinning'],
  ['prayer_meeting', 'Prayer Meeting'],
  ['youth', 'Youth'],
  ['children', 'Children'],
  ['fellowship', 'Fellowship'],
  ['discipleship', 'Discipleship'],
  ['leadership_meeting', 'Leadership Meeting'],
  ['community_ministry', 'Community Ministry'],
] as const;

const QUICK_PEOPLE = [
  ['worship_total', 'Worship total'],
  ['adults', 'Adults'],
  ['youth', 'Youth'],
  ['children', 'Children'],
  ['workers_present', 'Workers present'],
  ['visitors', 'Visitors / First timers'],
  ['bible_study_participants', 'Bible Study participants'],
] as const;

const CONCERN_OPTIONS = [
  'Wala / Normal',
  'Ministry Concern',
  'Worker Concern',
  'Leadership Concern',
  'Need Pastoral Visit',
  'Need Mentoring',
  'Need Manpower',
  'Need Training',
  'Other',
];

const ASSISTANCE_OPTIONS = [
  'None',
  'Leader Follow-Up',
  'Volunteers',
  'Transportation',
  'Materials',
  'Training',
  'Funds / Resources',
  'Equipment',
  'Visitation',
  'Mentoring',
  'Other',
];

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function formatDateTime(value?: string | null) {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

async function invokeReportApi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('buklod-report-api-v1', { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error ?? 'BUKLOD Report request failed.'));
  return data;
}

function normalizeContext(value: unknown): AssignedContext {
  const raw = asObject(value);
  return {
    scope_id: String(raw.scope_id ?? ''),
    scope_name: String(raw.scope_name ?? 'Selected scope'),
    scope_type: String(raw.scope_type ?? ''),
    report_definition_id: String(raw.report_definition_id ?? ''),
    report_code: String(raw.report_code ?? ''),
    report_title: String(raw.report_title ?? 'Assigned report'),
    report_description: raw.report_description ? String(raw.report_description) : null,
    report_instructions: raw.report_instructions ? String(raw.report_instructions) : null,
    form_mode: String(raw.form_mode ?? 'FLEXIBLE'),
    form_schema: String(raw.form_schema ?? 'BUKLOD_DYNAMIC_FORM_V1'),
    content_requirements: asObject(raw.content_requirements),
    report_period_id: String(raw.report_period_id ?? ''),
    report_assignment_id: String(raw.report_assignment_id ?? ''),
    period_title: String(raw.period_title ?? ''),
    period_key: String(raw.period_key ?? ''),
    opens_at: raw.opens_at ? String(raw.opens_at) : null,
    deadline_at: String(raw.deadline_at ?? ''),
    closes_at: raw.closes_at ? String(raw.closes_at) : null,
    assignment_status: String(raw.assignment_status ?? 'OPEN'),
    submission_id: raw.submission_id ? String(raw.submission_id) : null,
    submission_status: raw.submission_status ? String(raw.submission_status) : null,
    content: asObject(raw.content),
    reminder: asObject(raw.reminder),
  };
}

function readDynamicAnswers(content: Record<string, any>) {
  const answers = asObject(content.answers);
  if (Object.keys(answers).length) return answers;
  const legacyValues = asObject(content.values);
  if (Object.keys(legacyValues).length) return legacyValues;
  return {};
}

function dynamicFieldList(requirements: Record<string, any>): DynamicField[] {
  const raw = Array.isArray(requirements.fields) ? requirements.fields : [];
  return raw.flatMap((value: unknown) => {
    const row = asObject(value);
    if (!row.id || !row.label) return [];
    return [{
      id: String(row.id),
      section_id: row.section_id ? String(row.section_id) : null,
      label: String(row.label),
      type: String(row.type ?? 'short_text'),
      required: row.required === true,
      help: row.help ? String(row.help) : null,
      options: Array.isArray(row.options) ? row.options.map((item: unknown) => String(item)) : [],
    }];
  });
}

function dynamicSections(requirements: Record<string, any>, fields: DynamicField[]): DynamicSection[] {
  const raw = Array.isArray(requirements.sections) ? requirements.sections : [];
  const sections = raw.flatMap((value: unknown) => {
    const row = asObject(value);
    if (!row.id || !row.title) return [];
    const id = String(row.id);
    return [{
      id,
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      fields: fields.filter((field) => field.section_id === id),
    }];
  });
  return sections.length ? sections : [{ id: 'report', title: 'Report', fields }];
}

function isEditableStatus(status: string | null | undefined) {
  return !status || ['DRAFT', 'NEEDS_REVISION', 'REJECTED'].includes(status);
}

export default function BuklodAssignedReportForm({
  scopeId,
  assignmentId,
  onClose,
  onSubmitted,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<AssignedContext | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [quick, setQuick] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    if (!scopeId || !assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const data = await invokeReportApi({
        action: 'bootstrap_scope',
        scope_id: scopeId,
        assignment_id: assignmentId,
      });
      const next = normalizeContext(data.context);
      setContext(next);
      if (next.form_schema === 'BUKLOD_QUICK_WEEKLY_V1') {
        setQuick(next.content);
        setAnswers({});
      } else {
        setAnswers(readDynamicAnswers(next.content));
        setQuick({});
      }
    } catch (loadError: any) {
      setError(loadError?.message || 'Could not open this assigned report.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(
    () => dynamicFieldList(context?.content_requirements ?? {}),
    [context?.content_requirements]
  );
  const sections = useMemo(
    () => dynamicSections(context?.content_requirements ?? {}, fields),
    [context?.content_requirements, fields]
  );
  const quickMode = context?.form_schema === 'BUKLOD_QUICK_WEEKLY_V1';
  const readOnly = !isEditableStatus(context?.submission_status);

  const quickContent = useMemo(() => ({
    schema: 'BUKLOD_QUICK_WEEKLY_V1',
    overall_week: String(quick.overall_week ?? 'Active / Normal'),
    activities: asObject(quick.activities),
    people: asObject(quick.people),
    concern: asObject(quick.concern),
    next_period: asObject(quick.next_period),
    additional_note: quick.additional_note ?? null,
  }), [quick]);

  const dynamicContent = useMemo(() => ({
    schema: context?.form_schema || 'BUKLOD_DYNAMIC_FORM_V1',
    answers,
  }), [answers, context?.form_schema]);

  const validate = useCallback(() => {
    if (quickMode) return true;
    const missing = fields.find((field) => {
      if (!field.required) return false;
      const value = answers[field.id];
      return value === null || value === undefined || String(value).trim() === '';
    });
    if (!missing) return true;
    Alert.alert('BUKLOD Report', `${missing.label} is required.`);
    return false;
  }, [answers, fields, quickMode]);

  const save = useCallback(async (submit: boolean) => {
    if (!context?.report_assignment_id || readOnly || saving || submitting) return;
    if (submit && !validate()) return;

    submit ? setSubmitting(true) : setSaving(true);
    setError('');
    try {
      const data = await invokeReportApi({
        action: 'save_report',
        scope_id: scopeId,
        assignment_id: context.report_assignment_id,
        content: quickMode ? quickContent : dynamicContent,
        submit,
        idempotency_key: submit ? `${context.report_assignment_id}:${Date.now()}` : null,
      });
      const result = asObject(data.result);
      setContext((current) => current ? {
        ...current,
        submission_id: result.submission_id ? String(result.submission_id) : current.submission_id,
        submission_status: result.submission_status ? String(result.submission_status) : current.submission_status,
        assignment_status: result.assignment_status ? String(result.assignment_status) : current.assignment_status,
        content: asObject(result.content),
        reminder: submit
          ? { ...(current.reminder ?? {}), status: 'DONE', completed_at: new Date().toISOString() }
          : current.reminder,
      } : current);
      if (submit) {
        onSubmitted?.();
        Alert.alert('BUKLOD Report', 'Report submitted successfully.');
      } else {
        Alert.alert('BUKLOD Report', 'Draft saved.');
      }
    } catch (saveError: any) {
      setError(saveError?.message || 'Report could not be saved.');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [context, dynamicContent, onSubmitted, quickContent, quickMode, readOnly, saving, scopeId, submitting, validate]);

  const reminderAction = useCallback(async (kind: 'ACK' | 'DONE', value?: string) => {
    if (!context?.report_assignment_id || reminderBusy) return;
    setReminderBusy(true);
    try {
      const data = await invokeReportApi({
        action: 'reminder_action',
        scope_id: scopeId,
        assignment_id: context.report_assignment_id,
        kind,
        value: value ?? '',
      });
      setContext((current) => current ? { ...current, reminder: asObject(data.reminder) } : current);
    } catch (reminderError: any) {
      setError(reminderError?.message || 'Reminder action failed.');
    } finally {
      setReminderBusy(false);
    }
  }, [context?.report_assignment_id, reminderBusy, scopeId]);

  if (loading) {
    return (
      <View style={styles.centerCard}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Opening assigned report…</Text>
      </View>
    );
  }

  if (!context) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>{error || 'Assigned report could not be opened.'}</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => void load()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>TRY AGAIN</Text>
          </Pressable>
          {onClose ? (
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>CLOSE</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.eyebrow}>ASSIGNED REPORT</Text>
            <Text style={styles.title}>{context.report_title}</Text>
            <Text style={styles.meta}>{context.period_title || context.period_key}</Text>
          </View>
          <StatusPill status={context.submission_status || context.assignment_status} />
        </View>
        {context.report_description ? <Text style={styles.body}>{context.report_description}</Text> : null}
        {context.report_instructions ? <Text style={styles.instructions}>{context.report_instructions}</Text> : null}
        <Text style={styles.deadline}>Due: {formatDateTime(context.deadline_at)}</Text>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="arrow-left" size={16} color={colors.greenDark} />
            <Text style={styles.closeText}>Back to assigned reports</Text>
          </Pressable>
        ) : null}
      </View>

      {context.reminder?.status === 'ACTIVE' ? (
        <View style={styles.reminderCard}>
          <Text style={styles.eyebrow}>REMINDER</Text>
          <Text style={styles.sectionTitle}>Please complete this report by the deadline.</Text>
          <View style={styles.chips}>
            {['OK po', 'Noted', 'Will do', 'Need Help'].map((label) => (
              <Chip
                key={label}
                label={label}
                selected={context.reminder?.response === label}
                disabled={reminderBusy}
                onPress={() => void reminderAction('ACK', label)}
              />
            ))}
          </View>
          <Pressable disabled={reminderBusy} onPress={() => void reminderAction('DONE')} style={styles.reminderDone}>
            <MaterialCommunityIcons name="check-circle-outline" size={17} color="#166534" />
            <Text style={styles.reminderDoneText}>MARK REMINDER DONE</Text>
          </Pressable>
        </View>
      ) : null}

      {quickMode ? (
        <QuickWeeklyFields value={quick} disabled={readOnly} onChange={setQuick} />
      ) : fields.length ? (
        sections.map((section) => (
          <View key={section.id} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.description ? <Text style={styles.body}>{section.description}</Text> : null}
            {section.fields.map((field) => (
              <DynamicInput
                key={field.id}
                field={field}
                value={answers[field.id]}
                disabled={readOnly}
                onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
              />
            ))}
          </View>
        ))
      ) : (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>This report has no configured fields. Ask the scope administrator to review the template before publishing another deadline.</Text>
        </View>
      )}

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      {!readOnly && (quickMode || fields.length > 0) ? (
        <View style={styles.actions}>
          <Pressable disabled={saving || submitting} onPress={() => void save(false)} style={[styles.secondaryButton, (saving || submitting) && styles.disabled]}>
            {saving ? <ActivityIndicator color={colors.greenDark} /> : <Text style={styles.secondaryText}>SAVE DRAFT</Text>}
          </Pressable>
          <Pressable disabled={saving || submitting} onPress={() => void save(true)} style={[styles.submitButton, (saving || submitting) && styles.disabled]}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send-check-outline" size={19} color="#FFFFFF" />}
            <Text style={styles.submitText}>{submitting ? 'SUBMITTING…' : 'SUBMIT REPORT'}</Text>
          </Pressable>
        </View>
      ) : readOnly ? (
        <View style={styles.submittedCard}>
          <MaterialCommunityIcons name="check-decagram" size={23} color="#166534" />
          <View style={{ flex: 1 }}>
            <Text style={styles.submittedTitle}>Submitted</Text>
            <Text style={styles.body}>This version is read-only unless it is returned for revision.</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DynamicInput({ field, value, disabled, onChange }: {
  field: DynamicField;
  value: any;
  disabled: boolean;
  onChange: (value: any) => void;
}) {
  if (field.type === 'yes_no') {
    return (
      <View style={styles.inputGroup}>
        <FieldLabel field={field} />
        <View style={styles.chips}>
          {['Yes', 'No'].map((option) => (
            <Chip key={option} label={option} selected={String(value ?? '') === option} disabled={disabled} onPress={() => onChange(option)} />
          ))}
        </View>
      </View>
    );
  }

  if (field.type === 'choice' && field.options?.length) {
    return (
      <View style={styles.inputGroup}>
        <FieldLabel field={field} />
        <View style={styles.chips}>
          {field.options.map((option) => (
            <Chip key={option} label={option} selected={String(value ?? '') === option} disabled={disabled} onPress={() => onChange(option)} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inputGroup}>
      <FieldLabel field={field} />
      <TextInput
        editable={!disabled}
        value={value == null ? '' : String(value)}
        onChangeText={(next) => onChange(field.type === 'number' ? next.replace(/[^0-9.-]/g, '') : next)}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        placeholder={field.type === 'date' ? 'YYYY-MM-DD' : field.required ? 'Required' : 'Optional'}
        placeholderTextColor="#9AA7A0"
        multiline={field.type === 'long_text'}
        style={[styles.input, field.type === 'long_text' && styles.textArea, disabled && styles.disabled]}
      />
    </View>
  );
}

function FieldLabel({ field }: { field: DynamicField }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
    </View>
  );
}

function QuickWeeklyFields({ value, disabled, onChange }: {
  value: Record<string, any>;
  disabled: boolean;
  onChange: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const activities = asObject(value.activities);
  const people = asObject(value.people);
  const concern = asObject(value.concern);
  const nextPeriod = asObject(value.next_period);
  const patch = (next: Record<string, any>) => onChange((current) => ({ ...current, ...next }));

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Kumusta ang linggo?</Text>
        <View style={styles.chips}>
          {QUICK_WEEK_OPTIONS.map((option) => (
            <Chip key={option} label={option} selected={String(value.overall_week ?? 'Active / Normal') === option} disabled={disabled} onPress={() => patch({ overall_week: option })} />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Activities</Text>
        {QUICK_ACTIVITIES.map(([key, label]) => {
          const row = asObject(activities[key]);
          return (
            <View key={key} style={styles.quickRow}>
              <Pressable disabled={disabled} onPress={() => patch({ activities: { ...activities, [key]: { ...row, selected: row.selected !== true } } })} style={styles.quickToggle}>
                <MaterialCommunityIcons name={row.selected === true ? 'checkbox-marked' : 'checkbox-blank-outline'} size={21} color={row.selected === true ? colors.greenDark : '#7B8A82'} />
                <Text style={styles.quickLabel}>{label}</Text>
              </Pressable>
              <TextInput
                editable={!disabled}
                value={row.note == null ? '' : String(row.note)}
                onChangeText={(note) => patch({ activities: { ...activities, [key]: { ...row, selected: row.selected === true || note.length > 0, note } } })}
                placeholder="Count / Note"
                placeholderTextColor="#9AA7A0"
                style={[styles.input, disabled && styles.disabled]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>People / Attendance</Text>
        {QUICK_PEOPLE.map(([key, label]) => (
          <View key={key} style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              editable={!disabled}
              value={people[key] == null ? '' : String(people[key])}
              onChangeText={(next) => patch({ people: { ...people, [key]: next.replace(/[^0-9.]/g, '') } })}
              keyboardType="numeric"
              placeholder="Optional"
              placeholderTextColor="#9AA7A0"
              style={[styles.input, disabled && styles.disabled]}
            />
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Concern / Support</Text>
        <View style={styles.chips}>
          {CONCERN_OPTIONS.map((option) => (
            <Chip key={option} label={option} selected={String(concern.type ?? 'Wala / Normal') === option} disabled={disabled} onPress={() => patch({ concern: { ...concern, type: option } })} />
          ))}
        </View>
        <TextInput
          editable={!disabled}
          value={concern.note == null ? '' : String(concern.note)}
          onChangeText={(note) => patch({ concern: { ...concern, note } })}
          placeholder="Brief note (optional)"
          placeholderTextColor="#9AA7A0"
          multiline
          style={[styles.input, styles.textArea, disabled && styles.disabled]}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Next period</Text>
        <TextInput
          editable={!disabled}
          value={nextPeriod.main_goal == null ? '' : String(nextPeriod.main_goal)}
          onChangeText={(main_goal) => patch({ next_period: { ...nextPeriod, main_goal } })}
          placeholder="Main goal"
          placeholderTextColor="#9AA7A0"
          multiline
          style={[styles.input, styles.textArea, disabled && styles.disabled]}
        />
        <View style={styles.chips}>
          {ASSISTANCE_OPTIONS.map((option) => (
            <Chip key={option} label={option} selected={String(nextPeriod.assistance_needed ?? 'None') === option} disabled={disabled} onPress={() => patch({ next_period: { ...nextPeriod, assistance_needed: option } })} />
          ))}
        </View>
        <TextInput
          editable={!disabled}
          value={value.additional_note == null ? '' : String(value.additional_note)}
          onChangeText={(additional_note) => patch({ additional_note })}
          placeholder="Additional note (optional)"
          placeholderTextColor="#9AA7A0"
          multiline
          style={[styles.input, styles.textArea, disabled && styles.disabled]}
        />
      </View>
    </>
  );
}

function Chip({ label, selected, disabled, onPress }: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipOn, disabled && styles.disabled]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ status }: { status: string }) {
  const good = ['SUBMITTED', 'APPROVED', 'AUTO_APPROVED', 'CLOSED'].includes(status);
  return (
    <View style={[styles.statusPill, good && styles.statusPillGood]}>
      <Text style={[styles.statusText, good && styles.statusTextGood]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  centerCard: { minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  headerCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eyebrow: { color: '#61766C', fontSize: 9, fontWeight: '900', letterSpacing: 0.65 },
  title: { color: '#173B2F', fontSize: 17, fontWeight: '900' },
  sectionTitle: { color: '#173B2F', fontSize: 14, fontWeight: '900' },
  meta: { color: '#61766C', fontSize: 10 },
  body: { color: '#66756D', fontSize: 10, lineHeight: 15 },
  instructions: { color: '#334B41', fontSize: 10, lineHeight: 15, backgroundColor: '#F7FAF8', borderRadius: 10, padding: 9 },
  deadline: { color: '#8A5A12', fontSize: 10, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 11 },
  closeButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  closeText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  sectionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  reminderCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F0D7A1', backgroundColor: '#FFFBEB', padding: 14, gap: 10 },
  reminderDone: { minHeight: 40, borderRadius: 10, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#BBE4C9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reminderDoneText: { color: '#166534', fontSize: 9, fontWeight: '900' },
  inputGroup: { gap: 5 },
  fieldLabel: { color: '#4F6259', fontSize: 10, fontWeight: '900' },
  help: { color: '#819087', fontSize: 9, lineHeight: 13 },
  input: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#FAFBFA', color: '#173B2F', paddingHorizontal: 11, paddingVertical: 9, fontSize: 11 },
  textArea: { minHeight: 78, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#F8FAF9', paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { borderColor: '#2D6A4F', backgroundColor: '#E8F5EE' },
  chipText: { color: '#66756D', fontSize: 9, fontWeight: '800' },
  chipTextOn: { color: '#176B4A' },
  quickRow: { borderRadius: 12, borderWidth: 1, borderColor: '#E2E9E5', backgroundColor: '#FAFBFA', padding: 9, gap: 7 },
  quickToggle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickLabel: { color: '#263D34', fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#BFCFC6', backgroundColor: '#FFFFFF', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  secondaryText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  submitButton: { minHeight: 46, borderRadius: 12, backgroundColor: '#173B2F', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexGrow: 1 },
  submitText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  statusPill: { borderRadius: 999, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4 },
  statusPillGood: { backgroundColor: '#DCFCE7' },
  statusText: { color: '#92400E', fontSize: 8, fontWeight: '900' },
  statusTextGood: { color: '#166534' },
  errorCard: { borderRadius: 13, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12, gap: 8 },
  errorText: { color: '#991B1B', fontSize: 10, lineHeight: 15 },
  submittedCard: { borderRadius: 14, borderWidth: 1, borderColor: '#BBE4C9', backgroundColor: '#ECFDF3', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  submittedTitle: { color: '#166534', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
