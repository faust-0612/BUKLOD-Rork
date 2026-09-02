import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { formationCopy, STAGE_PHASES } from '@/lib/formationCopy';
import { pickPrimaryWeeklyLesson } from '@/lib/formationPacing';
import { colors } from '@/lib/theme';
import type { FormationWeeklyDelivery } from '@/types/buklodFormation';

type Props = {
  stageCode: number;
  delivery: FormationWeeklyDelivery | null;
  trackTitle?: string;
};

export default function FormationWeeklySection({
  stageCode,
  delivery,
  trackTitle,
}: Props) {
  const weekLessons = useMemo(
    () => (delivery?.lessons ?? []).filter((l) => l.in_current_week),
    [delivery?.lessons],
  );

  const primary = useMemo(
    () => pickPrimaryWeeklyLesson(delivery?.lessons ?? []),
    [delivery?.lessons],
  );

  const handleContinue = () => {
    if (!primary) return;

    if (primary.learning_lesson_id) {
      router.push({
        pathname: '/learn/lesson',
        params: { lessonId: primary.learning_lesson_id },
      } as any);
      return;
    }

    router.push({
      pathname: '/learn/lesson',
      params: { trackLessonId: primary.track_lesson_id },
    } as any);
  };

  if (!delivery?.delivery_assigned) {
    return (
      <Card>
        <Text style={shared.muted}>{formationCopy.curriculumPreparing}</Text>
      </Card>
    );
  }

  return (
    <>
      <SectionTitle>{formationCopy.thisWeek.toUpperCase()}</SectionTitle>
      <Card>
        <Text style={styles.trackTitle}>
          BUKLOD {stageCode} — {STAGE_PHASES[stageCode]}
        </Text>
        {!!(trackTitle ?? delivery.track_title) && (
          <Text style={styles.trackSub}>
            {(trackTitle ?? delivery.track_title)?.toUpperCase()} TRACK
          </Text>
        )}

        <Text style={styles.weekMeta}>
          {weekLessons.length} Formation Lesson
          {weekLessons.length === 1 ? '' : 's'}
        </Text>

        {weekLessons.length === 0 && (
          <Text style={shared.muted}>{formationCopy.futureFormation}</Text>
        )}

        {weekLessons.map((lesson) => (
          <Pressable
            key={lesson.track_lesson_id}
            style={styles.lessonRow}
            onPress={() => {
              if (lesson.learning_lesson_id && lesson.access_allowed) {
                router.push({
                  pathname: '/learn/lesson',
                  params: { lessonId: lesson.learning_lesson_id },
                } as any);
                return;
              }

              if (!lesson.access_allowed) return;

              router.push({
                pathname: '/learn/lesson',
                params: { trackLessonId: lesson.track_lesson_id },
              } as any);
            }}
            disabled={!lesson.access_allowed}
          >
            <Text style={styles.lessonMark}>
              {lesson.approved ? '✓' : lesson.access_allowed ? '•' : '○'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lessonTitle}>
                Lesson {lesson.lesson_sequence}
                {lesson.approved ? ' — completed' : ''}
              </Text>
              <Text style={shared.muted} numberOfLines={1}>
                {lesson.title}
              </Text>
            </View>
          </Pressable>
        ))}

        {(delivery.bayanihan_required ?? 0) > 0 && (
          <Text style={styles.metric}>
            {stageCode === 107
              ? formationCopy.missionActions
              : formationCopy.bayanihan}{' '}
            {Number(delivery.bayanihan_verified ?? 0)} /{' '}
            {Number(delivery.bayanihan_required ?? 0)} verified
          </Text>
        )}

        <Text style={shared.muted}>{formationCopy.futureFormation}</Text>

        {primary?.learning_lesson_id && primary.access_allowed && (
          <View style={{ marginTop: 12 }}>
            <Button title={formationCopy.continue} onPress={handleContinue} />
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  trackTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.greenDark,
  },
  trackSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  weekMeta: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
    paddingVertical: 4,
  },
  lessonMark: {
    width: 18,
    fontSize: 16,
    fontWeight: '900',
    color: colors.greenDark,
  },
  lessonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  metric: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
