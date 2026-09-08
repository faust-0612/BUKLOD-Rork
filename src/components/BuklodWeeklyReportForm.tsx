import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  type QuickWeeklyReportContext,
} from '@/lib/buklodReportDomain';
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

type ActivityState = Record<
  ActivityKey,
  {
    selected: boolean;
    note: string;
  }
>;

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

type Props = {
  scopeId: string;
  onSubmitted?: () => void;
};

function emptyActivities(): ActivityState {
  return Object.fromEntries(
    ACTIVITIES.map(([key]) => [key, { selected: false, note: '' }])
  ) as ActivityState;
}

function emptyPeople(): PeopleState {
  return Object.fromEntries(PEOPLE_FIELDS.map(([key]) => [key, ''])) as PeopleState;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hydrateActivities(content: Record<string, unknown>): ActivityState {
  const source = asObject(content.activities);
  const next = emptyActivities();

  for (const [key] of ACTIVITIES) {
    const row = asObject(source[key]);
    next[key] = {
      selected: row.selected === true,
      note: typeof row.note === 'string' ? row.note : '',
    };
  }

  return next;
}

function hydratePeople(content: Record<string, unknown>): PeopleState {
  const source = asObject(content.people);
  const next = emptyPeople();

  for (const [key] of PEOPLE_FIELDS) {
    const value = source[key];
    next[key] = value === null || value === undefined ? '' : String(value);
  }

  return next;
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BuklodWeeklyReportForm({ scopeId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedLabel, setSavedLabel] = useState('');
  const [context, setContext] = useState<QuickWeeklyReportContext | null>(null);

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
      if (!value) continue;
      peoplePayload[key] = value;
    }

    return {
      schema: 'BUKLOD_QUICK_WEEKLY_V1',
      overall_week: overallWeek,
      activities: activityPayload,
      people: peoplePayload,
      concern: {
        type: concernType,
        note: trimOrNull(concernNote),
      },
      next_period: {
        main_goal: trimOrNull(mainGoal),
        assistance_needed: assistanceNeeded,
      },
      additional_note: trimOrNull(additionalNote),
    };
  }, [
    activities,
    additionalNote,
    assistanceNeeded,
    concernNote,
    concernType,
    mainGoal,
    overallWeek,
    people,
  ]);

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    setError('');

    try {
      const next = await ensureQuickWeeklyReport(scopeId);
      setContext(next);

      const existing = asObject(next.content);
      if (Object.keys(existing).length > 0) {
        setOverallWeek(
          typeof existing.overall_week === 'string'
            ? existing.overall_week
            : 'Active / Normal'
        );
        setActivities(hydrateActivities(existing));
        setPeople(hydratePeople(existing));

        const concern = asObject(existing.concern);
        setConcernType(
          typeof concern.type === 'string' ? concern.type : 'Wala / Normal'
        );
        setConcernNote(typeof concern.note === 'string' ? concern.note : '');

        const nextPeriod = asObject(existing.next_period);
        setMainGoal(
          typeof nextPeriod.main_goal === 'string' ? nextPeriod.main_goal : ''
        );
        setAssistanceNeeded(
          typeof nextPeriod.assistance_needed === 'string'
            ? nextPeriod.assistance_needed
            : 'None'
        );
        setAdditionalNote(
          typeof existing.additional_note === 'string' ? existing.additional_note : ''
        );
      }

      requestAnimationFrame(() => {
        hydratedRef.current = true;
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Unable to open this weekly report.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    hydratedRef.current = false;
    void load();
  }, [load]);

  useEffect(() => {
    if (
      !hydratedRef.current ||
      !context?.report_assignment_id ||
      readOnly ||
      loading ||
      submitting
    ) {
      return;
    }

    const sequence = ++saveSequenceRef.current;
    const timer = setTimeout(() => {
      setSaving(true);
      void saveQuickWeeklyReport({
        assignmentId: context.report_assignment_id,
        content,
        submit: false,
      })
        .then((result) => {
          if (sequence !== saveSequenceRef.current) return;
          setContext((current) =>
            current
              ? {
                  ...current,
                  submission_id: result.submission_id,
                  submission_status: result.submission_status,
                  content: result.content,
                }
              : current
          );
          setSavedLabel('Draft saved');
          setTimeout(() => setSavedLabel(''), 1600);
        })
        .catch((saveError: any) => {
          if (sequence !== saveSequenceRef.current) return;
          console.warn('BUKLOD Report autosave:', saveError);
          setSavedLabel('Draft not saved');
        })
        .finally(() => {
          if (sequence === saveSequenceRef.current) setSaving(false);
        });
    }, 1100);

    return () => clearTimeout(timer);
  }, [content, context?.report_assignment_id, loading, readOnly, submitting]);

  const toggleActivity = useCallback((key: ActivityKey) => {
    setActivities((current) => ({
      ...current,
      [key]: {
        ...current[key],
        selected: !current[key].selected,
      },
    }));
  }, []);

  const setActivityNote = useCallback((key: ActivityKey, note: string) => {
    setActivities((current) => ({
      ...current,
      [key]: {
        selected: current[key].selected || note.length > 0,
        note,
      },
    }));
  }, []);

  const submit = useCallback(async () => {
    if (!context?.report_assignment_id || submitting || readOnly) return;

    setSubmitting(true);
    setError('');
    saveSequenceRef.current += 1;

    try {
      const result = await saveQuickWeeklyReport({
        assignmentId: context.report_assignment_id,
        content,
        submit: true,
        idempotencyKey: `${context.report_assignment_id}:${Date.now()}`,
      });

      setContext((current) =>
        current
          ? {
              ...current,
              submission_id: result.submission_id,
              submission_status: result.submission_status,
              assignment_status: result.assignment_status,
              content: result.content,
            }
          : current
      );
      setSavedLabel('Report submitted');
      onSubmitted?.();
    } catch (submitError: any) {
      setError(submitError?.message || 'Report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }, [content, context, onSubmitted, readOnly, submitting]);

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
      <View style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CURRENT REPORT</Text>
            <Text style={styles.sectionTitle}>
              {context?.period_title || 'Quick Weekly Report'}
            </Text>
          </View>
          <StatusPill status={context?.submission_status || context?.assignment_status || 'OPEN'} />
        </View>
        <Text style={styles.meta}>
          Due: {formatDeadline(context?.deadline_at)}
        </Text>
        <Text style={styles.hint}>
          One tap + one short input is enough. Optional blanks stay blank—not zero.
        </Text>
        {(saving || savedLabel) && !readOnly ? (
          <Text style={styles.savedText}>{saving ? 'Saving draft…' : savedLabel}</Text>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>1 · OVERALL WEEK</Text>
        <Text style={styles.sectionTitle}>Kumusta ang linggo?</Text>
        <View style={styles.chipWrap}>
          {WEEK_OPTIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={option}
              selected={overallWeek === option}
              disabled={readOnly}
              onPress={() => setOverallWeek(option)}
            />
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>2 · WHAT HAPPENED THIS WEEK?</Text>
        <Text style={styles.sectionTitle}>Activities</Text>
        <Text style={styles.hint}>
          Check the activity, then type a count or short note. Letters and numbers are both allowed.
        </Text>

        <View style={styles.activityList}>
          {ACTIVITIES.map(([key, label]) => {
            const row = activities[key];
            return (
              <View key={key} style={styles.activityRow}>
                <Pressable
                  disabled={readOnly}
                  onPress={() => toggleActivity(key)}
                  style={({ pressed }) => [
                    styles.activityToggle,
                    row.selected && styles.activityToggleSelected,
                    pressed && !readOnly && styles.pressed,
                  ]}
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
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>3 · PEOPLE / ATTENDANCE</Text>
        <Text style={styles.sectionTitle}>Optional numbers</Text>
        <Text style={styles.hint}>Leave untouched fields blank. They are not treated as zero.</Text>
        <View style={styles.peopleGrid}>
          {PEOPLE_FIELDS.map(([key, label]) => (
            <View key={key} style={styles.peopleField}>
              <Text style={styles.inputLabel}>{label}</Text>
              <TextInput
                editable={!readOnly}
                value={people[key]}
                onChangeText={(value) =>
                  setPeople((current) => ({ ...current, [key]: value }))
                }
                placeholder="Optional"
                placeholderTextColor="#9AA7A0"
                keyboardType="number-pad"
                style={[styles.textInput, readOnly && styles.inputReadOnly]}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>4 · KUMUSTA ANG LOCAL / UNIT?</Text>
        <Text style={styles.sectionTitle}>May kailangang malaman ang leadership?</Text>
        <View style={styles.chipWrap}>
          {CONCERN_OPTIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={option}
              selected={concernType === option}
              disabled={readOnly}
              onPress={() => setConcernType(option)}
            />
          ))}
        </View>
        <Text style={styles.inputLabel}>Brief note (optional)</Text>
        <TextInput
          editable={!readOnly}
          multiline
          value={concernNote}
          onChangeText={setConcernNote}
          placeholder="Short context only if needed"
          placeholderTextColor="#9AA7A0"
          style={[styles.textArea, readOnly && styles.inputReadOnly]}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.eyebrow}>5 · NEXT PERIOD</Text>
        <Text style={styles.sectionTitle}>Main goal</Text>
        <TextInput
          editable={!readOnly}
          value={mainGoal}
          onChangeText={setMainGoal}
          placeholder="What is the main goal next week?"
          placeholderTextColor="#9AA7A0"
          style={[styles.textInput, readOnly && styles.inputReadOnly]}
        />
        <Text style={styles.inputLabel}>Assistance needed</Text>
        <View style={styles.chipWrap}>
          {ASSISTANCE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={option}
              selected={assistanceNeeded === option}
              disabled={readOnly}
              onPress={() => setAssistanceNeeded(option)}
            />
          ))}
        </View>
        <Text style={styles.inputLabel}>Additional note (optional)</Text>
        <TextInput
          editable={!readOnly}
          multiline
          value={additionalNote}
          onChangeText={setAdditionalNote}
          placeholder="Anything else leadership should know?"
          placeholderTextColor="#9AA7A0"
          style={[styles.textArea, readOnly && styles.inputReadOnly]}
        />
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {readOnly ? (
        <View style={styles.successCard}>
          <MaterialCommunityIcons name="check-circle" size={22} color="#176B4A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Report submitted</Text>
            <Text style={styles.successText}>
              This report is now preserved for review. If leadership requests revision,
              editing will reopen automatically.
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.disabled,
            pressed && !submitting && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name="send-check" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.submitText}>
            {submitting ? 'SUBMITTING…' : 'SUBMIT WEEKLY REPORT'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ status }: { status: string }) {
  const positive = ['SUBMITTED', 'APPROVED', 'AUTO_APPROVED', 'CLOSED'].includes(status);
  return (
    <View style={[styles.statusPill, positive && styles.statusPillPositive]}>
      <Text style={[styles.statusText, positive && styles.statusTextPositive]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  loadingCard: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    color: '#173B2F',
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    color: '#355D4C',
    fontSize: 11,
    fontWeight: '800',
  },
  hint: {
    color: '#6B7B73',
    fontSize: 11,
    lineHeight: 16,
  },
  muted: {
    color: '#6B7B73',
    fontSize: 12,
  },
  savedText: {
    color: '#176B4A',
    fontSize: 10,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6E1DB',
    backgroundColor: '#F8FAF9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: '#2D6A4F',
    backgroundColor: '#E7F4EC',
  },
  chipText: {
    color: '#52635A',
    fontSize: 10,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#176B4A',
    fontWeight: '900',
  },
  activityList: { gap: 8 },
  activityRow: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E9E5',
    backgroundColor: '#FBFCFB',
    padding: 9,
    gap: 8,
  },
  activityToggle: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityToggleSelected: {},
  activityLabel: {
    flex: 1,
    color: '#243B31',
    fontSize: 12,
    fontWeight: '800',
  },
  activityInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E1DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    color: '#173B2F',
    fontSize: 12,
  },
  inputLabel: {
    color: '#52635A',
    fontSize: 10,
    fontWeight: '800',
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  peopleField: {
    width: '48%',
    minWidth: 132,
    flexGrow: 1,
    gap: 5,
  },
  textInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E1DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    color: '#173B2F',
    fontSize: 12,
  },
  textArea: {
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E1DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 10,
    color: '#173B2F',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  inputReadOnly: {
    backgroundColor: '#F3F6F4',
    color: '#63736B',
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillPositive: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    color: '#92400E',
    fontSize: 8,
    fontWeight: '900',
  },
  statusTextPositive: {
    color: '#166534',
  },
  errorCard: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 11,
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    backgroundColor: '#991B1B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  successCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBE2CC',
    backgroundColor: '#ECFDF3',
    padding: 13,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  successTitle: {
    color: '#176B4A',
    fontSize: 12,
    fontWeight: '900',
  },
  successText: {
    marginTop: 2,
    color: '#4F6D5E',
    fontSize: 10,
    lineHeight: 14,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.74 },
});
