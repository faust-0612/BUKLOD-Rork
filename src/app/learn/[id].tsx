import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [track, setTrack] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);

  const [formationStatuses, setFormationStatuses] = useState<any[]>([]);
  const [legacyProgress, setLegacyProgress] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id || !user) return;

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

    const isFormationTrack =
      t?.formation_program === 'ccp' ||
      t?.formation_program === 'discipleship';

    if (isFormationTrack) {
      const { data: statusData } = await supabase.rpc(
        'get_my_formation_track_lesson_status',
        {
          p_track_id: id,
        }
      );

      setFormationStatuses(statusData ?? []);
      setLegacyProgress([]);
      return;
    }

    if (e?.id) {
      const { data: p } = await supabase
        .from('lesson_progress')
        .select('lesson_id,completed_at')
        .eq('enrollment_id', e.id);

      setLegacyProgress(p ?? []);
    } else {
      setLegacyProgress([]);
    }
  }, [id, user?.id]);

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

  const totalPossibleReward = isFormation
    ? lessons.reduce(
        (sum, lesson) =>
          sum + Number(lesson.bayanihan_reward ?? 0),
        0
      )
    : 0;

  const approvedReward = isFormation
    ? formationStatuses
        .filter((x) => x.official_status === 'approved')
        .reduce(
          (sum, x) =>
            sum + Number(x.bayanihan_reward ?? 0),
          0
        )
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

  if (!track) return null;

  return (
    <FlatList
      contentContainerStyle={shared.content}
      data={lessons}
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

                <Text style={styles.rewardText}>
                  Approved Bayanihan: ₱{approvedReward.toFixed(2)}
                </Text>

                <Text style={styles.rewardMuted}>
                  Possible value for this track: ₱
                  {totalPossibleReward.toFixed(2)}
                </Text>

                <Text style={styles.explanation}>
                  Studying a lesson does not officially complete it.
                  Official progress is counted only after Pastor
                  validation and System Admin final approval.
                </Text>
              </>
            )}
          </Card>

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

        return (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/learn/lesson',
                params: {
                  lessonId: item.id,
                  enrollmentId: enrollment?.id ?? '',
                },
              })
            }
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

                  {isFormation && (
                    <Text style={styles.lessonReward}>
                      Bayanihan Value: ₱
                      {Number(
                        item.bayanihan_reward ?? 0
                      ).toFixed(2)}
                    </Text>
                  )}
                </View>

                <Text style={styles.arrow}>›</Text>
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
});


