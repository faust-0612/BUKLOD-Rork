import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Card, shared } from '@/components/UI';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type SubmissionRow = {
  id: string;
  assignment_id: string;
  user_id: string;
  cluster_id: string | null;
  bible_text: string | null;
  bible_photo_path: string | null;
  question_answers: unknown;
  answer_language: string | null;
  answer_text: string | null;
  reflection_photo_path: string | null;
  status: string;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

type AssignmentRow = {
  id: string;
  reading_date: string;
  bible_reference: string;
  chapter_questions_fil: unknown;
  chapter_questions_en: unknown;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim());
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? '').trim()) : [];
  } catch {
    return [];
  }
}

function statusLabel(status: string) {
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'NEEDS REVISION';
  if (status === 'pending_admin') return 'AUTOMATIC CHECKING / REVIEW';
  return String(status || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
}

export default function DailyReadingSubmissionNotificationScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    submissionId?: string | string[];
    scopeId?: string | string[];
    approvalId?: string | string[];
    notificationKind?: string | string[];
  }>();

  const submissionId = firstParam(params.submissionId)?.trim() ?? '';
  const expectedScopeId = firstParam(params.scopeId)?.trim() ?? '';

  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [memberName, setMemberName] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!submissionId) {
      setLoadError('The notification does not contain a valid Daily Reading submission.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoadError(null);

      const { data: rawSubmission, error: submissionError } = await (supabase as any)
        .from('daily_bible_submissions')
        .select([
          'id',
          'assignment_id',
          'user_id',
          'cluster_id',
          'bible_text',
          'bible_photo_path',
          'question_answers',
          'answer_language',
          'answer_text',
          'reflection_photo_path',
          'status',
          'admin_note',
          'submitted_at',
          'reviewed_at',
        ].join(','))
        .eq('id', submissionId)
        .maybeSingle();

      if (submissionError) throw submissionError;
      if (!rawSubmission) throw new Error('This Daily Reading submission is unavailable or you do not have access to it.');

      const nextSubmission = rawSubmission as SubmissionRow;

      if (expectedScopeId && nextSubmission.cluster_id && nextSubmission.cluster_id !== expectedScopeId) {
        throw new Error('This notification no longer matches the submission scope.');
      }

      const [assignmentResult, profileResult] = await Promise.all([
        (supabase as any)
          .from('daily_bible_assignments')
          .select('id,reading_date,bible_reference,chapter_questions_fil,chapter_questions_en')
          .eq('id', nextSubmission.assignment_id)
          .maybeSingle(),
        (supabase as any)
          .from('profiles')
          .select('full_name')
          .eq('id', nextSubmission.user_id)
          .maybeSingle(),
      ]);

      if (assignmentResult.error) throw assignmentResult.error;

      setSubmission(nextSubmission);
      setAssignment((assignmentResult.data ?? null) as AssignmentRow | null);
      setMemberName(String(profileResult.data?.full_name ?? 'Member').trim() || 'Member');
      setNote(nextSubmission.admin_note ?? '');
    } catch (error) {
      setSubmission(null);
      setAssignment(null);
      setLoadError(String((error as Error)?.message ?? 'Could not load this submission.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expectedScopeId, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const questions = useMemo(() => {
    if (!assignment) return [];
    return textArray(
      submission?.answer_language === 'en'
        ? assignment.chapter_questions_en
        : assignment.chapter_questions_fil
    );
  }, [assignment, submission?.answer_language]);

  const answers = useMemo(() => textArray(submission?.question_answers), [submission?.question_answers]);
  const canReview = Boolean(
    submission &&
      user?.id &&
      submission.user_id !== user.id &&
      submission.status === 'pending_admin'
  );

  const review = useCallback(async (approve: boolean) => {
    if (!submission || busy) return;

    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('admin_review_daily_bible_submission', {
        p_submission_id: submission.id,
        p_approve: approve,
        p_admin_note: note.trim() || null,
      });

      if (error) throw error;

      Alert.alert(
        approve ? 'Daily Reading approved' : 'Returned for revision',
        approve
          ? 'The exact submission has been approved.'
          : 'The exact submission has been returned to the member for revision.'
      );
      await load();
    } catch (error) {
      Alert.alert('Daily Reading Review', String((error as Error)?.message ?? 'Could not review this submission.'));
    } finally {
      setBusy(false);
    }
  }, [busy, load, note, submission]);

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.greenDark} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Daily Reading Submission</Text>
          <Text style={shared.muted}>Opened from the exact Formation notification</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>Loading exact submission…</Text>
        </View>
      ) : loadError ? (
        <Card>
          <Text style={styles.errorTitle}>Submission unavailable</Text>
          <Text style={shared.muted}>{loadError}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </Card>
      ) : submission ? (
        <>
          <Card>
            <Text style={styles.member}>{memberName}</Text>
            <Text style={styles.reference}>{assignment?.bible_reference || 'Daily Reading'}</Text>
            <Text style={shared.muted}>{assignment?.reading_date || ''}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{statusLabel(submission.status)}</Text>
            </View>
            <Text style={styles.meta}>
              Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
            </Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>SCRIPTURE EVIDENCE</Text>
            <Text style={styles.bodyText}>{submission.bible_text?.trim() || (submission.bible_photo_path ? 'Bible photo evidence submitted.' : 'No text evidence.')}</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>QUESTIONS & ANSWERS</Text>
            {Array.from({ length: Math.max(questions.length, answers.length, 4) }, (_, index) => (
              <View key={index} style={styles.qaBlock}>
                <Text style={styles.question}>{index + 1}. {questions[index] || 'Question'}</Text>
                <Text style={styles.answer}>{answers[index] || 'No answer.'}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>PERSONAL REFLECTION</Text>
            <Text style={styles.bodyText}>{submission.answer_text?.trim() || (submission.reflection_photo_path ? 'Reflection photo evidence submitted.' : 'No reflection text.')}</Text>
          </Card>

          {(submission.admin_note || submission.status === 'rejected') && (
            <Card>
              <Text style={styles.sectionTitle}>VALIDATION FEEDBACK</Text>
              <Text style={styles.bodyText}>{submission.admin_note?.trim() || 'Please improve this response and submit again.'}</Text>
            </Card>
          )}

          {canReview && (
            <Card>
              <Text style={styles.sectionTitle}>REVIEW THIS EXACT SUBMISSION</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Optional note / revision guidance"
                style={styles.noteInput}
              />
              <View style={styles.actions}>
                <Pressable disabled={busy} style={[styles.actionButton, styles.returnButton]} onPress={() => void review(false)}>
                  <Text style={styles.returnText}>{busy ? 'WORKING…' : 'RETURN FOR REVISION'}</Text>
                </Pressable>
                <Pressable disabled={busy} style={[styles.actionButton, styles.approveButton]} onPress={() => void review(true)}>
                  <Text style={styles.approveText}>{busy ? 'WORKING…' : 'APPROVE'}</Text>
                </Pressable>
              </View>
            </Card>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  errorTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 6 },
  retry: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.green },
  retryText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  member: { color: colors.text, fontSize: 17, fontWeight: '900' },
  reference: { color: colors.greenDark, fontSize: 15, fontWeight: '900', marginTop: 4 },
  statusPill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.greenSoft },
  statusText: { color: colors.greenDark, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.4 },
  meta: { marginTop: 8, color: colors.muted, fontSize: 10 },
  sectionTitle: { color: colors.greenDark, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6, marginBottom: 8 },
  bodyText: { color: colors.text, fontSize: 12.5, lineHeight: 19 },
  qaBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  question: { color: colors.text, fontSize: 11.5, fontWeight: '800', lineHeight: 17 },
  answer: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 4 },
  noteInput: { minHeight: 78, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 10, color: colors.text, textAlignVertical: 'top', backgroundColor: colors.white },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  returnButton: { borderWidth: 1, borderColor: '#B3261E', backgroundColor: colors.white },
  approveButton: { backgroundColor: colors.greenDark },
  returnText: { color: '#B3261E', fontSize: 9.5, fontWeight: '900', textAlign: 'center' },
  approveText: { color: colors.white, fontSize: 10, fontWeight: '900' },
});