import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { colors } from '@/lib/theme';
import { useFormationJourney } from '@/hooks/useFormationJourney';
import FormationJourneySection from '@/components/formation/FormationJourneySection';
import FormationAdvancedStageCatalog from '@/components/formation/FormationAdvancedStageCatalog';
import BuklodScopeLessonLicensesCard from '@/components/BuklodScopeLessonLicensesCard';
import BuklodClusterMembershipGate from '@/components/BuklodClusterMembershipGate';
import { mergeFormationStageProgress } from '@/lib/buklodLessonStages';
import { loadFormationStageCatalog } from '@/lib/buklodFormationProgress';
import type { FormationStageCatalog } from '@/types/buklodFormation';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type WeeklyDevotional = {
  id: string;
  title: string;
  bible_passage: string | null;
  reflection_text: string;

  week_number: number | null;
  lesson_number: number | null;
  series_title: string | null;
};

type StageProgress = {
  stage_code: number;
  stage_title: string;
  expected_lessons: number;
  approved_lessons: number;
  required_records: number;
  verified_records: number;
  lessons_complete: boolean;
  requirements_complete: boolean;
  stage_complete: boolean;
};

const STAGE_META: Record<
  number,
  {
    phase: string;
    description: string;
  }
> = {
  101: {
    phase: 'PAGHAHANDA',
    description:
      'Preparation • Gospel foundations, baptism, and understanding MZB Ministry',
  },
  102: {
    phase: 'PAGTATANIM',
    description:
      'Membership • Understanding the importance and work of the church',
  },
  103: {
    phase: 'PAGPAPALALIM',
    description:
      'Apprenticeship • The church and me, partnership, and support',
  },
  104: {
    phase: 'PAGPAPATABA',
    description:
      'CCP + Discipleship • Pre-Encounter and Post-Encounter',
  },
  105: {
    phase: 'PAMUMUNGA',
    description:
      'Leadership • Formation and preparation for spiritual leadership',
  },
  106: {
    phase: 'KAMANGGAGAWA',
    description:
      'Workers Training • Ongoing and periodic mentoring lessons',
  },
  107: {
    phase: 'PANG-MISYONG GAWAIN',
    description:
      'Mission Training • Ongoing and periodic mentoring for mission leaders',
  },
};

const COMPONENT_LABELS: Record<string, string> = {
  CCP_1: 'CCP 1',
  CCP_2: 'CCP 2',
  CCP_3: 'CCP 3',
  CCP_4: 'CCP 4',
  CCP_5: 'CCP 5',
  PRE_ENCOUNTER: 'Pre-Encounter',
  POST_ENCOUNTER: 'Post-Encounter',
  LEADERSHIP_1: 'Leadership Lesson 1',
  LEADERSHIP_2: 'Leadership Lesson 2',
  LEADERSHIP_3: 'Leadership Lesson 3',
};

