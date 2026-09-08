import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import {
  ensureQuickWeeklyReport,
  saveQuickWeeklyReport,
  updateQuickWeeklyReminder,
  type QuickWeeklyReportContext,
} from '@/lib/buklodReportDomain';
import {
  exportReportCsv,
  exportReportExcel,
  pickAndAnalyzeReportFile,
  printReportPdf,
  type ReportImportProposal,
} from '@/lib/buklodReportFiles';
import { colors } from '@/lib/theme';

const ACTIVITIES = [
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

type ActivityKey = (typeof ACTIVITIES)[number][0];
type ActivityState = Record<ActivityKey, { selected: boolean; note: string }>;

const WEEK_OPTIONS = [
  'Active / Normal',
  'Good Week',
  'Had Challenges',
  'Limited Activity',
  'No Major Activity',
] as const;

const CONCERN_OPTIONS = [
  'Wala / Normal',
  'Ministry Concern',
  'Worker Concern',
  'Leadership Concern',
  'Financial / Resource Need',
  'Family / Personal Concern Affecting Work',
  'Need Pastoral Visit',
  'Need Mentoring',
  'Need Manpower',
  'Need Training',
  'Need Equipment',
  'Other',
] as const;

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
] as const;

const PEOPLE_FIELDS = [
  ['worship_total', 'Worship total'],
  ['adults', 'Adults'],
  ['youth', 'Youth'],
  ['children', 'Children'],
  ['workers_present', 'Workers present'],
  ['visitors', 'Visitors / First timers'],
  ['bible_study_participants', 'Bible Study participants'],
] as const;

type PeopleKey = (typeof PEOPLE_FIELDS)[number][0];
type PeopleState = Record<PeopleKey, string>;

type Props = { scopeId: string; onSubmitted?: () => void };

function emptyActivities(): ActivityState {
  return Object.fromEntries(
    ACTIVITIES.map(([key]) => [key, { selected: false, note: '' }])
  ) as ActivityState;
}

