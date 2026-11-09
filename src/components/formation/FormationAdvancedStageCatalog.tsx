import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Card, shared } from '@/components/UI';
import {
  formationCopy,
  friendlyLessonBlockingReason,
  lessonBlockingGuide,
  STAGE_PHASES,
} from '@/lib/formationCopy';
import { loadFormationTrackLessonAccessBatch } from '@/lib/buklodFormationProgress';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { colors } from '@/lib/theme';
import type {
  FormationCatalogLesson,
  FormationLessonAccess,
  FormationRoleTrackCatalog,
  FormationStageCatalog,
} from '@/types/buklodFormation';

type Props = {
  stageCode: 106 | 107;
  catalog: FormationStageCatalog | null;
  stageLocked?: boolean;
  loading?: boolean;
};

function openLesson(
  lesson: FormationCatalogLesson,
  access?: FormationLessonAccess | null,
  stageLocked?: boolean,
  accessResolved?: boolean,
) {
  if (stageLocked) {
    Alert.alert(
      formationCopy.lessonUnavailableTitle,
      formationCopy.lessonStageLockedGuide,
    );
    return;
  }

  if (accessResolved && (!access || !access.allowed)) {
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

  if (access && !access.allowed) {
    Alert.alert(
      formationCopy.lessonUnavailableTitle,
      [
        friendlyLessonBlockingReason(access.blocking_reason),
        lessonBlockingGuide(access.blocking_reason),
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
    return;
  }

  if (!lesson.member_visible) {
    Alert.alert(
      formationCopy.lessonUnavailableTitle,
      formationCopy.lessonPendingReleaseGuide,
    );
    return;
  }

  if (lesson.learning_lesson_id) {
    router.push({
      pathname: '/learn/lesson',
      params: { lessonId: lesson.learning_lesson_id },
    } as any);
    return;
  }

  router.push({
    pathname: '/learn/lesson',
    params: { trackLessonId: lesson.track_lesson_id },
  } as any);
}

function LessonRows({
  lessons,
  stageLocked,
  lessonAccessByTrackLessonId,
  accessResolved,
}: {
  lessons: FormationCatalogLesson[];
  stageLocked?: boolean;
  lessonAccessByTrackLessonId: Map<string, FormationLessonAccess>;
  accessResolved: boolean;
}) {
  if (!lessons.length) {
    return (
      <Text style={shared.muted}>
        No lessons are published for this track yet.
      </Text>
    );
  }

  return (
    <>
      {lessons.map((lesson) => {
        const access = lessonAccessByTrackLessonId.get(lesson.track_lesson_id);
        const lessonLocked =
          stageLocked ||
          (accessResolved && (!access || !access.allowed));
        const openable = lesson.member_visible && !lessonLocked;

        return (
          <Pressable
            key={lesson.track_lesson_id}
            onPress={() =>
              openLesson(lesson, access, stageLocked, accessResolved)
            }
            style={[
              styles.lessonRow,
              !openable && styles.lessonRowMuted,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.lessonSequence}>
                Lesson {lesson.lesson_sequence}
              </Text>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              {!lesson.member_visible ? (
                <Text style={styles.lessonMeta}>Pending review / release</Text>
              ) : stageLocked ? (
                <Text style={styles.lessonMeta}>Stage locked</Text>
              ) : lessonLocked ? (
                <Text style={styles.lessonMeta}>
                  {friendlyLessonBlockingReason(access?.blocking_reason)}
                </Text>
              ) : null}
            </View>
            {openable ? <Text style={styles.arrow}>›</Text> : null}
          </Pressable>
        );
      })}
    </>
  );
}

function RoleTrackBlock({
  track,
  stageLocked,
  lessonAccessByTrackLessonId,
  accessResolved,
}: {
  track: FormationRoleTrackCatalog;
  stageLocked?: boolean;
  lessonAccessByTrackLessonId: Map<string, FormationLessonAccess>;
  accessResolved: boolean;
}) {
  return (
    <View style={styles.trackBlock}>
      <View style={styles.trackHead}>
        <Text style={styles.trackCode}>{track.track_code}</Text>
        <Text style={styles.trackTitle}>{track.title_en}</Text>
        {track.is_assigned ? (
          <Text style={styles.assignedPill}>YOUR TRACK</Text>
        ) : null}
      </View>
      <Text style={styles.trackMeta}>
        {track.member_visible_lessons} of {track.total_lessons} lessons available
      </Text>
      <LessonRows
        lessons={track.lessons}
        stageLocked={stageLocked}
        lessonAccessByTrackLessonId={lessonAccessByTrackLessonId}
        accessResolved={accessResolved}
      />
    </View>
  );
}

function CatalogSummary({
  stageCode,
  catalog,
  locked,
  onOpen,
}: {
  stageCode: 106 | 107;
  catalog: FormationStageCatalog;
  locked: boolean;
  onOpen: () => void;
}) {
  const visibleCount = catalog.counts.member_visible;
  const totalCount =
    stageCode === 106
      ? catalog.role_tracks.reduce(
          (sum, track) => sum + track.total_lessons,
          0,
        )
      : catalog.counts.catalog_total;
  const assignedTrack =
    stageCode === 106
      ? catalog.role_tracks.find((track) => track.is_assigned)
      : null;

  return (
    <Pressable onPress={onOpen} style={styles.summaryPress}>
      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryEyebrow}>
            BUKLOD {stageCode} · {STAGE_PHASES[stageCode]}
          </Text>
          <Text style={styles.summaryTitle}>
            {visibleCount} of {totalCount} lessons available
          </Text>
          {assignedTrack ? (
            <Text style={styles.summaryMeta}>
              Your track: {assignedTrack.title_en}
            </Text>
          ) : stageCode === 106 ? (
            <Text style={styles.summaryMeta}>Tap to browse role tracks</Text>
          ) : (
            <Text style={styles.summaryMeta}>Tap to browse mission lessons</Text>
          )}
          {locked ? (
            <Text style={styles.summaryLocked}>
              Complete the previous stage to unlock
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons
          name="chevron-up"
          size={22}
          color={colors.greenDark}
        />
      </View>
    </Pressable>
  );
}

export default function FormationAdvancedStageCatalog({
  stageCode,
  catalog,
  stageLocked = false,
  loading = false,
}: Props) {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [lessonAccessByTrackLessonId, setLessonAccessByTrackLessonId] =
    useState<Map<string, FormationLessonAccess>>(new Map());
  const [accessResolved, setAccessResolved] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const locked = stageLocked || catalog?.is_locked === true;

  useEffect(() => {
    if (!catalog || locked) {
      setLessonAccessByTrackLessonId(new Map());
      setAccessResolved(false);
      return;
    }

    const trackLessonIds = [
      ...catalog.role_tracks.flatMap((track) =>
        track.lessons.map((lesson) => lesson.track_lesson_id),
      ),
      ...catalog.mission_lessons.map((lesson) => lesson.track_lesson_id),
    ];

    if (!trackLessonIds.length) {
      setLessonAccessByTrackLessonId(new Map());
      setAccessResolved(true);
      return;
    }

    let cancelled = false;
    setAccessResolved(false);
    const accountId = user?.id;
    const cacheKey = 'formation-advanced-access-v1:' + stageCode;
    void (async () => {
      if (!accountId) {
        if (!cancelled) { setLessonAccessByTrackLessonId(new Map()); setAccessResolved(true); }
        return;
      }
      const saved = await getOfflineCache<Array<[string, FormationLessonAccess]>>(
        cacheKey, { userId: accountId, allowStale: true });
      if (cancelled) return;
      if (!online) {
        const stillValid = saved && Date.now() - saved.storedAt <= 7 * 24 * 60 * 60 * 1000;
        const knownIds = new Set(trackLessonIds);
        const entries = stillValid ? saved.data.filter(([id]) => knownIds.has(id)) : [];
        setLessonAccessByTrackLessonId(new Map(entries));
        setAccessResolved(true);
        return;
      }
      void loadFormationTrackLessonAccessBatch(trackLessonIds)
      .then((map) => {
        if (!cancelled) {
          setLessonAccessByTrackLessonId(map);
          setAccessResolved(true);
          void setOfflineCache(cacheKey, Array.from(map.entries()),
            { userId: accountId, ttlMs: 7 * 24 * 60 * 60 * 1000 })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLessonAccessByTrackLessonId(new Map());
          setAccessResolved(true);
        }
      });

    })();

    return () => {
      cancelled = true;
    };
  }, [catalog, locked, stageCode, user?.id, online]);

  if (loading) {
    return (
      <Card>
        <Text style={shared.muted}>Loading formation lessons...</Text>
      </Card>
    );
  }

  if (!catalog) {
    return null;
  }

  const hasCatalogContent =
    stageCode === 106
      ? catalog.role_tracks.some((track) => track.total_lessons > 0)
      : catalog.mission_lessons.length > 0;

  const hasVisibleLessons = catalog.counts.member_visible > 0;

  if (!hasCatalogContent) {
    return (
      <Card>
        <Text style={styles.notAvailable}>
          Mentoring lessons for this stage are released periodically.
        </Text>
      </Card>
    );
  }

  return (
    <>
      {locked ? (
        <View style={styles.lockBanner}>
          <Text style={styles.lockBannerText}>
            This stage is locked until you complete the previous formation stage.
          </Text>
        </View>
      ) : null}

      <Card>
        <CatalogSummary
          stageCode={stageCode}
          catalog={catalog}
          locked={locked}
          onOpen={() => setDrawerOpen(true)}
        />
      </Card>

      {!hasVisibleLessons ? (
        <Card>
          <Text style={shared.muted}>
            Lessons are being prepared. Published lessons will appear here when
            they are released for your track.
          </Text>
        </Card>
      ) : null}

      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setDrawerOpen(false)}
          />
          <View style={styles.drawer}>
            <View style={styles.drawerHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerEyebrow}>
                  BUKLOD {stageCode} · {STAGE_PHASES[stageCode]}
                </Text>
                <Text style={styles.drawerTitle}>Formation Lessons</Text>
              </View>
              <Pressable
                onPress={() => setDrawerOpen(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.drawerContent}
              keyboardShouldPersistTaps="handled"
            >
              {stageCode === 106 ? (
                catalog.role_tracks.map((track) => (
                  <RoleTrackBlock
                    key={track.role_track_id}
                    track={track}
                    stageLocked={locked}
                    lessonAccessByTrackLessonId={lessonAccessByTrackLessonId}
                    accessResolved={accessResolved}
                  />
                ))
              ) : (
                <View style={styles.trackBlock}>
                  <Text style={styles.trackTitle}>Mission Formation</Text>
                  <Text style={styles.trackMeta}>
                    {catalog.counts.member_visible} of{' '}
                    {catalog.counts.catalog_total} lessons available
                  </Text>
                  <LessonRows
                    lessons={catalog.mission_lessons}
                    stageLocked={locked}
                    lessonAccessByTrackLessonId={lessonAccessByTrackLessonId}
                    accessResolved={accessResolved}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <Button title="CLOSE" onPress={() => setDrawerOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  summaryPress: {
    paddingVertical: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.5,
  },
  summaryTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  summaryMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  summaryLocked: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    maxHeight: '82%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  drawerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  drawerEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.5,
  },
  drawerTitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
  drawerContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  trackBlock: {
    gap: 8,
  },
  trackHead: {
    gap: 2,
  },
  trackCode: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  trackMeta: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  assignedPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
  },
  lessonRowMuted: {
    opacity: 0.72,
  },
  lessonSequence: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.green,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  lessonMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  arrow: {
    fontSize: 24,
    color: colors.greenDark,
    fontWeight: '700',
  },
  lockBanner: {
    borderRadius: 10,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: '#F0D7A5',
    padding: 10,
    marginBottom: 8,
  },
  lockBannerText: {
    color: '#7A5B16',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  notAvailable: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
