import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { supabase } from '@/lib/supabase';

type StudentRow = {
  student_user_id: string;
  display_name?: string | null;
  username?: string | null;
  status?: string;
};

type ExceptionCase = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  open: () => void;
};

export default function FacultyExceptionsScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();

  const [cases, setCases] = useState<ExceptionCase[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const nameMap = (roster: StudentRow[]) => {
    const map = new Map<string, string>();
    for (const row of roster) {
      map.set(row.student_user_id, row.display_name || row.username || row.student_user_id.slice(0, 8));
    }
    return map;
  };

  const load = useCallback(async () => {
    if (!classroomId) return;

    const rosterRes = await supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId });
    if (rosterRes.error) {
      Alert.alert('Exception Queue', rosterRes.error.message);
      return;
    }
    const roster = (rosterRes.data ?? []) as StudentRow[];
    const names = nameMap(roster);
    const next: ExceptionCase[] = [];

    const [gradesRes, itemsRes, attemptsRes, assessmentsRes, groupRes, obsRes, sessionsRes] =
      await Promise.all([
        supabase
          .from('buklod_education_grades')
          .select('id,student_user_id,status,score,grade_item_id')
          .eq('classroom_id', classroomId)
          .in('status', ['DRAFT', 'COMPUTED', 'REVIEWED']),
        supabase
          .from('buklod_education_grade_items')
          .select('id,title')
          .eq('classroom_id', classroomId),
        supabase
          .from('buklod_education_assessment_attempts')
          .select('id,assessment_id,student_user_id,status,total_score,max_score')
          .eq('classroom_id', classroomId),
        supabase
          .from('buklod_education_assessments')
          .select('id,title')
          .eq('classroom_id', classroomId),
        supabase
          .from('buklod_education_group_activity_scores')
          .select('id,student_user_id,status,final_score,group_name')
          .eq('classroom_id', classroomId)
          .in('status', ['DRAFT', 'REVIEWED']),
        supabase
          .from('buklod_education_observations')
          .select('id,student_user_id,observation_type,score,released_to_student')
          .eq('classroom_id', classroomId)
          .eq('released_to_student', false),
        supabase
          .from('buklod_education_attendance_sessions')
          .select('id,opened_at,closed_at')
          .eq('classroom_id', classroomId)
          .not('closed_at', 'is', null)
          .order('opened_at', { ascending: false })
          .limit(3),
      ]);

    const items = new Map(
      ((itemsRes.data ?? []) as Array<{ id: string; title: string }>).map(item => [item.id, item.title])
    );
    const assessments = new Map(
      ((assessmentsRes.data ?? []) as Array<{ id: string; title: string }>).map(item => [item.id, item.title])
    );

    for (const grade of (gradesRes.data ?? []) as Array<{
      id: string;
      student_user_id: string;
      status: string;
      score: number | null;
      grade_item_id: string;
    }>) {
      next.push({
        id: `grade:${grade.id}`,
        kind: 'Uncertain grade',
        title: `${names.get(grade.student_user_id) ?? 'Student'} • ${items.get(grade.grade_item_id) ?? 'Grade item'}`,
        detail: `${grade.status}${grade.score == null ? '' : ` • ${grade.score}`}`,
        open: () =>
          router.push({
            pathname: '/profile/buklod-faculty-class' as any,
            params: { id: classroomId, name: classroomName },
          }),
      });
    }

    for (const attempt of (attemptsRes.data ?? []) as Array<{
      id: string;
      assessment_id: string;
      student_user_id: string;
      status: string;
      total_score: number | null;
      max_score: number | null;
    }>) {
      if (!['SUBMITTED', 'NEEDS_REVIEW', 'GRADED'].includes(attempt.status)) continue;
      next.push({
        id: `attempt:${attempt.id}`,
        kind: attempt.status === 'NEEDS_REVIEW' ? 'Assessment review' : 'Unreleased assessment',
        title: `${names.get(attempt.student_user_id) ?? 'Student'} • ${assessments.get(attempt.assessment_id) ?? 'Assessment'}`,
        detail: `${attempt.status}${attempt.total_score == null ? '' : ` • ${attempt.total_score}/${attempt.max_score ?? ''}`}`,
        open: () =>
          router.push({
            pathname: '/profile/buklod-faculty-assessment-review' as any,
            params: {
              assessmentId: attempt.assessment_id,
              classroomId,
              name: assessments.get(attempt.assessment_id) ?? classroomName,
            },
          }),
      });
    }

    const allAttemptIds = ((attemptsRes.data ?? []) as Array<{ id: string }>).map(item => item.id);
    if (allAttemptIds.length > 0) {
      const { data: eventData } = await supabase
        .from('buklod_education_exam_events')
        .select('id,attempt_id,student_user_id,event_type,created_at')
        .in('attempt_id', allAttemptIds)
        .not('event_type', 'in', '(ATTEMPT_STARTED,ATTEMPT_SUBMITTED)')
        .order('created_at', { ascending: false })
        .limit(25);

      const attemptMeta = new Map(
        ((attemptsRes.data ?? []) as Array<{ id: string; assessment_id: string; student_user_id: string }>).map(
          item => [item.id, item]
        )
      );

      for (const event of (eventData ?? []) as Array<{
        id: string;
        attempt_id: string;
        student_user_id: string;
        event_type: string;
      }>) {
        const meta = attemptMeta.get(event.attempt_id);
        next.push({
          id: `event:${event.id}`,
          kind: 'Exam anomaly',
          title: `${names.get(event.student_user_id) ?? 'Student'} • ${event.event_type}`,
          detail: assessments.get(meta?.assessment_id ?? '') ?? 'Assessment event',
          open: () =>
            router.push({
              pathname: '/profile/buklod-faculty-assessment-review' as any,
              params: {
                assessmentId: meta?.assessment_id ?? '',
                classroomId,
                name: assessments.get(meta?.assessment_id ?? '') ?? classroomName,
              },
            }),
        });
      }
    }

    for (const score of (groupRes.data ?? []) as Array<{
      id: string;
      student_user_id: string;
      status: string;
      final_score: number | null;
      group_name: string | null;
    }>) {
      next.push({
        id: `group:${score.id}`,
        kind: 'Unreleased group score',
        title: `${names.get(score.student_user_id) ?? 'Student'}${score.group_name ? ` • ${score.group_name}` : ''}`,
        detail: `${score.status}${score.final_score == null ? '' : ` • ${score.final_score}`}`,
        open: () =>
          router.push({
            pathname: '/profile/buklod-faculty-groups' as any,
            params: { id: classroomId, name: classroomName },
          }),
      });
    }

    for (const obs of (obsRes.data ?? []) as Array<{
      id: string;
      student_user_id: string;
      observation_type: string;
      score: number | null;
    }>) {
      next.push({
        id: `obs:${obs.id}`,
        kind: 'Unreleased observation',
        title: `${names.get(obs.student_user_id) ?? 'Student'} • ${obs.observation_type}`,
        detail: obs.score == null ? 'Needs review' : `Score ${obs.score}`,
        open: () =>
          router.push({
            pathname: '/profile/buklod-faculty-participation' as any,
            params: { id: classroomId, name: classroomName },
          }),
      });
    }

    const closedSessions = (sessionsRes.data ?? []) as Array<{
      id: string;
      opened_at: string;
      closed_at: string | null;
    }>;
    if (closedSessions.length > 0) {
      const { data: logData } = await supabase
        .from('buklod_education_attendance_log')
        .select('session_id,student_user_id,time_in')
        .in(
          'session_id',
          closedSessions.map(item => item.id)
        );

      const timed = new Set(
        ((logData ?? []) as Array<{ session_id: string; student_user_id: string; time_in: string | null }>)
          .filter(item => item.time_in)
          .map(item => `${item.session_id}:${item.student_user_id}`)
      );

      for (const session of closedSessions) {
        for (const student of roster.filter(item => item.status !== 'DROPPED')) {
          if (timed.has(`${session.id}:${student.student_user_id}`)) continue;
          next.push({
            id: `absent:${session.id}:${student.student_user_id}`,
            kind: 'Missed time-in',
            title: names.get(student.student_user_id) ?? 'Student',
            detail: `Closed session ${new Date(session.opened_at).toLocaleString()}`,
            open: () =>
              router.push({
                pathname: '/profile/buklod-faculty-attendance' as any,
                params: { id: classroomId, name: classroomName },
              }),
          });
        }
      }
    }

    const { error: integrityError, data: integrityData } = await supabase
      .from('buklod_education_integrity_events')
      .select('id,student_user_id,event_type,severity,assessment_id,reviewed_at')
      .eq('classroom_id', classroomId)
      .is('reviewed_at', null)
      .limit(25);

    if (!integrityError) {
      for (const event of (integrityData ?? []) as Array<{
        id: number | string;
        student_user_id: string;
        event_type: string;
        severity: string;
        assessment_id: string | null;
      }>) {
        next.push({
          id: `integrity:${event.id}`,
          kind: 'Integrity event',
          title: `${names.get(event.student_user_id) ?? 'Student'} • ${event.event_type}`,
          detail: event.severity,
          open: () =>
            router.push({
              pathname: '/profile/buklod-faculty-assessments' as any,
              params: { id: classroomId, name: classroomName },
            }),
        });
      }
    }

    setCases(next);
  }, [classroomId, classroomName]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />
        }
      >
        <FacultyClassHeader
          classroomName={classroomName}
          eyebrow="EXCEPTION QUEUE"
          title="Cases needing attention"
          subtitle="Only real records from this classroom. Empty means nothing is waiting."
        />

        {cases.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted, lineHeight: 19 }}>
              No uncertain grades, unreleased scores, missed time-ins, or exam anomalies for this class.
            </Text>
          </View>
        ) : (
          cases.map(item => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.card, { backgroundColor: theme.surface }, pressed && styles.pressed]}
              onPress={item.open}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color={theme.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.warning, fontWeight: '900', fontSize: 11 }}>{item.kind}</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.detail, { color: theme.textMuted }]}>{item.detail}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  empty: { borderRadius: 16, padding: 16 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 16, padding: 14, marginBottom: 9 },
  title: { fontWeight: '900', marginTop: 3 },
  detail: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.88 },
});
