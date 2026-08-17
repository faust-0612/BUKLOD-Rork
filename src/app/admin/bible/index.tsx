/**
 * PATCH 153H-1B2
 * ADMIN BIBLE — AUTOMATIC PLAN VIEWER
 *
 * System-controlled Bible plan.
 * Admin/Pastor role: monitor and validate only.
 * No manual Scripture assignment editing.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';


type Assignment = {
  id: string;
  reading_date: string;
  bible_reference: string;
  instruction_fil: string | null;
  reward_amount: number | null;
  is_published: boolean;

  plan_source?: string | null;
  automatic_plan_week?: number | null;
  automatic_cycle_number?: number | null;
  automatic_chapters_today?: number | null;
};


type Submission = {
  assignment_id: string;
  status:
    | 'pending_admin'
    | 'approved'
    | 'rejected';
};


const iso = (d: Date) =>
  `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;


const fromIso = (
  value: string
) => {
  const [y, m, d] =
    value
      .split('-')
      .map(Number);

  return new Date(
    y,
    m - 1,
    d,
    12,
    0,
    0
  );
};


const addDays = (
  date: Date,
  amount: number
) => {
  const next =
    new Date(date);

  next.setDate(
    next.getDate() +
      amount
  );

  return next;
};


const monday = () => {
  const d =
    new Date();

  d.setHours(
    12,
    0,
    0,
    0
  );

  d.setDate(
    d.getDate() -
      (
        (
          d.getDay() +
          6
        ) %
        7
      )
  );

  return d;
};


export default function AdminBibleScreen() {
  const weekStart =
    useMemo(
      monday,
      []
    );


  const days =
    useMemo(
      () =>
        Array.from(
          {
            length: 7,
          },
          (
            _,
            index
          ) =>
            iso(
              addDays(
                weekStart,
                index
              )
            )
        ),
      [weekStart]
    );


  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [submissions, setSubmissions] =
    useState<Submission[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    automaticEngineAvailable,
    setAutomaticEngineAvailable,
  ] =
    useState(true);

  const [
    compatibilityMode,
    setCompatibilityMode,
  ] =
    useState(false);


  const load =
    useCallback(
      async () => {

        /*
         * PATCH_153H_1B2_ENSURE
         *
         * Materialize current automatic week
         * whenever this screen opens.
         *
         * Graceful fallback is retained because
         * migrations are intentionally not yet pushed.
         */

        let automaticAvailable =
          true;


        try {
          const ensureResult =
            await (supabase as any).rpc(
              'ensure_current_automatic_bible_week'
            );


          if (
            ensureResult?.error
          ) {
            const message =
              String(
                ensureResult.error
                  ?.message ??
                ''
              ).toLowerCase();


            if (
              message.includes(
                'function'
              ) ||
              message.includes(
                'schema cache'
              )
            ) {
              automaticAvailable =
                false;

            } else {
              console.warn(
                'Automatic Bible plan:',
                ensureResult.error
                  ?.message
              );
            }
          }

        } catch {
          automaticAvailable =
            false;
        }


        setAutomaticEngineAvailable(
          automaticAvailable
        );


        /*
         * First try the new automatic-plan columns.
         * If DB migrations are not deployed yet,
         * gracefully fall back to legacy columns.
         */

        let assignmentResult =
          await (supabase as any)
            .from(
              'daily_bible_assignments'
            )
            .select(
              [
                'id',
                'reading_date',
                'bible_reference',
                'instruction_fil',
                'reward_amount',
                'is_published',
                'plan_source',
                'automatic_plan_week',
                'automatic_cycle_number',
                'automatic_chapters_today',
              ].join(',')
            )
            .gte(
              'reading_date',
              days[0]
            )
            .lte(
              'reading_date',
              days[6]
            )
            .order(
              'reading_date'
            );


        if (
          assignmentResult.error
        ) {

          setCompatibilityMode(
            true
          );


          assignmentResult =
            await (supabase as any)
              .from(
                'daily_bible_assignments'
              )
              .select(
                [
                  'id',
                  'reading_date',
                  'bible_reference',
                  'instruction_fil',
                  'reward_amount',
                  'is_published',
                ].join(',')
              )
              .gte(
                'reading_date',
                days[0]
              )
              .lte(
                'reading_date',
                days[6]
              )
              .order(
                'reading_date'
              );

        } else {

          setCompatibilityMode(
            false
          );
        }


        if (
          assignmentResult.error
        ) {
          throw assignmentResult.error;
        }


        const weekAssignments =
          (
            assignmentResult.data ??
            []
          ) as Assignment[];


        setAssignments(
          weekAssignments
        );


        if (
          !weekAssignments.length
        ) {
          setSubmissions([]);
          return;
        }


        const submissionResult =
          await (supabase as any)
            .from(
              'daily_bible_submissions'
            )
            .select(
              'assignment_id,status'
            )
            .in(
              'assignment_id',
              weekAssignments.map(
                item =>
                  item.id
              )
            );


        if (
          submissionResult.error
        ) {
          throw submissionResult.error;
        }


        setSubmissions(
          (
            submissionResult.data ??
            []
          ) as Submission[]
        );
      },
      [days]
    );


  useEffect(() => {

    load()
      .catch(
        (e: any) =>
          Alert.alert(
            'Daily Bible Administration',
            e?.message ??
              'Unable to load the automatic Bible plan.'
          )
      )
      .finally(
        () =>
          setLoading(false)
      );

  }, [load]);


  const byDate =
    useMemo(
      () =>
        Object.fromEntries(
          assignments.map(
            item => [
              item.reading_date,
              item,
            ]
          )
        ) as Record<
          string,
          Assignment
        >,
      [assignments]
    );


  const approved =
    submissions.filter(
      item =>
        item.status ===
        'approved'
    ).length;


  const pending =
    submissions.filter(
      item =>
        item.status ===
        'pending_admin'
    ).length;


  const rejected =
    submissions.filter(
      item =>
        item.status ===
        'rejected'
    ).length;


  const statusForAssignment =
    (
      assignmentId: string
    ) => {

      const related =
        submissions.filter(
          item =>
            item.assignment_id ===
            assignmentId
        );


      return {
        approved:
          related.filter(
            item =>
              item.status ===
              'approved'
          ).length,

        pending:
          related.filter(
            item =>
              item.status ===
              'pending_admin'
          ).length,

        rejected:
          related.filter(
            item =>
              item.status ===
              'rejected'
          ).length,
      };
    };


  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={[
            shared.muted,
            {
              marginTop: 10,
            },
          ]}
        >
          Loading automatic Bible plan...
        </Text>
      </View>
    );
  }


  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[
        shared.content,
        styles.content,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={
            async () => {

              setRefreshing(
                true
              );

              try {
                await load();

              } catch (
                e: any
              ) {
                Alert.alert(
                  'Daily Bible',
                  e?.message ??
                    'Unable to refresh.'
                );

              } finally {
                setRefreshing(
                  false
                );
              }
            }
          }
        />
      }
    >

      {/* ===============================================
          HEADER
      ================================================ */}

      <View style={styles.header}>

        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>
            Daily Bible
          </Text>

          <Text style={shared.muted}>
            Automatic Plan Administration
          </Text>
        </View>


        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.outline}
        >
          <Text
            style={
              styles.outlineText
            }
          >
            BACK
          </Text>
        </Pressable>
      </View>


      {/* ===============================================
          SYSTEM CONTROLLED NOTICE
      ================================================ */}

      <Card>
        <Text style={styles.eyebrow}>
          SYSTEM CONTROLLED
        </Text>

        <Text style={styles.systemTitle}>
          Automatic Bible Reading Plan
        </Text>

        <Text style={styles.systemBody}>
          Scripture assignments are generated automatically and cannot be manually changed by an administrator.
        </Text>


        <View style={styles.ruleRow}>

          <View style={styles.ruleBox}>
            <Text style={styles.ruleValue}>
              2
            </Text>

            <Text style={styles.ruleLabel}>
              MON–FRI
            </Text>
          </View>


          <View style={styles.ruleBox}>
            <Text style={styles.ruleValue}>
              1
            </Text>

            <Text style={styles.ruleLabel}>
              SAT–SUN
            </Text>
          </View>


          <View style={styles.ruleBox}>
            <Text style={styles.ruleValue}>
              66
            </Text>

            <Text style={styles.ruleLabel}>
              BOOKS
            </Text>
          </View>

        </View>


        {!automaticEngineAvailable && (
          <Text style={styles.warning}>
            Automatic plan engine is not yet deployed to this database. Existing assignments are shown in compatibility mode.
          </Text>
        )}


        {compatibilityMode &&
          automaticEngineAvailable && (
            <Text style={styles.warning}>
              Automatic-plan metadata is not yet available in this database schema.
            </Text>
          )}
      </Card>


      {/* ===============================================
          VALIDATION SUMMARY
      ================================================ */}

      <SectionTitle>
        VALIDATION STATUS
      </SectionTitle>


      <View style={styles.statsRow}>

        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {pending}
          </Text>

          <Text style={styles.statLabel}>
            PENDING
          </Text>
        </View>


        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {approved}
          </Text>

          <Text style={styles.statLabel}>
            APPROVED
          </Text>
        </View>


        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {rejected}
          </Text>

          <Text style={styles.statLabel}>
            REVISION
          </Text>
        </View>

      </View>


      <Pressable
        onPress={() =>
          router.push(
            '/admin/bible/monitor'
          )
        }
        style={styles.monitorButton}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.monitorEyebrow}>
            ADMIN / PASTOR
          </Text>

          <Text style={styles.monitorTitle}>
            Monitor & Validate
          </Text>

          <Text style={styles.monitorBody}>
            Review member submissions, reflections, and validation status.
          </Text>
        </View>

        <Text style={styles.monitorArrow}>
          OPEN ›
        </Text>
      </Pressable>


      {/* ===============================================
          CURRENT WEEK
      ================================================ */}

      <SectionTitle>
        AUTOMATIC PLAN — THIS WEEK
      </SectionTitle>


      <Card>
        <Text style={styles.weekDate}>
          {fromIso(
            days[0]
          ).toLocaleDateString(
            undefined,
            {
              month: 'long',
              day: 'numeric',
            }
          )}
          {' – '}
          {fromIso(
            days[6]
          ).toLocaleDateString(
            undefined,
            {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }
          )}
        </Text>

        <Text style={styles.weekHelp}>
          The plan advances canonically from Genesis through Revelation and repeats only after the complete Bible cycle.
        </Text>
      </Card>


      {days.map(
        (
          date,
          index
        ) => {

          const assignment =
            byDate[date];


          const dateObject =
            fromIso(date);


          const weekday =
            dateObject.toLocaleDateString(
              undefined,
              {
                weekday:
                  'long',
              }
            );


          const expectedChapters =
            (
              dateObject.getDay() === 0 ||
              dateObject.getDay() === 6
            )
              ? 1
              : 2;


          const status =
            assignment
              ? statusForAssignment(
                  assignment.id
                )
              : {
                  approved: 0,
                  pending: 0,
                  rejected: 0,
                };


          return (
            <Card key={date}>

              <View style={styles.dayHeader}>

                <View style={styles.dayNumber}>
                  <Text style={styles.dayNumberText}>
                    {index + 1}
                  </Text>
                </View>


                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>
                    {weekday}
                  </Text>

                  <Text style={styles.dayDate}>
                    {dateObject.toLocaleDateString(
                      undefined,
                      {
                        month:
                          'short',
                        day:
                          'numeric',
                        year:
                          'numeric',
                      }
                    )}
                  </Text>
                </View>


                <View style={styles.chapterBadge}>
                  <Text style={styles.chapterBadgeText}>
                    {
                      assignment
                        ?.automatic_chapters_today ??
                      expectedChapters
                    }{' '}
                    CH
                  </Text>
                </View>

              </View>


              {assignment ? (
                <>
                  <Text style={styles.reference}>
                    {
                      assignment.bible_reference
                    }
                  </Text>


                  <View style={styles.metaRow}>

                    <Text style={styles.metaText}>
                      {
                        assignment.plan_source ===
                        'automatic'
                          ? 'AUTOMATIC'
                          : automaticEngineAvailable &&
                            !compatibilityMode
                          ? 'SYSTEM PLAN'
                          : 'EXISTING'
                      }
                    </Text>


                    {assignment
                      .automatic_cycle_number !=
                      null && (
                      <Text style={styles.metaText}>
                        Cycle{' '}
                        {
                          assignment.automatic_cycle_number
                        }
                      </Text>
                    )}


                    {assignment
                      .reward_amount !=
                      null && (
                      <Text style={styles.metaText}>
                        +
                        {
                          assignment.reward_amount
                        }{' '}
                        pts
                      </Text>
                    )}
                  </View>


                  <View style={styles.submissionRow}>

                    <StatusChip
                      label="PENDING"
                      value={
                        status.pending
                      }
                    />

                    <StatusChip
                      label="VALID"
                      value={
                        status.approved
                      }
                    />

                    <StatusChip
                      label="REVISE"
                      value={
                        status.rejected
                      }
                    />

                  </View>
                </>

              ) : (
                <>
                  <Text style={styles.noPlan}>
                    Automatic reading not materialized yet.
                  </Text>

                  <Text style={styles.noPlanHelp}>
                    This date will be generated by the system automatically when the automatic Bible engine is deployed and active.
                  </Text>
                </>
              )}

            </Card>
          );
        }
      )}


      {/* ===============================================
          ADMIN POLICY
      ================================================ */}

      <Card>
        <Text style={styles.policyTitle}>
          Administrator Role
        </Text>

        <Text style={styles.policyText}>
          Administrators and authorized Pastors monitor participation and validate submitted reflections. They do not select, replace, reorder, publish, or unpublish Daily Bible passages.
        </Text>
      </Card>

    </ScrollView>
  );
}