export function BuklodLearningContent({
  variant = 'screen',
}: {
  variant?: 'screen' | 'embedded';
}) {
  const embedded = variant === 'embedded';
  const { user , hasRole} = useAuth();
  const { activeScope } = useBuklodScope();

  /* PATCH_185B_PROGRESS_ADMIN */
  const canManageLearning = hasRole('system_admin');

  const [stages, setStages] = useState<StageProgress[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancedCatalogs, setAdvancedCatalogs] = useState<
    Partial<Record<106 | 107, FormationStageCatalog | null>>
  >({});
  const [advancedCatalogLoading, setAdvancedCatalogLoading] =
    useState(false);

  const formationJourney = useFormationJourney(user?.id);

  /*
   * PATCH 153D-1C2
   *
   * Weekly Devotional is intentionally separate
   * from the BUKLOD Formation Journey.
   */
  const [
    weeklyDevotional,
    setWeeklyDevotional,
  ] =
    useState<WeeklyDevotional | null>(
      null
    );

  const [
    weeklyDevotionalAvailable,
    setWeeklyDevotionalAvailable,
  ] = useState(false);

  const [
    weeklyDevotionalLoading,
    setWeeklyDevotionalLoading,
  ] = useState(false);


  const loadWeeklyDevotional =
    useCallback(async () => {
      if (!user) {
        setWeeklyDevotional(null);
        setWeeklyDevotionalAvailable(
          false
        );

        return;
      }


      setWeeklyDevotionalLoading(
        true
      );


      try {
        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'get_my_weekly_devotional'
          );


        /*
         * Before PATCH 153D is deployed,
         * silently hide this panel so the
         * existing Learn screen continues
         * working normally.
         */
        if (error) {
          setWeeklyDevotional(
            null
          );

          setWeeklyDevotionalAvailable(
            false
          );

          return;
        }


        setWeeklyDevotionalAvailable(
          true
        );


        const raw =
          Array.isArray(data)
            ? data[0] ?? null
            : data ?? null;


        if (!raw) {
          setWeeklyDevotional(
            null
          );

          return;
        }


        const devotionalId =
          raw.devotional_id ??
          raw.id ??
          null;


        if (!devotionalId) {
          setWeeklyDevotional(
            null
          );

          return;
        }


        const rawWeek =
          raw.week_number ??
          raw.week_no ??
          raw.week ??
          null;


        const rawLesson =
          raw.lesson_number ??
          raw.lesson_no ??
          raw.lesson_order ??
          raw.sort_order ??
          raw.day_number ??
          null;


        const parsedWeek =
          rawWeek === null
            ? null
            : Number(rawWeek);


        const parsedLesson =
          rawLesson === null
            ? null
            : Number(
                rawLesson
              );


        setWeeklyDevotional({
          id:
            String(
              devotionalId
            ),

          title:
            String(
              raw.lesson_title ??
              raw.title ??
              'Weekly Devotional'
            ),

          bible_passage:
            raw.bible_passage ??
            raw.scripture_reference ??
            raw.scripture ??
            null,

          reflection_text:
            String(
              raw.reflection_text ??
              raw.reflection_question ??
              raw.body ??
              ''
            ),

          week_number:
            parsedWeek !== null &&
            Number.isFinite(
              parsedWeek
            )
              ? parsedWeek
              : null,

          lesson_number:
            parsedLesson !== null &&
            Number.isFinite(
              parsedLesson
            )
              ? parsedLesson
              : null,

          series_title:
            raw.series_title ??
            raw.devotional_series_title ??
            null,
        });

      } catch {
        setWeeklyDevotional(
          null
        );

        setWeeklyDevotionalAvailable(
          false
        );

      } finally {
        setWeeklyDevotionalLoading(
          false
        );
      }
    }, [user?.id]);


  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const [
      { data: stageData, error: stageError },
      { data: trackData, error: trackError },
      { data: enrollmentData, error: enrollmentError },
    ] = await Promise.all([
      supabase.rpc('get_buklod_stage_progress', {
        p_user_id: user.id,
      }),

      supabase
        .from('learning_tracks')
        .select(
          'id,title,description,formation_program,stage_code,buklod_component_code,is_required,status'
        )
        .eq('status', 'published')
        .order('stage_code')
        .order('title'),

      supabase
        .from('track_enrollments')
        .select('id,track_id,status,completed_at')
        .eq('user_id', user.id),
    ]);

    setLoading(false);

    if (stageError) {
      Alert.alert(
        'Formation progress',
        stageError.message
      );
    }

    if (trackError) {
      Alert.alert(
        'Learning tracks',
        trackError.message
      );
    }

    if (enrollmentError) {
      Alert.alert(
        'Enrollment',
        enrollmentError.message
      );
    }

    setStages((stageData ?? []) as StageProgress[]);
    setTracks(trackData ?? []);
    setEnrollments(enrollmentData ?? []);
  }, [user?.id]);

  const loadAdvancedCatalogs = useCallback(async () => {
    if (!user?.id) {
      setAdvancedCatalogs({});
      return;
    }

    setAdvancedCatalogLoading(true);

    try {
      const [catalog106, catalog107] = await Promise.all([
        loadFormationStageCatalog(106),
        loadFormationStageCatalog(107),
      ]);

      setAdvancedCatalogs({
        106: catalog106,
        107: catalog107,
      });
    } catch (error: any) {
      console.warn('Formation advanced catalog:', error?.message ?? error);
      setAdvancedCatalogs({});
    } finally {
      setAdvancedCatalogLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void loadAdvancedCatalogs();
  }, [loadAdvancedCatalogs]);


  useEffect(() => {
    void loadWeeklyDevotional();
  }, [loadWeeklyDevotional]);


  const enrollmentMap = useMemo(() => {
    const map = new Map<string, any>();

    enrollments.forEach((item) => {
      map.set(item.track_id, item);
    });

    return map;
  }, [enrollments]);

  const displayStages = useMemo(
    () => mergeFormationStageProgress(stages),
    [stages],
  );

  const showFormationJourney =
    formationJourney.engineEnabled &&
    (formationJourney.journey?.stages?.length ?? 0) > 0;

  const tracksForStage = useCallback(
    (stageCode: number) =>
      tracks.filter(
        (track) =>
          Number(track.stage_code) === stageCode
      ),
    [tracks]
  );

  const journeyStageByCode = useMemo(() => {
    const map = new Map<number, any>();
    formationJourney.journey?.stages?.forEach((stage) => {
      map.set(stage.stage_code, stage);
    });
    return map;
  }, [formationJourney.journey?.stages]);

  const isFormationStageLocked = useCallback(
    (stageCode: number) => {
      if (!formationJourney.engineEnabled) {
        return false;
      }

      const journeyStage = journeyStageByCode.get(stageCode);
      if (!journeyStage) {
        return false;
      }

      return (
        journeyStage.is_locked === true ||
        journeyStage.access_allowed === false ||
        journeyStage.status === 'locked'
      );
    },
    [formationJourney.engineEnabled, journeyStageByCode],
  );

  const startTrack = async (trackId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    const stageCode = Number(track?.stage_code ?? 0);

    if (isFormationStageLocked(stageCode)) {
      Alert.alert(
        'Stage locked',
        'Complete the previous formation stage before starting this track.',
      );
      return;
    }

    const { error } = await supabase.rpc(
      'enroll_in_track',
      {
        p_track_id: trackId,
      }
    );

    if (error) {
      Alert.alert(
        'Could not start track',
        error.message
      );
      return;
    }

    await load();
    router.push(`/learn/${trackId}`);
  };

  const stageStatus = (stage: StageProgress) => {
    if (
      stage.stage_code === 106 ||
      stage.stage_code === 107
    ) {
      return {
        label: 'ONGOING MENTORING',
        style: styles.statusOngoing,
      };
    }

    if (stage.stage_complete) {
      return {
        label: '✓ STAGE COMPLETE',
        style: styles.statusComplete,
      };
    }

    if (
      stage.lessons_complete &&
      !stage.requirements_complete
    ) {
      return {
        label:
          'LESSONS COMPLETE • AGREEMENT PENDING',
        style: styles.statusPending,
      };
    }

    if (stage.approved_lessons > 0) {
      return {
        label: 'IN PROGRESS',
        style: styles.statusProgress,
      };
    }

    return {
      label: 'NOT YET COMPLETED',
      style: styles.statusMuted,
    };
  };

  const content = (
    <>
      {!embedded ? (
        <>
      <Text style={styles.eyebrow}>
        BUKLOD FORMATION
      </Text>

      <Text style={shared.h1}>
        Panumbalikin ang lahat kay Cristo
      </Text>
      {/* PATCH_162A_SPONSOR_LEARN */}

      <Text style={shared.body}>
        Study at your own pace. You may read
        lessons from later stages without waiting
        for previous agreements. Official lesson
        completion follows BUKLOD AI checking.
        No Pastor or Admin approval is required.
      </Text>

      {/* PATCH_185B_PROGRESS_ADMIN_BUTTON */}
      {canManageLearning && (
        <View style={{ marginTop: 12, marginBottom: 4 }}>
          <Button
            title="ADMIN · MANAGE LESSONS"
            onPress={() =>
              router.push('/admin/learning' as any)
            }
          />
        </View>
      )}
        </>
      ) : null}

      
      {/* PATCH_185B_OFFICIAL_PROGRESS_REMOVED */}

      {(weeklyDevotionalAvailable && (weeklyDevotionalLoading || !!weeklyDevotional)) /* PATCH_185B_HIDE_EMPTY_WEEKLY */ && (
        <>
          <SectionTitle>
            WEEKLY DEVOTIONAL
          </SectionTitle>

          <Card>
            {weeklyDevotionalLoading ? (
              <Text style={shared.muted}>
                Loading your weekly devotional...
              </Text>
            ) : weeklyDevotional ? (
              <>
                <View
                  style={
                    styles.weeklyTop
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.weeklyLabel
                      }
                    >
                      {[
                        weeklyDevotional.week_number
                          ? `WEEK ${weeklyDevotional.week_number}`
                          : null,

                        weeklyDevotional.lesson_number
                          ? `LESSON ${weeklyDevotional.lesson_number}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join('  •  ') ||
                        'CURRENT LESSON'}
                    </Text>

                    {!!weeklyDevotional.series_title && (
                      <Text
                        style={
                          styles.weeklySeries
                        }
                      >
                        {
                          weeklyDevotional.series_title
                        }
                      </Text>
                    )}
                  </View>

                  <View
                    style={
                      styles.weeklyBadge
                    }
                  >
                    <Text
                      style={
                        styles.weeklyBadgeText
                      }
                    >
                      THIS WEEK
                    </Text>
                  </View>
                </View>


                {!!weeklyDevotional.bible_passage && (
                  <Text
                    style={
                      styles.weeklyScripture
                    }
                  >
                    {
                      weeklyDevotional.bible_passage
                    }
                  </Text>
                )}


                <Text
                  style={
                    styles.weeklyTitle
                  }
                >
                  {
                    weeklyDevotional.title
                  }
                </Text>


                {!!weeklyDevotional.reflection_text && (
                  <Text
                    style={
                      styles.weeklyDescription
                    }
                    numberOfLines={3}
                  >
                    {
                      weeklyDevotional.reflection_text
                    }
                  </Text>
                )}


                <Text
                  style={
                    styles.weeklyNote
                  }
                >
                  Your assigned devotional follows
                  weekly progression. Refreshing the
                  app will not move you to another
                  lesson during the same week.
                </Text>


                <View
                  style={{
                    marginTop: 13,
                  }}
                >
                  <Button
                    title="OPEN WEEKLY DEVOTIONAL"
                    onPress={() =>
                      router.push(
                        `/devotional/${weeklyDevotional.id}`
                      )
                    }
                  />
                </View>
              </>
            ) : (
              <>
                <Text
                  style={
                    styles.weeklyTitle
                  }
                >
                  No weekly devotional assigned
                </Text>

                <Text
                  style={
                    styles.weeklyDescription
                  }
                >
                  When a Pastor or System Admin
                  assigns a Devotional Series to
                  you, your current weekly lesson
                  will appear here.
                </Text>
              </>
            )}
          </Card>
        </>
      )}


      <SectionTitle>
        FORMATION JOURNEY
      </SectionTitle>

      {!embedded &&
      activeScope?.show_faith_content &&
      activeScope.scope_id ? (
        <BuklodScopeLessonLicensesCard
          scopeId={activeScope.scope_id}
          scopeName={activeScope.name}
          defaultExpanded
        />
      ) : null}

      {showFormationJourney && formationJourney.journey ? (
        <FormationJourneySection
          journey={formationJourney.journey}
          tracks={tracks}
          loading={formationJourney.loading}
          onRefresh={formationJourney.refresh}
          advancedCatalogs={advancedCatalogs}
          advancedCatalogLoading={advancedCatalogLoading}
          isFormationStageLocked={isFormationStageLocked}
        />
      ) : (
        <>
      {(loading || formationJourney.loading) && (
        <Card>
          <Text style={shared.body}>
            Loading your formation progress...
          </Text>
        </Card>
      )}

      {!loading &&
        !formationJourney.loading &&
        displayStages.map((stage) => {
          const meta =
            STAGE_META[stage.stage_code];

          const stageTracks =
            tracksForStage(stage.stage_code);

          const status =
            stageStatus(stage);

          const percent =
            stage.expected_lessons > 0
              ? Math.min(
                  100,
                  Math.round(
                    (stage.approved_lessons /
                      stage.expected_lessons) *
                      100
                  )
                )
              : 0;

          return (
            <View
              key={stage.stage_code}
              style={styles.stageWrapper}
            >
              <Card>
                <View style={styles.stageTop}>
                  <View style={styles.stageTitleArea}>
                    <Text style={styles.stageCode}>
                      BUKLOD {stage.stage_code}
                    </Text>

                    <Text style={styles.stagePhase}>
                      {meta?.phase ??
                        stage.stage_title}
                    </Text>
                  </View>

                  {stage.expected_lessons > 0 && (
                    <Text style={styles.percent}>
                      {percent}%
                    </Text>
                  )}
                </View>

                <Text style={styles.stageName}>
                  {stage.stage_title}
                </Text>

                {!!meta?.description && (
                  <Text style={styles.description}>
                    {meta.description}
                  </Text>
                )}

                <Text style={status.style}>
                  {status.label}
                </Text>

                {stage.expected_lessons > 0 && (
                  <>
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

                    <Text style={styles.progressText}>
                      {stage.approved_lessons} of{' '}
                      {stage.expected_lessons}{' '}
                      lessons AI Approved
                    </Text>
                  </>
                )}

                {stage.required_records > 0 && (
                  <View
                    style={styles.requirementBox}
                  >
                    <Text
                      style={
                        styles.requirementTitle
                      }
                    >
                      OFFICIAL RECORDS /
                      AGREEMENTS
                    </Text>

                    <Text
                      style={
                        styles.requirementText
                      }
                    >
                      {stage.verified_records} of{' '}
                      {stage.required_records}{' '}
                      verified
                    </Text>

                    {stage.lessons_complete &&
                      !stage.requirements_complete && (
                        <Text
                          style={
                            styles.requirementPending
                          }
                        >
                          Lessons are complete,
                          but required agreements
                          or records are still
                          pending verification.
                        </Text>
                      )}
                  </View>
                )}

                {(stage.stage_code === 106 ||
                  stage.stage_code === 107) ? (
                  <FormationAdvancedStageCatalog
                    stageCode={stage.stage_code as 106 | 107}
                    catalog={
                      advancedCatalogs[
                        stage.stage_code as 106 | 107
                      ] ?? null
                    }
                    stageLocked={
                      formationJourney.engineEnabled
                        ? isFormationStageLocked(stage.stage_code)
                        : (advancedCatalogs[
                            stage.stage_code as 106 | 107
                          ]?.is_locked ?? false)
                    }
                    loading={advancedCatalogLoading}
                  />
                ) : null}

                {stageTracks.length > 0 && (
                  <>
                    <View style={styles.divider} />

                    <Text
                      style={
                        styles.trackSectionTitle
                      }
                    >
                      AVAILABLE LESSON TRACKS
                    </Text>

                    {stageTracks.map((track) => {
                      const enrollment =
                        enrollmentMap.get(
                          track.id
                        );

                      const componentLabel =
                        COMPONENT_LABELS[
                          track
                            .buklod_component_code
                        ] ??
                        track.title;

                      return (
                        <View
                          key={track.id}
                          style={
                            styles.trackItem
                          }
                        >
                          <Pressable
                            style={
                              styles.trackPress
                            }
                            onPress={() => {
                              if (
                                isFormationStageLocked(
                                  stage.stage_code,
                                )
                              ) {
                                Alert.alert(
                                  'Stage locked',
                                  'Complete the previous formation stage before opening this track.',
                                );
                                return;
                              }

                              if (enrollment) {
                                router.push(
                                  `/learn/${track.id}`
                                );
                              }
                            }}
                          >
                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                style={
                                  styles.component
                                }
                              >
                                {componentLabel}
                              </Text>

                              <Text
                                style={
                                  styles.trackTitle
                                }
                              >
                                {track.title}
                              </Text>

                              {!!track.description && (
                                <Text
                                  style={
                                    styles.trackDescription
                                  }
                                  numberOfLines={2}
                                >
                                  {
                                    track.description
                                  }
                                </Text>
                              )}
                            </View>

                            {enrollment && (
                              <Text
                                style={
                                  styles.arrow
                                }
                              >
                                ›
                              </Text>
                            )}
                          </Pressable>

                          {!enrollment && (
                            <Button
                              title="START TRACK"
                              onPress={() =>
                                startTrack(
                                  track.id
                                )
                              }
                            />
                          )}

                          {!!enrollment && (
                            <Text
                              style={
                                styles.enrolled
                              }
                            >
                              {enrollment.status ===
                              'completed'
                                ? 'Previously completed enrollment • Official formation status shown above'
                                : 'Enrolled • Tap to continue'}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                {stageTracks.length === 0 &&
                  !(
                    (stage.stage_code === 106 ||
                      stage.stage_code === 107) &&
                    (advancedCatalogLoading ||
                      (advancedCatalogs[stage.stage_code as 106 | 107]
                        ?.counts.catalog_total ?? 0) > 0)
                  ) && (
                  <>
                    <View style={styles.divider} />

                    <Text
                      style={styles.notAvailable}
                    >
                      {stage.stage_code === 106 ||
                      stage.stage_code === 107
                        ? 'Mentoring lessons for this stage are released periodically.'
                        : 'No published lesson track is available for this stage yet.'}
                    </Text>
                  </>
                )}
              </Card>
            </View>
          );
        })}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <View style={styles.embedded}>
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={shared.content}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 1,
  },

  infoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.green,
    marginBottom: 5,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },

  weeklyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  weeklyLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 0.7,
  },

  weeklySeries: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },

  weeklyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
  },

  weeklyBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.green,
  },

  weeklyScripture: {
    marginTop: 13,
    fontSize: 11,
    fontWeight: '900',
    color: colors.green,
  },

  weeklyTitle: {
    marginTop: 5,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    color: colors.text,
  },

  weeklyDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },

  weeklyNote: {
    marginTop: 11,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.muted,
  },

  stageWrapper: {
    marginBottom: 3,
  },

  stageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  stageTitleArea: {
    flex: 1,
  },

  stageCode: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.green,
    letterSpacing: 0.7,
  },

  stagePhase: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },

  stageName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 3,
  },

  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 7,
  },

  percent: {
    fontSize: 23,
    fontWeight: '900',
    color: colors.green,
    marginLeft: 10,
  },

  bar: {
    height: 8,
    backgroundColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
  },

  fill: {
    height: '100%',
    backgroundColor: colors.green,
  },

  progressText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },

  statusComplete: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.green,
    marginTop: 10,
  },

  statusPending: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.amber,
    marginTop: 10,
  },

  statusProgress: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.blue,
    marginTop: 10,
  },

  statusOngoing: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.blue,
    marginTop: 10,
  },

  statusMuted: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    marginTop: 10,
  },

  requirementBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
  },

  requirementTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.5,
  },

  requirementText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    marginTop: 3,
  },

  requirementPending: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.amber,
    marginTop: 5,
  },

  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 14,
  },

  trackSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  trackItem: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 8,
    gap: 8,
  },

  trackPress: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  component: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.green,
  },

  trackTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },

  trackDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 3,
  },

  enrolled: {
    fontSize: 10,
    color: colors.muted,
  },

  notAvailable: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },

  arrow: {
    fontSize: 28,
    color: colors.muted,
    marginLeft: 10,
  },
  embedded: {
    gap: 10,
  },
});

export default function LearnScreen() {
  const { featureEnabled } = useRuntimeConfig();

  if (!featureEnabled('learning')) {
    return null;
  }

  return (
    <BuklodClusterMembershipGate title="Join a Cluster to use BUKLOD Lessons">
      <BuklodLearningContent variant="screen" />
    </BuklodClusterMembershipGate>
  );
}
