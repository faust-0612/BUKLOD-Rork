import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared, Button } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { colors } from '@/lib/theme';
import { useFormationJourney } from '@/hooks/useFormationJourney';
import {
  friendlyLessonBlockingReason,
  formationCopy,
  lessonBlockingGuide,
} from '@/lib/formationCopy';
import {
  mergeLessonAccessWithLegacySequentialLock,
  requiresFormationSequentialLock,
} from '@/lib/formationPacing';
import {
  loadFormationLessonAccessBatch,
  loadMyFormationRoleTrack,
  loadMyFormationWeeklyDelivery,
} from '@/lib/buklodFormationProgress';
import FormationWeeklySection from '@/components/formation/FormationWeeklySection';
import type {
  FormationLessonAccess,
  FormationWeeklyDelivery,
} from '@/types/buklodFormation';

export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { online } = useNetwork();

  const [track, setTrack] = useState<any>(null);
  const [offlineMissing, setOfflineMissing] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);

  const [formationStatuses, setFormationStatuses] = useState<any[]>([]);
  const [legacyProgress, setLegacyProgress] = useState<any[]>([]);
  const [roleTrack, setRoleTrack] = useState<Record<string, unknown> | null>(null);
  const [weeklyDelivery, setWeeklyDelivery] =
    useState<FormationWeeklyDelivery | null>(null);
  const [lessonAccessById, setLessonAccessById] = useState<
    Map<string, FormationLessonAccess>
  >(new Map());

  const formationJourney = useFormationJourney(user?.id);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const saved = await getOfflineCache<{
      track: any; lessons: any[]; enrollment: any;
      statuses: any[]; legacyProgress: any[];
      accessEntries: Array<[string, FormationLessonAccess]>;
      weeklyDelivery: FormationWeeklyDelivery | null;
    }>('learning-track-v1:' + id, { userId: user.id, allowStale: true });
    if (saved?.data?.enrollment?.user_id === user.id && saved.data.track?.id === id) {
      setTrack(saved.data.track);
      setLessons(saved.data.lessons);
      setEnrollment(saved.data.enrollment);
      setFormationStatuses(saved.data.statuses);
      setLegacyProgress(saved.data.legacyProgress);
      setLessonAccessById(new Map(saved.data.accessEntries));
      setWeeklyDelivery(saved.data.weeklyDelivery);
      setOfflineMissing(false);
    }
    if (!online) {
      setOfflineMissing(!saved?.data?.enrollment || saved.data.enrollment.user_id !== user.id);
      return;
    }
    setOfflineMissing(false);

    const [
      { data: t },
      { data: l },
      { data: e },
    ] = await Promise.all([
      supabase
        .from('learning_tracks')
        .select('*')
        .eq('id', id)
        .single(),

      supabase
        .from('learning_lessons')
        .select('*')
        .eq('track_id', id)
        .order('lesson_number'),

      supabase
        .from('track_enrollments')
        .select('*')
        .eq('track_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    setTrack(t);
    setLessons(l ?? []);
    setEnrollment(e);

    if (t?.stage_code === 106 && formationJourney.engineEnabled) {
      try {
        const trackInfo = await loadMyFormationRoleTrack();
        setRoleTrack(trackInfo);
      } catch {
        setRoleTrack(null);
      }
    } else {
      setRoleTrack(null);
    }

    const stageNum = Number(t?.stage_code ?? 0);
    if (
      formationJourney.engineEnabled &&
      (stageNum === 106 || stageNum === 107)
    ) {
      try {
        const weekly = await loadMyFormationWeeklyDelivery(stageNum);
        setWeeklyDelivery(weekly);
      } catch {
        setWeeklyDelivery(null);
      }
    } else {
      setWeeklyDelivery(null);
    }

    const isFormationTrack =
      t?.formation_program === 'ccp' ||
      t?.formation_program === 'discipleship';

    const lessonRows = l ?? [];
    const statusRows: any[] = [];
    let progressSnapshot: any[] = [];
    let accessEntries: Array<[string, FormationLessonAccess]> = [];

    if (isFormationTrack) {
      const { data: statusData } = await supabase.rpc(
        'get_my_formation_track_lesson_status',
        {
          p_track_id: id,
        }
      );

      statusRows.push(...(statusData ?? []));
      setFormationStatuses(statusRows);
      setLegacyProgress([]);
    } else if (e?.id) {
      const { data: p } = await supabase
        .from('lesson_progress')
        .select('lesson_id,completed_at')
        .eq('enrollment_id', e.id);

      progressSnapshot = p ?? [];
      setLegacyProgress(progressSnapshot);
      setFormationStatuses([]);
    } else {
      setLegacyProgress([]);
      setFormationStatuses([]);
    }

    const applySequentialLock =
      isFormationTrack &&
      lessonRows.length > 0 &&
      requiresFormationSequentialLock(
        stageNum > 0 ? stageNum : null,
        formationJourney.engineEnabled,
      );

    if (applySequentialLock) {
      try {
        const statusByLessonId = new Map<string, { official_status?: string }>(
          statusRows.map((row) => [row.lesson_id, row]),
        );
        const accessMap = formationJourney.engineEnabled
          ? await loadFormationLessonAccessBatch(
              lessonRows.map((lesson: { id: string }) => lesson.id),
            )
          : new Map<string, FormationLessonAccess>();
        const merged = new Map<string, FormationLessonAccess>();

        for (const lesson of lessonRows) {
          const resolved = mergeLessonAccessWithLegacySequentialLock(
            accessMap.get(lesson.id),
            {
              engineEnabled: formationJourney.engineEnabled,
              isFormation: true,
              lessonId: lesson.id,
              stageCode: stageNum > 0 ? stageNum : null,
              lessons: lessonRows.map(
                (row: { id: string; lesson_number: number }) => ({
                  id: row.id,
                  lesson_number: row.lesson_number,
                }),
              ),
              statusByLessonId,
            },
          );

          if (resolved) {
            merged.set(lesson.id, resolved);
          }
        }

        accessEntries = Array.from(merged.entries());
        setLessonAccessById(merged);
      } catch {
        setLessonAccessById(new Map());
      }
    } else {
      setLessonAccessById(new Map());
    }

    if (t?.status === 'published' && e?.user_id === user.id && Array.isArray(l)) {
      void setOfflineCache('learning-track-v1:' + id, {
        track: t, lessons: lessonRows, enrollment: e,
        statuses: statusRows, legacyProgress: progressSnapshot,
        accessEntries, weeklyDelivery: null,
      }, { userId: user.id, ttlMs: 30 * 24 * 60 * 60 * 1000 }).catch(() => undefined);
    }
    if (isFormationTrack) return;
  }, [id, user?.id, formationJourney.engineEnabled, online]);

  useEffect(() => {
    load();
  }, [load]);

  const isFormation =
    track?.formation_program === 'ccp' ||
    track?.formation_program === 'discipleship';

  const statusMap = useMemo(() => {
    const map = new Map<string, any>();

    formationStatuses.forEach((item) => {
      map.set(item.lesson_id, item);
    });

    return map;
  }, [formationStatuses]);

  const legacyCompletedSet = useMemo(
    () =>
      new Set(
        legacyProgress
          .filter((p) => p.completed_at)
          .map((p) => p.lesson_id)
      ),
    [legacyProgress]
  );

  const approvedCount = isFormation
    ? formationStatuses.filter(
        (x) => x.official_status === 'approved'
      ).length
    : legacyCompletedSet.size;

  const studiedCount = isFormation
    ? formationStatuses.filter((x) => x.studied).length
    : legacyCompletedSet.size;

  const pendingAdminCount = isFormation
    ? formationStatuses.filter(
        (x) => x.official_status === 'pending_admin'
      ).length
    : 0;

  const rejectedCount = isFormation
    ? formationStatuses.filter(
        (x) => x.official_status === 'rejected'
      ).length
    : 0;

  const percent = lessons.length
    ? Math.round((approvedCount / lessons.length) * 100)
    : 0;

  const lessonStatus = (lessonId: string) => {
    if (!isFormation) {
      return legacyCompletedSet.has(lessonId)
        ? {
            label: '✓ Completed',
            style: styles.approved,
          }
        : {
            label: 'Not completed',
            style: styles.mutedStatus,
          };
    }

    const item = statusMap.get(lessonId);

    if (item?.official_status === 'approved') {
      return {
        label: '✓ Admin Approved',
        style: styles.approved,
      };
    }

    if (item?.official_status === 'pending_admin') {
      return {
        label: 'Pastor Validated',
        style: styles.pending,
      };
    }

    if (item?.official_status === 'rejected') {
      return {
        label: 'Review Required',
        style: styles.rejected,
      };
    }

    if (item?.studied) {
      return {
        label: 'Studied • Awaiting Pastor',
        style: styles.studied,
      };
    }

    return {
      label: 'Not Yet Studied',
      style: styles.mutedStatus,
    };
  };

  const visibleLessons = useMemo(() => {
    const code = Number(track?.stage_code ?? 0);
    if (
      !formationJourney.engineEnabled ||
      !weeklyDelivery?.delivery_assigned ||
      (code !== 106 && code !== 107)
    ) {
      return lessons;
    }

    const releasedIds = new Set(
      (weeklyDelivery.lessons ?? [])
        .filter((l) => l.calendar_released || l.approved)
        .map((l) => l.learning_lesson_id)
        .filter(Boolean),
    );

    return lessons.filter((lesson) => releasedIds.has(lesson.id));
  }, [
    lessons,
    weeklyDelivery,
    formationJourney.engineEnabled,
    track?.stage_code,
  ]);

  const stageCode = Number(track?.stage_code ?? 0);
  const sequentialLockActive =
    isFormation &&
    requiresFormationSequentialLock(
      stageCode > 0 ? stageCode : null,
      formationJourney.engineEnabled,
    );

  const openLesson = (lesson: { id: string }) => {
    const access = lessonAccessById.get(lesson.id);

    if (
      sequentialLockActive &&
      (!access || !access.allowed)
    ) {
      Alert.alert(
        formationCopy.lessonUnavailableTitle,
        [
          friendlyLessonBlockingReason(access?.blocking_reason),
          lessonBlockingGuide(access?.blocking_reason),
        ]
          .filter(Boolean)
          .join('\n\n') ||
          formationCopy.lessonStageLockedGuide,
      );
      return;
    }

    router.push({
      pathname: '/learn/lesson',
      params: {
        lessonId: lesson.id,
        enrollmentId: enrollment?.id ?? '',
      },
    });
  };

  if (!track) return offlineMissing ? (
    <View style={shared.content}><Text style={shared.body}>No saved lessons for this track on this device. Connect once to download them.</Text></View>
  ) : null;

  const journeyStage = formationJourney.journey?.stages.find(
    (s) => s.stage_code === stageCode,
  );

  return (
    <FlatList
      contentContainerStyle={shared.content}
      data={visibleLessons}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.stage}>
            {track.stage_code
              ? `BUKLOD ${track.stage_code}`
              : 'BUKLOD LEARNING'}
          </Text>

          <Text style={shared.h1}>{track.title}</Text>

          {!!track.description && (
            <Text style={shared.body}>
              {track.description}
            </Text>
          )}

          <SectionTitle>
            {isFormation
              ? 'OFFICIAL FORMATION PROGRESS'
              : 'PROGRESS'}
          </SectionTitle>

          <Card>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressLabel}>
                  {isFormation
                    ? 'Admin Approved'
                    : 'Completed'}
                </Text>

                <Text style={styles.progressCount}>
                  {approvedCount} of {lessons.length} lessons
                </Text>
              </View>

              <Text style={styles.percent}>
                {percent}%
              </Text>
            </View>

            <View style={styles.bar}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${percent}%`,
                  },
                ]}
              />
            </View>

            {isFormation && (
              <>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryNumber}>
                      {studiedCount}
                    </Text>
                    <Text style={styles.summaryLabel}>
                      Studied
                    </Text>
                  </View>

                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryNumber}>
                      {pendingAdminCount}
                    </Text>
                    <Text style={styles.summaryLabel}>
                      Pastor Validated
                    </Text>
                  </View>

                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryNumber}>
                      {approvedCount}
                    </Text>
                    <Text style={styles.summaryLabel}>
                      Approved
                    </Text>
                  </View>
                </View>

                {rejectedCount > 0 && (
                  <Text style={styles.reviewText}>
                    {rejectedCount} lesson
                    {rejectedCount === 1 ? '' : 's'} require review.
                  </Text>
                )}

                <View style={styles.divider} />

                <Text style={styles.explanation}>
                  Studying a lesson does not officially complete it.
                  Official progress is counted only after Pastor
                  validation and System Admin final approval.
                </Text>
              </>
            )}
          </Card>

          {formationJourney.engineEnabled &&
            (stageCode === 106 || stageCode === 107) && (
              <FormationWeeklySection
                stageCode={stageCode}
                delivery={weeklyDelivery}
                trackTitle={
                  typeof roleTrack?.title_en === 'string'
                    ? roleTrack.title_en
                    : undefined
                }
              />
            )}

          {formationJourney.engineEnabled && journeyStage && (
            <>
              <SectionTitle>STAGE REQUIREMENTS</SectionTitle>
              <Card>
                {(journeyStage.stage_points_required ?? 0) > 0 && (
                  <Text style={styles.requirementLine}>
                    {formationCopy.buklodPoints}{' '}
                    {Number(journeyStage.stage_points_current ?? 0)} /{' '}
                    {Number(journeyStage.stage_points_required ?? 0)}
                  </Text>
                )}
                {(journeyStage.stage_bayanihan_required ?? 0) > 0 && (
                  <Text style={styles.requirementLine}>
                    {stageCode === 107
                      ? formationCopy.missionActions
                      : formationCopy.bayanihan}{' '}
                    {Number(journeyStage.stage_bayanihan_current ?? 0)} /{' '}
                    {Number(journeyStage.stage_bayanihan_required ?? 0)}{' '}
                    verified
                  </Text>
                )}
                {stageCode === 107 &&
                  (journeyStage.stage_points_required ?? 0) === 0 && (
                    <Text style={styles.requirementLine}>
                      {formationCopy.buklodPoints} ·{' '}
                      {formationCopy.noPointRequirement}
                    </Text>
                  )}
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Button
                    title="Documents & Covenants"
                    onPress={() =>
                      router.push({
                        pathname: '/formation/documents',
                        params: { stage: String(stageCode) },
                      } as any)
                    }
                  />
                  {(journeyStage.stage_bayanihan_required ?? 0) > 0 && (
                    <Button
                      title={
                        stageCode === 107
                          ? 'Submit Mission Action'
                          : 'Submit Bayanihan Action'
                      }
                      onPress={() =>
                        router.push({
                          pathname: '/formation/bayanihan-action',
                          params: { stage: String(stageCode) },
                        } as any)
                      }
                    />
                  )}
                </View>
              </Card>
            </>
          )}

          {formationJourney.engineEnabled && stageCode === 106 && (
            <>
              <SectionTitle>FORMATION TRACK</SectionTitle>
              <Card>
                {roleTrack?.assigned ? (
                  <>
                    <Text style={styles.trackAssigned}>
                      {(roleTrack.title_en as string) ?? 'Assigned Track'}
                    </Text>
                    <Text style={shared.muted}>
                      {String(roleTrack.track_code ?? '').replace(/_/g, ' ')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.trackAwaiting}>
                      {formationCopy.awaitingTrack}
                    </Text>
                    <Text style={shared.muted}>
                      {formationCopy.trackAssignmentHint}
                    </Text>
                  </>
                )}
              </Card>
            </>
          )}

          {formationJourney.engineEnabled &&
            journeyStage?.repeat_required && (
              <>
                <SectionTitle>REPEAT REQUIRED</SectionTitle>
                <Card>
                  <Text style={shared.body}>
                    Your previous completion is preserved. Complete required
                    lessons again before continuing.
                  </Text>
                  <View style={{ marginTop: 10 }}>
                    <Button
                      title="View Repeat Requirements"
                      onPress={() =>
                        router.push({
                          pathname: '/formation/repeat-review',
                          params: {
                            stage: String(stageCode),
                            mode: 'member',
                          },
                        } as any)
                      }
                    />
                  </View>
                </Card>
              </>
            )}

          {formationJourney.engineEnabled && stageCode === 107 && (
            <>
              <SectionTitle>MISSION FORMATION</SectionTitle>
              <Card>
                <Text style={shared.body}>
                  Record mission field work and church planting milestones with
                  mentor validation.
                </Text>
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Button
                    title="Mission Journal"
                    onPress={() => router.push('/formation/mission-journal' as any)}
                  />
                  <Button
                    title="Mission Project Milestones"
                    onPress={() => router.push('/formation/mission-project' as any)}
                  />
                </View>
              </Card>
            </>
          )}

          <SectionTitle>LESSONS</SectionTitle>
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={shared.body}>
            No lessons are available in this track yet.
          </Text>
        </Card>
      }
      renderItem={({ item }) => {
        const status = lessonStatus(item.id);
        const access = lessonAccessById.get(item.id);
        const locked =
          sequentialLockActive &&
          (!access || !access.allowed);

        return (
          <Pressable
            onPress={() => openLesson(item)}
            style={locked ? styles.lessonRowLocked : undefined}
          >
            <Card>
              <View style={styles.lessonRow}>
                <View style={styles.lessonMain}>
                  <Text style={styles.lessonNumber}>
                    LESSON {item.lesson_number}
                  </Text>

                  <Text style={shared.h2}>
                    {item.title}
                  </Text>

                  <Text style={status.style}>
                    {status.label}
                  </Text>

                  {locked ? (
                    <Text style={styles.lessonLockedMeta}>
                      {friendlyLessonBlockingReason(access?.blocking_reason)}
                    </Text>
                  ) : null}
                </View>

                {!locked ? <Text style={styles.arrow}>›</Text> : null}
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  stage: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
  },

  progressCount: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '900',
    marginTop: 2,
  },

  percent: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.green,
  },

  bar: {
    height: 9,
    backgroundColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    marginVertical: 12,
  },

  fill: {
    height: '100%',
    backgroundColor: colors.green,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },

  summaryBox: {
    flex: 1,
    padding: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: 'center',
  },

  summaryNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },

  summaryLabel: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 2,
  },

  reviewText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },

  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 12,
  },

  rewardText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.green,
  },

  rewardMuted: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },

  explanation: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },

  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  lessonRowLocked: {
    opacity: 0.72,
  },

  lessonLockedMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },

  lessonMain: {
    flex: 1,
  },

  lessonNumber: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.green,
    marginBottom: 4,
  },

  approved: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
    color: colors.green,
  },

  pending: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
    color: colors.blue,
  },

  studied: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: colors.amber,
  },

  rejected: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
    color: colors.danger,
  },

  mutedStatus: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },

  lessonReward: {
    marginTop: 5,
    fontSize: 11,
    color: colors.muted,
  },

  arrow: {
    fontSize: 30,
    color: colors.muted,
    marginLeft: 10,
  },

  requirementLine: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },

  trackAssigned: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.greenDark,
  },

  trackAwaiting: {
    fontSize: 14,
    fontWeight: '900',
    color: '#B45309',
  },

  missionPhase: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
  },

  milestone: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});