function StatusChip(
  props: {
    label: string;
    value: number;
  }
) {
  return (
    <View style={styles.statusChip}>
      <Text style={styles.statusValue}>
        {props.value}
      </Text>

      <Text style={styles.statusLabel}>
        {props.label}
      </Text>
    </View>
  );
}


const styles =
  StyleSheet.create({

    content: {
      paddingBottom: 50,
      gap: 14,
    },


    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },


    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems:
        'flex-start',
    },


    outline: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor:
        '#D7DFDA',
      borderRadius: 12,
    },


    outlineText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#275D45',
    },


    eyebrow: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: .8,
      color: '#6C7B73',
    },


    systemTitle: {
      marginTop: 5,
      fontSize: 21,
      fontWeight: '900',
      color: '#20372B',
    },


    systemBody: {
      marginTop: 7,
      fontSize: 12,
      lineHeight: 19,
      color: '#65736B',
    },


    ruleRow: {
      marginTop: 15,
      flexDirection: 'row',
      gap: 8,
    },


    ruleBox: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 13,
      backgroundColor:
        '#F0F5F2',
    },


    ruleValue: {
      fontSize: 21,
      fontWeight: '900',
      color: '#275D45',
    },


    ruleLabel: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '900',
      color: '#748179',
    },


    warning: {
      marginTop: 13,
      padding: 10,
      borderRadius: 11,
      backgroundColor:
        '#F8F2E4',
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '700',
      color: '#7C652A',
    },


    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },


    stat: {
      flex: 1,
      minHeight: 82,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 10,
      borderWidth: 1,
      borderColor:
        '#DDE5E0',
      borderRadius: 15,
      backgroundColor:
        '#FFF',
    },


    statValue: {
      fontSize: 24,
      fontWeight: '900',
      color: '#275D45',
    },


    statLabel: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '900',
      color: '#7B8880',
    },


    monitorButton: {
      minHeight: 92,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 17,
      backgroundColor:
        '#275D45',
    },


    monitorEyebrow: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: .6,
      color: '#BED4C8',
    },


    monitorTitle: {
      marginTop: 3,
      fontSize: 17,
      fontWeight: '900',
      color: '#FFF',
    },


    monitorBody: {
      marginTop: 3,
      fontSize: 10,
      lineHeight: 15,
      color: '#D8E5DE',
    },


    monitorArrow: {
      fontSize: 10,
      fontWeight: '900',
      color: '#FFF',
    },


    weekDate: {
      fontSize: 18,
      fontWeight: '900',
      color: '#263F32',
    },


    weekHelp: {
      marginTop: 6,
      fontSize: 10.5,
      lineHeight: 17,
      color: '#748078',
    },


    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },


    dayNumber: {
      width: 35,
      height: 35,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EEF4F0',
    },


    dayNumberText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#275D45',
    },


    dayName: {
      fontSize: 13,
      fontWeight: '900',
      color: '#314A3D',
    },


    dayDate: {
      marginTop: 2,
      fontSize: 9.5,
      color: '#829087',
    },


    chapterBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor:
        '#E9F3ED',
    },


    chapterBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: '#275D45',
    },


    reference: {
      marginTop: 14,
      fontSize: 21,
      lineHeight: 28,
      fontWeight: '900',
      color: '#20372B',
    },


    metaRow: {
      marginTop: 9,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },


    metaText: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor:
        '#F0F3F1',
      fontSize: 8,
      fontWeight: '800',
      color: '#66746C',
    },


    submissionRow: {
      marginTop: 13,
      flexDirection: 'row',
      gap: 7,
    },


    statusChip: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        '#E0E6E2',
    },


    statusValue: {
      fontSize: 15,
      fontWeight: '900',
      color: '#365745',
    },


    statusLabel: {
      marginTop: 1,
      fontSize: 7,
      fontWeight: '900',
      color: '#7B8880',
    },


    noPlan: {
      marginTop: 13,
      fontSize: 14,
      fontWeight: '800',
      color: '#6B776F',
    },


    noPlanHelp: {
      marginTop: 5,
      fontSize: 10,
      lineHeight: 16,
      color: '#859088',
    },


    policyTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#334C3E',
    },


    policyText: {
      marginTop: 6,
      fontSize: 10.5,
      lineHeight: 17,
      color: '#748078',
    },
  });