function emptyPeople(): PeopleState {
  return Object.fromEntries(PEOPLE_FIELDS.map(([key]) => [key, ''])) as PeopleState;
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function trimOrNull(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function formatDeadline(value: string | null | undefined) {
  if (!value) return 'No deadline available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function hydrateActivities(content: Record<string, any>): ActivityState {
  const source = asObject(content.activities);
  const next = emptyActivities();
  for (const [key] of ACTIVITIES) {
    const row = asObject(source[key]);
    next[key] = {
      selected: row.selected === true,
      note: row.note == null ? '' : String(row.note),
    };
  }
  return next;
}

function hydratePeople(content: Record<string, any>): PeopleState {
  const source = asObject(content.people);
  const next = emptyPeople();
  for (const [key] of PEOPLE_FIELDS) {
    const value = source[key];
    next[key] = value == null ? '' : String(value);
  }
  return next;
}

export default function BuklodWeeklyReportForm({ scopeId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedLabel, setSavedLabel] = useState('');
  const [context, setContext] = useState<QuickWeeklyReportContext | null>(null);
  const [importProposal, setImportProposal] = useState<ReportImportProposal | null>(null);
  const [reminderComment, setReminderComment] = useState('');

  const [overallWeek, setOverallWeek] = useState('Active / Normal');
  const [activities, setActivities] = useState<ActivityState>(() => emptyActivities());
  const [people, setPeople] = useState<PeopleState>(() => emptyPeople());
  const [concernType, setConcernType] = useState('Wala / Normal');
  const [concernNote, setConcernNote] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [assistanceNeeded, setAssistanceNeeded] = useState('None');
  const [additionalNote, setAdditionalNote] = useState('');

  const hydratedRef = useRef(false);
  const saveSequenceRef = useRef(0);

  const readOnly = Boolean(
    context?.submission_status &&
    !['DRAFT', 'NEEDS_REVISION', 'REJECTED'].includes(context.submission_status)
  );

  const content = useMemo(() => {
    const activityPayload: Record<string, unknown> = {};
    for (const [key, label] of ACTIVITIES) {
      const row = activities[key];
      if (!row.selected && !row.note.trim()) continue;
      activityPayload[key] = {
        label,
        selected: row.selected,
        note: trimOrNull(row.note),
      };
    }

    const peoplePayload: Record<string, unknown> = {};
    for (const [key] of PEOPLE_FIELDS) {
      const value = people[key].trim();
      if (value) peoplePayload[key] = value;
    }

    return {
      schema: 'BUKLOD_QUICK_WEEKLY_V1',
      overall_week: overallWeek,
      activities: activityPayload,
      people: peoplePayload,
      concern: { type: concernType, note: trimOrNull(concernNote) },
      next_period: {
        main_goal: trimOrNull(mainGoal),
        assistance_needed: assistanceNeeded,
      },
      additional_note: trimOrNull(additionalNote),
    };
  }, [activities, additionalNote, assistanceNeeded, concernNote, concernType, mainGoal, overallWeek, people]);

  const hydrate = useCallback((existing: Record<string, any>) => {
    if (!Object.keys(existing).length) return;
    if (typeof existing.overall_week === 'string' && WEEK_OPTIONS.includes(existing.overall_week as any)) {
      setOverallWeek(existing.overall_week);
    }
    setActivities(hydrateActivities(existing));
    setPeople(hydratePeople(existing));
    const concern = asObject(existing.concern);
    if (typeof concern.type === 'string' && CONCERN_OPTIONS.includes(concern.type as any)) {
      setConcernType(concern.type);
    }
    setConcernNote(typeof concern.note === 'string' ? concern.note : '');
    const nextPeriod = asObject(existing.next_period);
    setMainGoal(typeof nextPeriod.main_goal === 'string' ? nextPeriod.main_goal : '');
    if (typeof nextPeriod.assistance_needed === 'string' && ASSISTANCE_OPTIONS.includes(nextPeriod.assistance_needed as any)) {
      setAssistanceNeeded(nextPeriod.assistance_needed);
    }
    setAdditionalNote(typeof existing.additional_note === 'string' ? existing.additional_note : '');
  }, []);

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    setError('');
    try {
      const next = await ensureQuickWeeklyReport(scopeId);
      setContext(next);
      hydrate(asObject(next.content));
      requestAnimationFrame(() => { hydratedRef.current = true; });
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to open this weekly report.');
    } finally {
      setLoading(false);
    }
  }, [hydrate, scopeId]);

  useEffect(() => {
    hydratedRef.current = false;
    void load();
  }, [load]);

  useEffect(() => {
    if (!hydratedRef.current || !context?.report_assignment_id || readOnly || loading || submitting) return;
    const sequence = ++saveSequenceRef.current;
    const timer = setTimeout(() => {
      setSaving(true);
      void saveQuickWeeklyReport({
        scopeId,
        assignmentId: context.report_assignment_id,
        content,
        submit: false,
      }).then((result) => {
        if (sequence !== saveSequenceRef.current) return;
        setContext((current) => current ? {
          ...current,
          submission_id: result.submission_id,
          submission_status: result.submission_status,
          content: result.content,
        } : current);
        setSavedLabel('Draft saved');
        setTimeout(() => setSavedLabel(''), 1600);
      }).catch((saveError: any) => {
        if (sequence !== saveSequenceRef.current) return;
        console.warn('BUKLOD Report autosave:', saveError);
        setSavedLabel('Draft not saved');
      }).finally(() => {
        if (sequence === saveSequenceRef.current) setSaving(false);
      });
    }, 1100);
    return () => clearTimeout(timer);
  }, [content, context?.report_assignment_id, loading, readOnly, scopeId, submitting]);

  const toggleActivity = useCallback((key: ActivityKey) => {
    setActivities((current) => ({
      ...current,
      [key]: { ...current[key], selected: !current[key].selected },
    }));
  }, []);

  const setActivityNote = useCallback((key: ActivityKey, note: string) => {
    setActivities((current) => ({
      ...current,
      [key]: { selected: current[key].selected || note.length > 0, note },
    }));
  }, []);

  const runImport = useCallback(async () => {
    if (readOnly || importing) return;
    setImporting(true);
    setError('');
    try {
      const proposal = await pickAndAnalyzeReportFile(scopeId);
      if (proposal) setImportProposal(proposal);
    } catch (importError: any) {
      setError(importError?.message || 'The file could not be analyzed.');
    } finally {
      setImporting(false);
    }
  }, [importing, readOnly, scopeId]);

  const applyImport = useCallback(() => {
    if (!importProposal) return;
    const proposed = asObject(importProposal.content);
    if (typeof proposed.overall_week === 'string' && WEEK_OPTIONS.includes(proposed.overall_week as any)) {
      setOverallWeek(proposed.overall_week);
    }

    const activitySource = asObject(proposed.activities);
    setActivities((current) => {
      const next = { ...current };
      for (const [key] of ACTIVITIES) {
        const row = asObject(activitySource[key]);
        if (row.selected === true || (typeof row.note === 'string' && row.note.trim())) {
          next[key] = {
            selected: row.selected === true,
            note: typeof row.note === 'string' ? row.note : '',
          };
        }
      }
      return next;
    });

    const peopleSource = asObject(proposed.people);
    setPeople((current) => {
      const next = { ...current };
      for (const [key] of PEOPLE_FIELDS) {
        const value = peopleSource[key];
        if (value !== null && value !== undefined && String(value).trim()) next[key] = String(value);
      }
      return next;
    });

    const concern = asObject(proposed.concern);
    if (typeof concern.type === 'string' && CONCERN_OPTIONS.includes(concern.type as any)) setConcernType(concern.type);
    if (typeof concern.note === 'string' && concern.note.trim()) setConcernNote(concern.note);

    const nextPeriod = asObject(proposed.next_period);
    if (typeof nextPeriod.main_goal === 'string' && nextPeriod.main_goal.trim()) setMainGoal(nextPeriod.main_goal);
    if (typeof nextPeriod.assistance_needed === 'string' && ASSISTANCE_OPTIONS.includes(nextPeriod.assistance_needed as any)) {
      setAssistanceNeeded(nextPeriod.assistance_needed);
    }
    if (typeof proposed.additional_note === 'string' && proposed.additional_note.trim()) setAdditionalNote(proposed.additional_note);

    setSavedLabel(`Imported from ${importProposal.filename}`);
    setImportProposal(null);
  }, [importProposal]);

  const reminderAction = useCallback(async (kind: 'ACK' | 'COMMENT' | 'DONE', value?: string) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    setError('');
    try {
      const reminder = await updateQuickWeeklyReminder({ scopeId, kind, value });
      setContext((current) => current ? { ...current, reminder } : current);
      if (kind === 'COMMENT') setReminderComment('');
    } catch (reminderError: any) {
      setError(reminderError?.message || 'Reminder action failed.');
    } finally {
      setReminderBusy(false);
    }
  }, [reminderBusy, scopeId]);

  const submit = useCallback(async () => {
    if (!context?.report_assignment_id || submitting || readOnly) return;
    setSubmitting(true);
    setError('');
    saveSequenceRef.current += 1;
    try {
      const result = await saveQuickWeeklyReport({
        scopeId,
        assignmentId: context.report_assignment_id,
        content,
        submit: true,
        idempotencyKey: `${context.report_assignment_id}:${Date.now()}`,
      });
      setContext((current) => current ? {
        ...current,
        submission_id: result.submission_id,
        submission_status: result.submission_status,
        assignment_status: result.assignment_status,
        content: result.content,
        reminder: {
          status: 'DONE',
          response: current.reminder?.response ?? null,
          comments: current.reminder?.comments ?? [],
          completed_at: new Date().toISOString(),
        },
      } : current);
      setSavedLabel('Report submitted');
      onSubmitted?.();
    } catch (submitError: any) {
      setError(submitError?.message || 'Report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }, [content, context, onSubmitted, readOnly, scopeId, submitting]);

  const exportAction = useCallback((kind: 'EXCEL' | 'CSV' | 'PDF') => {
    try {
      const scopeName = context?.scope_name || 'BUKLOD';
      const periodTitle = context?.period_title || 'Weekly Report';
      if (kind === 'EXCEL') exportReportExcel(content, scopeName, periodTitle);
      if (kind === 'CSV') exportReportCsv(content, scopeName, periodTitle);
      if (kind === 'PDF') printReportPdf(content, scopeName, periodTitle);
    } catch (exportError: any) {
      Alert.alert('Report Export', exportError?.message || 'Export could not be created.');
    }
  }, [content, context?.period_title, context?.scope_name]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Preparing this week’s report…</Text>
      </View>
    );
  }

  if (error && !context) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.retryButton}>
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {context?.reminder?.status === 'ACTIVE' ? (
        <View style={styles.reminderCard}>
          <View style={styles.reminderHead}>
            <View style={styles.reminderIcon}>
              <MaterialCommunityIcons name="bell-ring-outline" size={21} color="#8A5A12" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PERSONAL REMINDER</Text>
              <Text style={styles.sectionTitle}>Weekly report due {formatDeadline(context.deadline_at)}</Text>
              <Text style={styles.hint}>
                Quick reply, comment if needed, or mark done. Final report submission closes this automatically.
              </Text>
            </View>
          </View>
          <View style={styles.chipWrap}>
            {['OK po', 'Noted', 'Will do', 'Need Help'].map((label) => (
              <ChoiceChip
                key={label}
                label={label}
                selected={context.reminder.response === label}
                disabled={reminderBusy}
                onPress={() => void reminderAction('ACK', label)}
              />
            ))}
          </View>
          <View style={styles.commentRow}>
            <TextInput
              value={reminderComment}
              onChangeText={setReminderComment}
              placeholder="Optional reply/comment"
              placeholderTextColor="#9AA7A0"
              style={styles.commentInput}
              editable={!reminderBusy}
            />
            <Pressable
              disabled={reminderBusy || !reminderComment.trim()}
              onPress={() => void reminderAction('COMMENT', reminderComment.trim())}
              style={({ pressed }) => [
                styles.smallAction,
                (!reminderComment.trim() || reminderBusy) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.smallActionText}>SEND</Text>
            </Pressable>
          </View>
          {context.reminder.comments.length ? (
            <Text style={styles.reminderHistory}>
              {context.reminder.comments.length} comment(s) saved in reminder history.
            </Text>
          ) : null}
          <Pressable
            disabled={reminderBusy}
            onPress={() => void reminderAction('DONE')}
            style={({ pressed }) => [styles.doneReminder, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={17} color="#166534" />
            <Text style={styles.doneReminderText}>MARK REMINDER DONE</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CURRENT REPORT</Text>
            <Text style={styles.sectionTitle}>{context?.period_title || 'Quick Weekly Report'}</Text>
          </View>
          <StatusPill status={context?.submission_status || context?.assignment_status || 'OPEN'} />
        </View>
        <Text style={styles.meta}>Due: {formatDeadline(context?.deadline_at)}</Text>
        <Text style={styles.hint}>One tap + one short input is enough. Optional blanks stay blank—not zero.</Text>
        {(saving || savedLabel) && !readOnly ? (
          <Text style={styles.savedText}>{saving ? 'Saving draft…' : savedLabel}</Text>
        ) : null}
      </View>

      {!readOnly ? (
        <View style={styles.sectionCard}>
          <Text style={styles.eyebrow}>SMART IMPORT</Text>
          <Text style={styles.sectionTitle}>File / Photo / Excel / PDF</Text>
          <Text style={styles.hint}>
            BUKLOD detects supported report fields automatically. Nothing is applied silently—you review detected values first.
          </Text>
          <Pressable
            disabled={importing}
            onPress={() => void runImport()}
            style={({ pressed }) => [styles.importButton, importing && styles.disabled, pressed && !importing && styles.pressed]}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="file-find-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.importButtonText}>{importing ? 'ANALYZING…' : 'IMPORT & AUTO-DETECT'}</Text>
          </Pressable>
        </View>
      ) : null}

      {importProposal ? (
        <View style={styles.previewCard}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>IMPORT PREVIEW</Text>
              <Text style={styles.sectionTitle}>{importProposal.filename}</Text>
              <Text style={styles.meta}>
                Confidence: {Math.round(importProposal.confidence * 100)}% · {importProposal.detectedFields.length} detected field(s)
              </Text>
            </View>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.greenDark} />
          </View>
          {importProposal.detectedFields.length ? (
            <Text style={styles.previewText}>Detected: {importProposal.detectedFields.slice(0, 12).join(', ')}</Text>
          ) : null}
          {importProposal.reviewNotes.length ? (
            <Text style={styles.previewWarning}>{importProposal.reviewNotes.slice(0, 4).join(' • ')}</Text>
          ) : null}
          <Text style={styles.hint}>Review the form after applying. AI extraction is a proposal, not a final truth.</Text>
          <View style={styles.twoButtonRow}>
            <Pressable onPress={() => setImportProposal(null)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
              <Text style={styles.secondaryActionText}>CANCEL</Text>
            </Pressable>
            <Pressable onPress={applyImport} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
              <Text style={styles.primaryActionText}>APPLY TO REPORT</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Section title="Kumusta ang linggo?" eyebrow="1 · OVERALL WEEK">
        <View style={styles.chipWrap}>
          {WEEK_OPTIONS.map((option) => (
            <ChoiceChip key={option} label={option} selected={overallWeek === option} disabled={readOnly} onPress={() => setOverallWeek(option)} />
          ))}
        </View>
      </Section>

      <Section
        title="Activities"
        eyebrow="2 · WHAT HAPPENED THIS WEEK?"
        hint="Check the activity, then type a count or short note. Letters and numbers are both allowed."
      >
        <View style={styles.activityList}>
          {ACTIVITIES.map(([key, label]) => {
            const row = activities[key];
            return (
              <View key={key} style={styles.activityRow}>
                <Pressable
                  disabled={readOnly}
                  onPress={() => toggleActivity(key)}
                  style={({ pressed }) => [styles.activityToggle, pressed && !readOnly && styles.pressed]}
                >
                  <MaterialCommunityIcons
                    name={row.selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={row.selected ? colors.greenDark : '#7B8A82'}
                  />
                  <Text style={styles.activityLabel}>{label}</Text>
                </Pressable>
                {(row.selected || row.note.length > 0) ? (
                  <TextInput
                    editable={!readOnly}
                    value={row.note}
                    onChangeText={(value) => setActivityNote(key, value)}
                    placeholder="Count / Note"
                    placeholderTextColor="#9AA7A0"
                    style={[styles.activityInput, readOnly && styles.inputReadOnly]}
                    returnKeyType="done"
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </Section>

      <Section
        title="Optional numbers"
        eyebrow="3 · PEOPLE / ATTENDANCE"
        hint="Leave untouched fields blank. They are not treated as zero."
      >
        <View style={styles.fieldGrid}>
          {PEOPLE_FIELDS.map(([key, label]) => (
            <LabeledInput
              key={key}
              label={label}
              value={people[key]}
              editable={!readOnly}
              keyboardType="numeric"
              onChangeText={(value: string) => setPeople((current) => ({ ...current, [key]: value.replace(/[^0-9.]/g, '') }))}
            />
          ))}
        </View>
      </Section>

      <Section title="May kailangan bang malaman ang leadership?" eyebrow="4 · CONCERN / SUPPORT">
        <View style={styles.chipWrap}>
          {CONCERN_OPTIONS.map((option) => (
            <ChoiceChip key={option} label={option} selected={concernType === option} disabled={readOnly} onPress={() => setConcernType(option)} />
          ))}
        </View>
        <LabeledInput label="Brief note (optional)" value={concernNote} editable={!readOnly} multiline onChangeText={setConcernNote} />
      </Section>

      <Section title="Next period" eyebrow="5 · GOAL / ASSISTANCE">
        <LabeledInput label="Main goal" value={mainGoal} editable={!readOnly} multiline onChangeText={setMainGoal} />
        <Text style={styles.fieldLabel}>Assistance needed</Text>
        <View style={styles.chipWrap}>
          {ASSISTANCE_OPTIONS.map((option) => (
            <ChoiceChip key={option} label={option} selected={assistanceNeeded === option} disabled={readOnly} onPress={() => setAssistanceNeeded(option)} />
          ))}
        </View>
        <LabeledInput label="Additional note (optional)" value={additionalNote} editable={!readOnly} multiline onChangeText={setAdditionalNote} />
      </Section>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>REPORT EXPORT</Text>
        <Text style={styles.sectionTitle}>Download / Print</Text>
        <Text style={styles.hint}>Export the current report as Excel, CSV, or printable PDF.</Text>
        <View style={styles.exportGrid}>
          <ExportButton icon="microsoft-excel" label="EXCEL" onPress={() => exportAction('EXCEL')} />
          <ExportButton icon="file-delimited-outline" label="CSV" onPress={() => exportAction('CSV')} />
          <ExportButton icon="file-pdf-box" label="PDF / PRINT" onPress={() => exportAction('PDF')} />
        </View>
      </View>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      {!readOnly ? (
        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.submitButton, submitting && styles.disabled, pressed && !submitting && styles.pressed]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send-check-outline" size={21} color="#FFFFFF" />}
          <Text style={styles.submitText}>{submitting ? 'SUBMITTING…' : 'SUBMIT WEEKLY REPORT'}</Text>
        </Pressable>
      ) : (
        <View style={styles.submittedCard}>
          <MaterialCommunityIcons name="check-decagram" size={25} color="#166534" />
          <View style={{ flex: 1 }}>
            <Text style={styles.submittedTitle}>Report submitted</Text>
            <Text style={styles.submittedText}>This submitted version is read-only. Export remains available.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Section({ title, eyebrow, hint, children }: { title: string; eyebrow: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function ChoiceChip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, disabled && styles.inputReadOnly, pressed && !disabled && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function LabeledInput({ label, value, editable, multiline, keyboardType, onChangeText }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder="Optional"
        placeholderTextColor="#9AA7A0"
        style={[styles.textInput, multiline && styles.textArea, !editable && styles.inputReadOnly]}
      />
    </View>
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

function ExportButton({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.exportButton, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.greenDark} />
      <Text style={styles.exportText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  loadingCard: { minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  sectionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  previewCard: { borderRadius: 16, borderWidth: 1.5, borderColor: '#74B68D', backgroundColor: '#F3FBF6', padding: 14, gap: 10 },
  reminderCard: { borderRadius: 16, borderWidth: 1, borderColor: '#F0D7A1', backgroundColor: '#FFFBEB', padding: 14, gap: 10 },
  reminderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reminderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eyebrow: { color: '#61766C', fontSize: 9, fontWeight: '900', letterSpacing: 0.65 },
  sectionTitle: { color: '#173B2F', fontSize: 15, fontWeight: '900' },
  meta: { color: '#5F6F67', fontSize: 10, lineHeight: 14 },
  hint: { color: '#77857E', fontSize: 10, lineHeight: 15 },
  muted: { color: colors.muted, fontSize: 11 },
  savedText: { color: '#2D6A4F', fontSize: 9, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#F8FAF9', paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { borderColor: '#2D6A4F', backgroundColor: '#E8F5EE' },
  chipText: { color: '#66756D', fontSize: 9, fontWeight: '800' },
  chipTextOn: { color: '#176B4A' },
  activityList: { gap: 8 },
  activityRow: { borderRadius: 12, borderWidth: 1, borderColor: '#E2E9E5', backgroundColor: '#FAFBFA', padding: 9, gap: 7 },
  activityToggle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activityLabel: { flex: 1, color: '#263D34', fontSize: 11, fontWeight: '800' },
  activityInput: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#FFFFFF', color: '#173B2F', paddingHorizontal: 11, fontSize: 11 },
  inputReadOnly: { opacity: 0.58 },
  fieldGrid: { gap: 9 },
  inputGroup: { gap: 5 },
  fieldLabel: { color: '#4F6259', fontSize: 10, fontWeight: '800' },
  textInput: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#D5E0DA', backgroundColor: '#FAFBFA', color: '#173B2F', paddingHorizontal: 11, paddingVertical: 9, fontSize: 11 },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  importButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#2D6A4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  importButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  previewText: { color: '#2D6A4F', fontSize: 10, lineHeight: 15 },
  previewWarning: { color: '#8A5A12', fontSize: 10, lineHeight: 15 },
  twoButtonRow: { flexDirection: 'row', gap: 8 },
  primaryAction: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: '#2D6A4F', alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  secondaryAction: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#BFCFC6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: '#4E6258', fontSize: 9, fontWeight: '900' },
  commentRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  commentInput: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E7CF9D', backgroundColor: '#FFFFFF', color: '#173B2F', paddingHorizontal: 10, fontSize: 10 },
  smallAction: { minHeight: 40, borderRadius: 10, backgroundColor: '#8A5A12', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  reminderHistory: { color: '#8A6A2C', fontSize: 9 },
  doneReminder: { minHeight: 40, borderRadius: 10, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#BBE4C9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  doneReminderText: { color: '#166534', fontSize: 9, fontWeight: '900' },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportButton: { minWidth: 92, flexGrow: 1, minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#F8FAF9', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  exportText: { color: '#173B2F', fontSize: 9, fontWeight: '900' },
  statusPill: { borderRadius: 999, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4 },
  statusPillGood: { backgroundColor: '#DCFCE7' },
  statusText: { color: '#92400E', fontSize: 8, fontWeight: '900' },
  statusTextGood: { color: '#166534' },
  submitButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#173B2F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  submitText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  submittedCard: { borderRadius: 14, borderWidth: 1, borderColor: '#BBE4C9', backgroundColor: '#ECFDF3', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  submittedTitle: { color: '#166534', fontSize: 12, fontWeight: '900' },
  submittedText: { color: '#3E6E50', fontSize: 9, lineHeight: 13 },
  errorCard: { borderRadius: 13, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', padding: 12, gap: 8 },
  errorText: { color: '#991B1B', fontSize: 10, lineHeight: 15 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#991B1B', paddingHorizontal: 10, paddingVertical: 7 },
  retryText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
