import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { supabase } from '@/lib/supabase';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type MemberMaster = {
  user_id: string;
  full_name: string | null;
  mobile: string | null;
  birth_date: string | null;
  sex: string | null;
  avatar_url: string | null;

  church_id: string | null;
  church_name: string | null;

  legacy_role: string | null;
  active_roles: string | null;

  is_active: boolean;
  is_verified: boolean;
  created_at: string;

  mentor_id: string | null;
  mentor_name: string | null;

  buklod_groups: string | null;

  devotional_series_id: string | null;
  devotional_series_title: string | null;
  devotional_starts_on: string | null;
};

type MentorCandidate = {
  mentor_id: string;
  mentor_name: string;
  church_id: string;
  church_name: string | null;
};

type DevotionalSeries = {
  series_id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

type MemberGroup = {
  group_id: string;
  group_name: string;
  church_id: string;
  is_member: boolean;
};

export default function MemberManagementMasterScreen() {
  const { id } =
    useLocalSearchParams<{ id?: string }>();

  const { hasAnyRole, hasRole } = useAuth();

  const allowed = hasAnyRole([
    'pastor',
    'local_admin',
    'system_admin',
  ]);

  const isSystemAdmin =
    hasRole('system_admin');

  const db = supabase as any;

  const [loading, setLoading] =
    useState(true);

  const [busyAction, setBusyAction] =
    useState<string | null>(null);

  const [member, setMember] =
    useState<MemberMaster | null>(null);

  const [mentors, setMentors] =
    useState<MentorCandidate[]>([]);

  const [series, setSeries] =
    useState<DevotionalSeries[]>([]);

  const [groups, setGroups] =
    useState<MemberGroup[]>([]);

  const [awardPoints, setAwardPoints] =
    useState('');

  const [awardReason, setAwardReason] =
    useState('');


  const awardBuklodPoints = () => {
    if (
      !isSystemAdmin ||
      !member ||
      busyAction === 'award-points'
    ) {
      return;
    }

    const points =
      Number.parseInt(
        awardPoints.trim(),
        10
      );

    const reason =
      awardReason.trim();

    if (
      !Number.isFinite(points) ||
      points <= 0
    ) {
      return Alert.alert(
        'BUKLOD Points',
        'Enter a valid points amount greater than zero.'
      );
    }

    if (!reason) {
      return Alert.alert(
        'Reason required',
        'Please provide the reason for this BUKLOD Points award.'
      );
    }

    const memberName =
      member.full_name ||
      'this member';

    Alert.alert(
      'Confirm BUKLOD Points Award',
      `Award ${points.toLocaleString()} BUKLOD Points to ${memberName}?\n\nReason: ${reason}\n\nThis will affect the member's BUKLOD Points total, leaderboard and Circle Rank.`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'AWARD POINTS',
          onPress: () => {
            void (async () => {
              setBusyAction(
                'award-points'
              );

              try {
                const {
                  error,
                } = await db.rpc(
                  'admin_award_buklod_points_v1',
                  {
                    p_user_id:
                      member.user_id,

                    p_points:
                      points,

                    p_reason:
                      reason,
                  }
                );

                if (error) {
                  throw error;
                }

                setAwardPoints('');
                setAwardReason('');

                Alert.alert(
                  'BUKLOD Points Awarded',
                  `${points.toLocaleString()} BUKLOD Points were awarded to ${memberName}.`
                );
              } catch (error: any) {
                Alert.alert(
                  'Award failed',
                  error?.message ??
                    'Could not award BUKLOD Points.'
                );
              } finally {
                setBusyAction(null);
              }
            })();
          },
        },
      ]
    );
  };


  const load = useCallback(async () => {
    if (!allowed || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        masterResult,
        mentorResult,
        seriesResult,
        groupResult,
      ] = await Promise.all([
        db.rpc(
          'get_manageable_member_master_v3',
          {
            p_user_id: id,
          }
        ),

        db.rpc(
          'get_manageable_mentor_candidates',
          {
            p_user_id: id,
          }
        ),

        db.rpc(
          'get_manageable_devotional_series'
        ),

        db.rpc(
          'get_manageable_member_groups',
          {
            p_user_id: id,
          }
        ),
      ]);

      if (masterResult.error) {
        throw masterResult.error;
      }

      if (mentorResult.error) {
        throw mentorResult.error;
      }

      if (seriesResult.error) {
        throw seriesResult.error;
      }

      if (groupResult.error) {
        throw groupResult.error;
      }

      const first =
        Array.isArray(masterResult.data)
          ? masterResult.data[0]
          : masterResult.data;

      setMember(first ?? null);

      setMentors(
        mentorResult.data ?? []
      );

      setSeries(
        seriesResult.data ?? []
      );

      setGroups(
        groupResult.data ?? []
      );
    } catch (error: any) {
      Alert.alert(
        'Member Master Record',
        error?.message ||
          'Could not load member record.'
      );
    } finally {
      setLoading(false);
    }
  }, [allowed, db, id]);

  useEffect(() => {
    load();
  }, [load]);

  const assignMentor = async (
    mentor: MentorCandidate
  ) => {
    if (!member) return;

    Alert.alert(
      'Change Mentor?',
      `${mentor.mentor_name} will become the active mentor of ${member.full_name || 'this member'}.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Assign Mentor',
          onPress: async () => {
            setBusyAction(
              `mentor:${mentor.mentor_id}`
            );

            try {
              const { error } =
                await db.rpc(
                  'manage_assign_mentor',
                  {
                    p_disciple_id:
                      member.user_id,
                    p_mentor_id:
                      mentor.mentor_id,
                  }
                );

              if (error) throw error;

              Alert.alert(
                'Mentor Assigned',
                `${mentor.mentor_name} is now the active mentor.`
              );

              await load();
            } catch (error: any) {
              Alert.alert(
                'Could not assign mentor',
                error?.message ||
                  'Please try again.'
              );
            } finally {
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const removeMentor = () => {
    if (!member?.mentor_id) return;

    Alert.alert(
      'Remove Mentor?',
      `${member.mentor_name || 'The current mentor'} will be removed from this member.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyAction(
              'remove-mentor'
            );

            try {
              const { error } =
                await db.rpc(
                  'manage_remove_mentor',
                  {
                    p_disciple_id:
                      member.user_id,
                  }
                );

              if (error) throw error;

              Alert.alert(
                'Mentor Removed',
                'The member no longer has an active mentor.'
              );

              await load();
            } catch (error: any) {
              Alert.alert(
                'Could not remove mentor',
                error?.message ||
                  'Please try again.'
              );
            } finally {
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const assignSeries = (
    item: DevotionalSeries
  ) => {
    if (!member) return;

    const replacing =
      !!member.devotional_series_id;

    Alert.alert(
      replacing
        ? 'Change Devotional Series?'
        : 'Assign Devotional Series?',
      `${item.title} will become the active devotional series of ${member.full_name || 'this member'}.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: replacing
            ? 'Change Series'
            : 'Assign Series',

          onPress: async () => {
            setBusyAction(
              `series:${item.series_id}`
            );

            try {
              const { error } =
                await db.rpc(
                  'manage_assign_devotional_series',
                  {
                    p_user_id:
                      member.user_id,

                    p_series_id:
                      item.series_id,

                    p_starts_on:
                      new Date()
                        .toISOString()
                        .slice(0, 10),

                    p_note:
                      'Assigned from Member Master Record',
                  }
                );

              if (error) throw error;

              Alert.alert(
                'Devotional Series Assigned',
                `${item.title} is now active for this member.`
              );

              await load();
            } catch (error: any) {
              Alert.alert(
                'Could not assign series',
                error?.message ||
                  'Please try again.'
              );
            } finally {
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const removeSeries = () => {
    if (!member?.devotional_series_id) {
      return;
    }

    Alert.alert(
      'Remove Devotional Series?',
      `${member.devotional_series_title || 'The current series'} will be removed from this member.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyAction(
              'remove-series'
            );

            try {
              const { error } =
                await db.rpc(
                  'manage_remove_devotional_series',
                  {
                    p_user_id:
                      member.user_id,
                  }
                );

              if (error) throw error;

              Alert.alert(
                'Series Removed',
                'The member no longer has an active devotional series.'
              );

              await load();
            } catch (error: any) {
              Alert.alert(
                'Could not remove series',
                error?.message ||
                  'Please try again.'
              );
            } finally {
              setBusyAction(null);
            }
          },
        },
      ]
    );
  };

  const toggleGroup = async (
    item: MemberGroup
  ) => {
    if (!member) return;

    const makeActive =
      !item.is_member;

    setBusyAction(
      `group:${item.group_id}`
    );

    try {
      const { error } =
        await db.rpc(
          'manage_set_group_membership',
          {
            p_user_id:
              member.user_id,

            p_group_id:
              item.group_id,

            p_active:
              makeActive,
          }
        );

      if (error) throw error;

      Alert.alert(
        makeActive
          ? 'Added to BUKLOD Cluster'
          : 'Removed from BUKLOD Cluster',

        makeActive
          ? `${member.full_name || 'Member'} was added to ${item.group_name}.`
          : `${member.full_name || 'Member'} was removed from ${item.group_name}.`
      );

      await load();
    } catch (error: any) {
      Alert.alert(
        'Group update failed',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  if (!allowed) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <Card>
          <Text style={shared.h1}>
            Member Master Record
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            Pastor or Admin access is
            required.
          </Text>
        </Card>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <ActivityIndicator
          color={colors.green}
        />
      </View>
    );
  }

  if (!member) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <Card>
          <Text style={shared.h2}>
            Member record unavailable
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 6,
              },
            ]}
          >
            The member may be outside
            your authorized Local
            assignment.
          </Text>

          <View
            style={{
              marginTop: 14,
            }}
          >
            <Button
              title="BACK"
              outline
              onPress={() =>
                router.back()
              }
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>
        MEMBER MASTER RECORD
      </Text>

      <Text style={shared.h1}>
        {member.full_name ||
          'Unnamed Member'}
      </Text>

      <Text
        style={[
          styles.local,
          {
            marginTop: 4,
          },
        ]}
      >
        {member.church_name ||
          'No Local assigned'}
      </Text>

      <View
        style={{
          marginTop: 12,
        }}
      >
        <StatusPill
          active={
            member.is_active
          }
          text={
            member.is_active
              ? 'ACTIVE MEMBER'
              : 'INACTIVE MEMBER'
          }
        />
      </View>

      <SectionTitle>
        MEMBER INFORMATION
      </SectionTitle>

      <Card>
        <Field
          label="FULL NAME"
          value={member.full_name}
        />

        <Divider />

        <Field
          label="MEMBER ID"
          value={member.user_id}
        />

        <Divider />

        <Field
          label="LOCAL"
          value={
            member.church_name ||
            'Not assigned'
          }
        />

        <Divider />

        <Field
          label="MOBILE"
          value={
            member.mobile ||
            'Not provided'
          }
        />

        <Divider />

        <Field
          label="BIRTH DATE"
          value={
            member.birth_date ||
            'Not provided'
          }
        />

        <Divider />

        <Field
          label="SEX"
          value={
            member.sex ||
            'Not provided'
          }
        />
      </Card>

      <SectionTitle>
        ACCOUNT & MEMBERSHIP
      </SectionTitle>

      <Card>
        <Field
          label="ACCOUNT STATUS"
          value={
            member.is_active
              ? 'Active'
              : 'Inactive'
          }
        />

        <Divider />

        <Field
          label="APPROVAL STATUS"
          value={
            member.is_verified
              ? 'Approved / Verified'
              : 'Pending / Unverified'
          }
        />

        <Divider />

        <Field
          label="ACTIVE ROLES"
          value={
            member.active_roles ||
            member.legacy_role ||
            'Member'
          }
        />

        <Divider />

        <Field
          label="MEMBER SINCE"
          value={
            member.created_at
              ? new Date(
                  member.created_at
                ).toLocaleDateString()
              : '-'
          }
        />
      </Card>

      {isSystemAdmin && (
        <>
          <SectionTitle>
            AWARD BUKLOD POINTS
          </SectionTitle>

          <Card>
            <Text
              style={styles.awardHelp}
            >
              Reward this member with additional BUKLOD Points.
              This is separate from BUKLOD Bayanihan and will
              count toward the member's Points total,
              leaderboard position and Circle Rank.
            </Text>

            <TextInput
              value={awardPoints}
              onChangeText={(value) =>
                setAwardPoints(
                  value.replace(
                    /[^0-9]/g,
                    ''
                  )
                )
              }
              placeholder="Points amount"
              keyboardType="number-pad"
              editable={
                busyAction !==
                'award-points'
              }
              style={styles.awardInput}
            />

            <TextInput
              value={awardReason}
              onChangeText={
                setAwardReason
              }
              placeholder="Reason for award"
              multiline
              textAlignVertical="top"
              editable={
                busyAction !==
                'award-points'
              }
              style={[
                styles.awardInput,
                styles.awardReason,
              ]}
            />

            <Text
              style={
                styles.awardWarning
              }
            >
              System Admin action. A reason is required and
              every award is recorded in the Points ledger
              and audit trail.
            </Text>

            <View
              style={{
                marginTop: 12,
              }}
            >
              <Button
                title={
                  busyAction ===
                  'award-points'
                    ? 'AWARDING POINTS...'
                    : 'AWARD BUKLOD POINTS'
                }
                onPress={
                  awardBuklodPoints
                }
              />
            </View>
          </Card>
        </>
      )}

      <SectionTitle>
        CURRENT ASSIGNMENTS
      </SectionTitle>

      <Card>
        <Field
          label="MENTOR"
          value={
            member.mentor_name ||
            'No active mentor'
          }
        />

        <Divider />

        <Field
          label="DEVOTIONAL SERIES"
          value={
            member
              .devotional_series_title ||
            'No active devotional series'
          }
        />

        {!!member.devotional_starts_on && (
          <>
            <Divider />

            <Field
              label="DEVOTIONAL START DATE"
              value={
                member.devotional_starts_on
              }
            />
          </>
        )}

        <Divider />

        <Field
          label="BUKLOD GROUP"
          value={
            member.buklod_groups ||
            'No active BUKLOD Cluster'
          }
        />
      </Card>

      <SectionTitle>
        MANAGE MENTOR
      </SectionTitle>

      <Card>
        <Text style={styles.currentLabel}>
          CURRENT MENTOR
        </Text>

        <Text style={shared.h2}>
          {member.mentor_name ||
            'No active mentor'}
        </Text>

        <Text
          style={[
            shared.muted,
            {
              marginTop: 5,
            },
          ]}
        >
          Select an eligible member of
          the same Local to assign or
          change the mentor.
        </Text>

        <View style={styles.choices}>
          {mentors.map(
            (mentor) => {
              const selected =
                mentor.mentor_id ===
                member.mentor_id;

              return (
                <Pressable
                  key={
                    mentor.mentor_id
                  }
                  disabled={
                    busyAction !== null
                  }
                  onPress={() =>
                    assignMentor(
                      mentor
                    )
                  }
                  style={[
                    styles.choice,
                    selected &&
                      styles.choiceOn,
                  ]}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.choiceTitle
                      }
                    >
                      {
                        mentor.mentor_name
                      }
                    </Text>

                    <Text
                      style={
                        shared.muted
                      }
                    >
                      {mentor.church_name ||
                        member.church_name ||
                        'Local Church'}
                    </Text>
                  </View>

                  {selected && (
                    <Text
                      style={
                        styles.selected
                      }
                    >
                      CURRENT
                    </Text>
                  )}
                </Pressable>
              );
            }
          )}
        </View>

        {mentors.length === 0 && (
          <Text
            style={[
              shared.muted,
              {
                marginTop: 12,
              },
            ]}
          >
            No eligible mentor
            candidates found in this
            Local.
          </Text>
        )}

        {!!member.mentor_id && (
          <View
            style={{
              marginTop: 12,
            }}
          >
            <Button
              title={
                busyAction ===
                'remove-mentor'
                  ? 'REMOVING...'
                  : 'REMOVE CURRENT MENTOR'
              }
              outline
              onPress={
                removeMentor
              }
            />
          </View>
        )}
      </Card>

      <SectionTitle>
        MANAGE DEVOTIONAL SERIES
      </SectionTitle>

      <Card>
        <Text style={styles.currentLabel}>
          CURRENT SERIES
        </Text>

        <Text style={shared.h2}>
          {member
            .devotional_series_title ||
            'No active series'}
        </Text>

        <Text
          style={[
            shared.muted,
            {
              marginTop: 5,
            },
          ]}
        >
          Selecting another published
          series automatically replaces
          the current active assignment.
        </Text>

        <View style={styles.choices}>
          {series.map(
            (item) => {
              const selected =
                item.series_id ===
                member
                  .devotional_series_id;

              return (
                <Pressable
                  key={
                    item.series_id
                  }
                  disabled={
                    busyAction !== null
                  }
                  onPress={() =>
                    assignSeries(item)
                  }
                  style={[
                    styles.choice,
                    selected &&
                      styles.choiceOn,
                  ]}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.choiceTitle
                      }
                    >
                      {item.title}
                    </Text>

                    {!!item.description && (
                      <Text
                        style={[
                          shared.muted,
                          {
                            marginTop: 2,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {
                          item.description
                        }
                      </Text>
                    )}
                  </View>

                  {selected && (
                    <Text
                      style={
                        styles.selected
                      }
                    >
                      CURRENT
                    </Text>
                  )}
                </Pressable>
              );
            }
          )}
        </View>

        {series.length === 0 && (
          <Text
            style={[
              shared.muted,
              {
                marginTop: 12,
              },
            ]}
          >
            No published Devotional
            Series are available.
          </Text>
        )}

        {!!member
          .devotional_series_id && (
          <View
            style={{
              marginTop: 12,
            }}
          >
            <Button
              title={
                busyAction ===
                'remove-series'
                  ? 'REMOVING...'
                  : 'REMOVE CURRENT SERIES'
              }
              outline
              onPress={
                removeSeries
              }
            />
          </View>
        )}
      </Card>

      <SectionTitle>
        MANAGE BUKLOD GROUP
      </SectionTitle>

      <Card>
        <Text style={shared.h2}>
          Local BUKLOD Clusters
        </Text>

        <Text
          style={[
            shared.muted,
            {
              marginTop: 5,
            },
          ]}
        >
          Tap a group to add or remove
          this member. Only groups from
          the member's Local are shown.
        </Text>

        <View style={styles.choices}>
          {groups.map(
            (group) => (
              <Pressable
                key={group.group_id}
                disabled={
                  busyAction !== null
                }
                onPress={() =>
                  toggleGroup(group)
                }
                style={[
                  styles.choice,
                  group.is_member &&
                    styles.choiceOn,
                ]}
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.choiceTitle
                    }
                  >
                    {group.group_name}
                  </Text>

                  <Text
                    style={
                      shared.muted
                    }
                  >
                    {group.is_member
                      ? 'Member currently belongs to this cluster'
                      : 'Tap to add member'}
                  </Text>
                </View>

                <Text
                  style={
                    group.is_member
                      ? styles.selected
                      : styles.addText
                  }
                >
                  {group.is_member
                    ? 'MEMBER'
                    : 'ADD'}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {groups.length === 0 && (
          <Text
            style={[
              shared.muted,
              {
                marginTop: 12,
              },
            ]}
          >
            No active BUKLOD Clusters
            exist in this member's
            Local.
          </Text>
        )}
      </Card>

      <View
        style={{
          marginTop: 20,
        }}
      >
        <Button
          title="BACK TO MEMBER LIST"
          outline
          onPress={() =>
            router.replace(
              '/admin/local-members' as any
            )
          }
        />
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text
        style={styles.fieldLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.fieldValue}
      >
        {value || '-'}
      </Text>
    </View>
  );
}

function Divider() {
  return (
    <View style={styles.divider} />
  );
}

function StatusPill({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
  return (
    <View
      style={[
        styles.status,
        !active &&
          styles.statusInactive,
      ]}
    >
      <Text
        style={styles.statusText}
      >
        {text}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    content: {
      padding: 18,
      paddingBottom: 50,
    },

    center: {
      justifyContent: 'center',
      padding: 20,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color: colors.greenDark,
      marginBottom: 4,
    },

    local: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.greenDark,
    },

    status: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor:
        colors.greenSoft,
    },

    statusInactive: {
      backgroundColor:
        '#EEEEEE',
    },

    statusText: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.text,
    },

    field: {
      paddingVertical: 5,
    },

    fieldLabel: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.muted,
      marginBottom: 3,
    },

    fieldValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },

    divider: {
      height: 1,
      backgroundColor:
        colors.line,
      marginVertical: 9,
    },

    currentLabel: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.greenDark,
      marginBottom: 4,
    },

    choices: {
      gap: 8,
      marginTop: 14,
    },

    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 13,
      backgroundColor:
        colors.white,
    },

    choiceOn: {
      borderColor:
        colors.green,
      backgroundColor:
        colors.greenSoft,
    },

    choiceTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },

    selected: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.greenDark,
    },

    addText: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.muted,
    },

    awardHelp: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.text,
      marginBottom: 12,
    },

    awardInput: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: colors.white,
      color: colors.text,
      marginBottom: 10,
    },

    awardReason: {
      minHeight: 82,
    },

    awardWarning: {
      fontSize: 10,
      lineHeight: 16,
      fontWeight: '700',
      color: '#8A5A00',
    },
  });