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
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';


type GroupRow = {
  id: string;
  church_id: string;
  church_name: string;
  name: string;
  code: string | null;
  description: string | null;
  leader_id: string | null;
  leader_name: string | null;
  is_active: boolean;
  member_count: number;
  created_at: string;
};


type LeaderRow = {
  user_id: string;
  full_name: string | null;
  church_id: string;
};


type MemberRow = {
  user_id: string;
  full_name: string | null;
  church_id: string;

  target_group_id: string;
  is_target_member: boolean;
  target_joined_at: string | null;

  is_group_leader: boolean;

  current_group_id: string | null;
  current_group_name: string | null;
};


export default function GroupDetailScreen() {
  /* PATCH_153B_5B2 */

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const groupId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;


  const {
    hasAnyRole,
    hasRole,
  } = useAuth();


  const allowed =
    hasAnyRole([
      'pastor',
      'local_admin',
      'system_admin',
    ]);


  const systemAdmin =
    hasRole('system_admin');


  const db = supabase as any;


  const [group, setGroup] =
    useState<GroupRow | null>(
      null
    );


  const [leaders, setLeaders] =
    useState<LeaderRow[]>([]);


  const [members, setMembers] =
    useState<MemberRow[]>([]);


  const [loading, setLoading] =
    useState(true);


  const [refreshing, setRefreshing] =
    useState(false);


  const [
    deploymentReady,
    setDeploymentReady,
  ] = useState(true);


  const [busy, setBusy] =
    useState(false);


  const [
    busyUserId,
    setBusyUserId,
  ] = useState<string | null>(
    null
  );


  const [search, setSearch] =
    useState('');


  const [editName, setEditName] =
    useState('');


  const [editCode, setEditCode] =
    useState('');


  const [
    editDescription,
    setEditDescription,
  ] = useState('');


  const [
    selectedLeaderId,
    setSelectedLeaderId,
  ] = useState('');


  const applyGroupToEditor =
    useCallback(
      (
        row: GroupRow
      ) => {
        setEditName(
          row.name ?? ''
        );

        setEditCode(
          row.code ?? ''
        );

        setEditDescription(
          row.description ?? ''
        );

        setSelectedLeaderId(
          row.leader_id ?? ''
        );
      },
      []
    );


  const load = useCallback(
    async () => {
      if (
        !allowed ||
        !groupId
      ) {
        setLoading(false);
        return;
      }


      setLoading(true);


      try {
        const groupResult =
          await db.rpc(
            'get_manageable_buklod_groups'
          );


        if (groupResult.error) {
          const message =
            String(
              groupResult.error
                ?.message ?? ''
            );


          const missingRpc =
            message.includes(
              'get_manageable_buklod_groups'
            ) ||
            message
              .toLowerCase()
              .includes(
                'schema cache'
              );


          if (
            missingRpc &&
            systemAdmin
          ) {
            setDeploymentReady(
              false
            );


            const fallback =
              await db
                .from(
                  'buklod_groups'
                )
                .select(
                  'id,name,code,description,church_id,leader_id,is_active,created_at,church:church_id(name),leader:leader_id(full_name)'
                )
                .eq(
                  'id',
                  groupId
                )
                .single();


            if (fallback.error) {
              throw fallback.error;
            }


            const raw =
              fallback.data;


            const church =
              Array.isArray(
                raw?.church
              )
                ? raw.church[0]
                : raw?.church;


            const leader =
              Array.isArray(
                raw?.leader
              )
                ? raw.leader[0]
                : raw?.leader;


            const fallbackGroup:
              GroupRow = {
                id:
                  raw.id,

                church_id:
                  raw.church_id,

                church_name:
                  church?.name ??
                  'Local Church',

                name:
                  raw.name,

                code:
                  raw.code ??
                  null,

                description:
                  raw.description ??
                  null,

                leader_id:
                  raw.leader_id ??
                  null,

                leader_name:
                  leader?.full_name ??
                  null,

                is_active:
                  raw.is_active !==
                  false,

                member_count: 0,

                created_at:
                  raw.created_at,
              };


            setGroup(
              fallbackGroup
            );

            applyGroupToEditor(
              fallbackGroup
            );

            setLeaders([]);
            setMembers([]);

            return;
          }


          if (missingRpc) {
            setDeploymentReady(
              false
            );

            setGroup(null);
            setLeaders([]);
            setMembers([]);

            return;
          }


          throw groupResult.error;
        }


        setDeploymentReady(true);


        const manageableGroups =
          (
            groupResult.data ??
            []
          ) as GroupRow[];


        const target =
          manageableGroups.find(
            (item) =>
              item.id ===
              groupId
          ) ?? null;


        if (!target) {
          setGroup(null);
          setLeaders([]);
          setMembers([]);

          return;
        }


        setGroup(target);

        applyGroupToEditor(
          target
        );


        const [
          leaderResult,
          memberResult,
        ] = await Promise.all([
          db.rpc(
            'get_manageable_buklod_group_leaders',
            {
              p_church_id:
                target.church_id,
            }
          ),

          db.rpc(
            'get_manageable_buklod_group_members_v2',
            {
              p_group_id:
                target.id,

              p_search:
                null,
            }
          ),
        ]);


        if (leaderResult.error) {
          throw leaderResult.error;
        }


        if (memberResult.error) {
          throw memberResult.error;
        }


        setLeaders(
          (leaderResult.data ??
            []) as LeaderRow[]
        );


        setMembers(
          (memberResult.data ??
            []) as MemberRow[]
        );

      } catch (error: any) {
        Alert.alert(
          'BUKLOD Cluster',
          error?.message ||
            'Could not load this BUKLOD Cluster.'
        );

      } finally {
        setLoading(false);
      }
    },
    [
      allowed,
      applyGroupToEditor,
      db,
      groupId,
      systemAdmin,
    ]
  );


  useEffect(() => {
    void load();
  }, [load]);


  const reloadMembers =
    useCallback(
      async () => {
        if (
          !groupId ||
          !deploymentReady
        ) {
          return;
        }


        const result =
          await db.rpc(
            'get_manageable_buklod_group_members_v2',
            {
              p_group_id:
                groupId,

              p_search:
                null,
            }
          );


        if (result.error) {
          Alert.alert(
            'BUKLOD Members',
            result.error.message
          );

          return;
        }


        setMembers(
          (result.data ??
            []) as MemberRow[]
        );
      },
      [
        db,
        deploymentReady,
        groupId,
      ]
    );


  const currentMembers =
    useMemo(
      () =>
        members.filter(
          (item) =>
            item.is_target_member
        ),
      [members]
    );


  const candidateMembers =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();


      return members
        .filter(
          (item) =>
            !item.is_target_member
        )
        .filter((item) => {
          if (!q) {
            return true;
          }


          return [
            item.full_name,
            item.current_group_name,
          ].some(
            (value) =>
              String(
                value ?? ''
              )
                .toLowerCase()
                .includes(q)
          );
        });
    }, [
      members,
      search,
    ]);


  const saveDetails =
    async () => {
      if (
        !group ||
        !deploymentReady
      ) {
        return;
      }


      if (!editName.trim()) {
        Alert.alert(
          'BUKLOD Cluster',
          'Group name is required.'
        );

        return;
      }


      setBusy(true);


      const result =
        await db.rpc(
          'manage_update_buklod_group',
          {
            p_group_id:
              group.id,

            p_name:
              editName.trim(),

            p_code:
              editCode.trim() ||
              null,

            p_description:
              editDescription
                .trim() ||
              null,
          }
        );


      setBusy(false);


      if (result.error) {
        Alert.alert(
          'Update failed',
          result.error.message
        );

        return;
      }


      Alert.alert(
        'BUKLOD Cluster',
        'Group details updated.'
      );


      await load();
    };


  const saveLeader =
    async (
      newLeaderId:
        string | null
    ) => {
      if (
        !group ||
        !deploymentReady
      ) {
        return;
      }


      setBusy(true);


      const result =
        await db.rpc(
          'manage_set_buklod_group_leader',
          {
            p_group_id:
              group.id,

            p_leader_id:
              newLeaderId,
          }
        );


      setBusy(false);


      if (result.error) {
        Alert.alert(
          'Leader update failed',
          result.error.message
        );

        return;
      }


      Alert.alert(
        'BUKLOD Cluster',
        newLeaderId
          ? 'Group leader updated.'
          : 'Group leader removed.'
      );


      await load();
    };


  const changeLeader =
    (
      leaderId:
        string
    ) => {
      const leader =
        leaders.find(
          (item) =>
            item.user_id ===
            leaderId
        );


      Alert.alert(
        'Change Cluster Leader',
        `Assign ${
          leader?.full_name ||
          'this account'
        } as the leader of ${
          group?.name ||
          'this BUKLOD Cluster'
        }?`,
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'ASSIGN',
            onPress: () =>
              void saveLeader(
                leaderId
              ),
          },
        ]
      );
    };


  const removeLeader = () => {
    if (!group?.leader_id) {
      return;
    }


    Alert.alert(
      'Remove Cluster Leader',
      `Remove ${
        group.leader_name ||
        'the current leader'
      } as leader of ${
        group.name
      }?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'REMOVE',
          style: 'destructive',
          onPress: () =>
            void saveLeader(
              null
            ),
        },
      ]
    );
  };


  const setGroupActive =
    async (
      active: boolean
    ) => {
      if (
        !group ||
        !deploymentReady
      ) {
        return;
      }


      setBusy(true);


      const result =
        await db.rpc(
          'manage_set_buklod_group_active',
          {
            p_group_id:
              group.id,

            p_active:
              active,
          }
        );


      setBusy(false);


      if (result.error) {
        Alert.alert(
          'BUKLOD Cluster',
          result.error.message
        );

        return;
      }


      Alert.alert(
        'BUKLOD Cluster',
        active
          ? 'Group reactivated.'
          : 'Group deactivated.'
      );


      await load();
    };


  const confirmGroupStatus =
    () => {
      if (!group) {
        return;
      }


      const next =
        !group.is_active;


      Alert.alert(
        next
          ? 'Reactivate Group'
          : 'Deactivate Group',

        next
          ? `Reactivate ${group.name}?`
          : `Deactivate ${group.name}? Members will remain in the records, but new assignment to this cluster will be blocked until it is reactivated.`,

        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text:
              next
                ? 'REACTIVATE'
                : 'DEACTIVATE',

            style:
              next
                ? 'default'
                : 'destructive',

            onPress: () =>
              void setGroupActive(
                next
              ),
          },
        ]
      );
    };


  const performAssignment =
    async (
      member:
        MemberRow,

      transfer:
        boolean
    ) => {
      if (
        !group ||
        !deploymentReady
      ) {
        return;
      }


      if (!group.is_active) {
        Alert.alert(
          'Inactive Group',
          'Reactivate this BUKLOD Cluster before assigning members.'
        );

        return;
      }


      setBusyUserId(
        member.user_id
      );


      const result =
        await db.rpc(
          'manage_assign_member_to_buklod_group',
          {
            p_user_id:
              member.user_id,

            p_group_id:
              group.id,

            p_transfer:
              transfer,
          }
        );


      setBusyUserId(null);


      if (result.error) {
        Alert.alert(
          transfer
            ? 'Transfer failed'
            : 'Assignment failed',

          result.error.message
        );

        return;
      }


      Alert.alert(
        transfer
          ? 'Member transferred'
          : 'Member assigned',

        `${
          member.full_name ||
          'Member'
        } is now assigned to ${
          group.name
        }.`
      );


      await reloadMembers();
    };


  const assignMember =
    (
      member:
        MemberRow
    ) => {
      if (!group) {
        return;
      }


      if (
        member.current_group_id &&
        member.current_group_id !==
          group.id
      ) {
        Alert.alert(
          'Confirm Cluster Transfer',

          `${
            member.full_name ||
            'This member'
          } is currently assigned to ${
            member.current_group_name ||
            'another BUKLOD Cluster'
          }. Transfer the member to ${
            group.name
          }?`,

          [
            {
              text: 'CANCEL',
              style: 'cancel',
            },
            {
              text: 'TRANSFER',
              style: 'destructive',
              onPress: () =>
                void performAssignment(
                  member,
                  true
                ),
            },
          ]
        );

        return;
      }


      Alert.alert(
        'Confirm Assignment',

        `Assign ${
          member.full_name ||
          'this member'
        } to ${
          group.name
        }?`,

        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'ASSIGN',
            onPress: () =>
              void performAssignment(
                member,
                false
              ),
          },
        ]
      );
    };


  const performRemoval =
    async (
      member:
        MemberRow
    ) => {
      if (
        !group ||
        !deploymentReady
      ) {
        return;
      }


      setBusyUserId(
        member.user_id
      );


      const result =
        await db.rpc(
          'manage_remove_member_from_buklod_group',
          {
            p_user_id:
              member.user_id,

            p_group_id:
              group.id,
          }
        );


      setBusyUserId(null);


      if (result.error) {
        Alert.alert(
          'Remove member failed',
          result.error.message
        );

        return;
      }


      Alert.alert(
        'Member removed',
        `${
          member.full_name ||
          'Member'
        } was removed from ${
          group.name
        }.`
      );


      await reloadMembers();
    };


  const removeMember =
    (
      member:
        MemberRow
    ) => {
      Alert.alert(
        'Remove Member',
        `Remove ${
          member.full_name ||
          'this member'
        } from ${
          group?.name ||
          'this BUKLOD Cluster'
        }?`,
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'REMOVE',
            style: 'destructive',
            onPress: () =>
              void performRemoval(
                member
              ),
          },
        ]
      );
    };


  const refresh =
    useCallback(async () => {
      setRefreshing(true);

      await load();

      setRefreshing(false);
    }, [load]);


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
            BUKLOD Cluster
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            Pastor or Admin access is required.
          </Text>
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      <Button
        title="BACK TO CLUSTERS"
        outline
        onPress={() =>
          router.back()
        }
      />


      {!deploymentReady && (
        <Card>
          <Text
            style={
              styles.pendingTitle
            }
          >
            UPDATE PENDING DEPLOYMENT
          </Text>

          <Text
            style={
              styles.pendingText
            }
          >
            Secure Pastor BUKLOD Cluster management
            is already present in the app source,
            but the required database migrations
            have not been deployed yet. Editing,
            leader management and membership
            changes are temporarily disabled.
          </Text>
        </Card>
      )}


      {loading ? (
        <Card>
          <ActivityIndicator
            color={colors.green}
          />
        </Card>
      ) : !group ? (
        <Card>
          <Text style={shared.h2}>
            BUKLOD Cluster unavailable
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            {!deploymentReady
              ? 'The secure group-management database update is still pending.'
              : 'This group does not exist or is outside your assigned Local Church scope.'}
          </Text>
        </Card>
      ) : (
        <>
          <View
            style={
              styles.titleRow
            }
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                BUKLOD GROUP MANAGEMENT
              </Text>

              <Text
                style={
                  shared.h1
                }
              >
                {group.name}
              </Text>

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 4,
                  },
                ]}
              >
                {group.church_name}
              </Text>
            </View>


            <View
              style={[
                styles.statusBadge,

                group.is_active
                  ? styles.activeBadge
                  : styles.inactiveBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,

                  group.is_active
                    ? styles.activeText
                    : styles.inactiveText,
                ]}
              >
                {group.is_active
                  ? 'ACTIVE'
                  : 'INACTIVE'}
              </Text>
            </View>
          </View>


          <SectionTitle>
            GROUP INFORMATION
          </SectionTitle>

          <Card>
            <Text
              style={
                styles.fieldLabel
              }
            >
              Group Name
            </Text>

            <TextInput
              value={editName}
              onChangeText={
                setEditName
              }
              style={
                styles.input
              }
              placeholder="BUKLOD Cluster name"
              editable={
                deploymentReady
              }
            />


            <Text
              style={
                styles.fieldLabel
              }
            >
              Code
            </Text>

            <TextInput
              value={editCode}
              onChangeText={
                setEditCode
              }
              style={
                styles.input
              }
              placeholder="Optional code"
              editable={
                deploymentReady
              }
            />


            <Text
              style={
                styles.fieldLabel
              }
            >
              Description
            </Text>

            <TextInput
              value={
                editDescription
              }
              onChangeText={
                setEditDescription
              }
              style={[
                styles.input,
                styles.multiline,
              ]}
              placeholder="Optional group description"
              multiline
              editable={
                deploymentReady
              }
            />


            {deploymentReady && (
              <Button
                title={
                  busy
                    ? 'SAVING...'
                    : 'SAVE GROUP DETAILS'
                }
                onPress={() =>
                  void saveDetails()
                }
              />
            )}
          </Card>


          <SectionTitle>
            GROUP LEADER
          </SectionTitle>

          <Card>
            <Text style={shared.body}>
              Current Leader:{' '}
              <Text
                style={{
                  fontWeight: '900',
                }}
              >
                {group.leader_name ||
                  'Not assigned'}
              </Text>
            </Text>


            {deploymentReady && (
              <>
                <Text
                  style={
                    styles.help
                  }
                >
                  Only active accounts with the
                  Leader role from this same Local
                  Church may be selected.
                </Text>


                <View
                  style={
                    styles.wrap
                  }
                >
                  {leaders.map(
                    (leader) => (
                      <Pressable
                        key={
                          leader.user_id
                        }
                        onPress={() => {
                          setSelectedLeaderId(
                            leader.user_id
                          );

                          changeLeader(
                            leader.user_id
                          );
                        }}
                        style={[
                          styles.chip,

                          selectedLeaderId ===
                            leader.user_id &&
                            styles.chipOn,
                        ]}
                      >
                        <Text>
                          {leader.full_name ||
                            'Leader'}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>


                {!leaders.length && (
                  <Text
                    style={
                      styles.help
                    }
                  >
                    No active Leader-role account is
                    available in this Local.
                  </Text>
                )}


                {!!group.leader_id && (
                  <Button
                    title="REMOVE CURRENT LEADER"
                    outline
                    onPress={
                      removeLeader
                    }
                  />
                )}
              </>
            )}
          </Card>


          <SectionTitle>
            GROUP STATUS
          </SectionTitle>

          <Card>
            <Text style={shared.body}>
              {group.is_active
                ? 'This BUKLOD Cluster is currently active.'
                : 'This BUKLOD Cluster is currently inactive.'}
            </Text>


            <Text
              style={
                styles.help
              }
            >
              Deactivation preserves the group,
              membership history and records. An
              inactive group cannot receive new
              member assignments until reactivated.
            </Text>


            {deploymentReady && (
              <Button
                title={
                  group.is_active
                    ? 'DEACTIVATE GROUP'
                    : 'REACTIVATE GROUP'
                }
                outline
                onPress={
                  confirmGroupStatus
                }
              />
            )}
          </Card>


          <SectionTitle>
            CURRENT MEMBERS
          </SectionTitle>


          {!deploymentReady ? (
            <Card>
              <Text style={shared.muted}>
                Membership management becomes
                available after the secure database
                migration is deployed.
              </Text>
            </Card>
          ) : !currentMembers.length ? (
            <Card>
              <Text style={shared.muted}>
                No active members are currently
                assigned to this BUKLOD Cluster.
              </Text>
            </Card>
          ) : (
            currentMembers.map(
              (member) => (
                <Card
                  key={
                    member.user_id
                  }
                >
                  <View
                    style={
                      styles.rowBetween
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          shared.h2
                        }
                      >
                        {member.full_name ||
                          'Member'}
                      </Text>


                      <View
                        style={
                          styles.memberBadges
                        }
                      >
                        <View
                          style={
                            styles.memberBadge
                          }
                        >
                          <Text
                            style={
                              styles.memberBadgeText
                            }
                          >
                            MEMBER
                          </Text>
                        </View>


                        {member.is_group_leader && (
                          <View
                            style={
                              styles.leaderBadge
                            }
                          >
                            <Text
                              style={
                                styles.leaderBadgeText
                              }
                            >
                              GROUP LEADER
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>


                    <Pressable
                      disabled={
                        busyUserId ===
                        member.user_id
                      }
                      onPress={() =>
                        removeMember(
                          member
                        )
                      }
                      style={
                        styles.removeButton
                      }
                    >
                      <Text
                        style={
                          styles.removeButtonText
                        }
                      >
                        {busyUserId ===
                        member.user_id
                          ? '...'
                          : 'REMOVE'}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              )
            )
          )}


          {deploymentReady && (
            <>
              <SectionTitle>
                ADD / TRANSFER MEMBER
              </SectionTitle>

              <Card>
                <Text style={shared.body}>
                  Only members from this Local
                  Church are shown. If a member is
                  already assigned to another
                  BUKLOD Cluster, an explicit transfer
                  confirmation is required.
                </Text>


                {!group.is_active && (
                  <Text
                    style={
                      styles.warning
                    }
                  >
                    This group is inactive.
                    Reactivate it before assigning
                    members.
                  </Text>
                )}


                <TextInput
                  value={search}
                  onChangeText={
                    setSearch
                  }
                  placeholder="Search member name or current group"
                  style={[
                    styles.input,
                    {
                      marginTop: 12,
                    },
                  ]}
                />
              </Card>


              {!candidateMembers.length ? (
                <Card>
                  <Text
                    style={
                      shared.muted
                    }
                  >
                    No matching Local member is
                    available.
                  </Text>
                </Card>
              ) : (
                candidateMembers.map(
                  (member) => {
                    const transferring =
                      !!member.current_group_id &&
                      member.current_group_id !==
                        group.id;


                    return (
                      <Pressable
                        key={
                          member.user_id
                        }
                        disabled={
                          busyUserId ===
                            member.user_id ||
                          !group.is_active
                        }
                        onPress={() =>
                          assignMember(
                            member
                          )
                        }
                        style={({
                          pressed,
                        }) => ({
                          opacity:
                            pressed ||
                            busyUserId ===
                              member.user_id ||
                            !group.is_active
                              ? 0.55
                              : 1,
                        })}
                      >
                        <Card>
                          <Text
                            style={
                              shared.h2
                            }
                          >
                            {member.full_name ||
                              'Member'}
                          </Text>


                          <Text
                            style={[
                              shared.body,
                              {
                                marginTop: 6,
                              },
                            ]}
                          >
                            {transferring
                              ? `Currently in: ${
                                  member.current_group_name ||
                                  'another BUKLOD Cluster'
                                }`
                              : 'No active BUKLOD Cluster'}
                          </Text>


                          <Text
                            style={
                              transferring
                                ? styles.transferAction
                                : styles.assignAction
                            }
                          >
                            {busyUserId ===
                            member.user_id
                              ? 'WORKING...'
                              : transferring
                              ? 'TAP TO TRANSFER'
                              : 'TAP TO ASSIGN'}
                          </Text>
                        </Card>
                      </Pressable>
                    );
                  }
                )
              )}
            </>
          )}


          <View
            style={{
              height: 80,
            }}
          />
        </>
      )}
    </ScrollView>
  );
}


const styles =
  StyleSheet.create({
    content: {
      ...shared.content,
      paddingBottom: 120,
    },

    center: {
      justifyContent: 'center',
      padding: 20,
    },

    titleRow: {
      marginTop: 18,
      marginBottom: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent:
        'space-between',
      gap: 12,
    },

    eyebrow: {
      marginBottom: 5,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: colors.greenDark,
    },

    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
    },

    activeBadge: {
      backgroundColor:
        colors.greenSoft,
    },

    inactiveBadge: {
      backgroundColor:
        '#F0F0F0',
    },

    statusText: {
      fontSize: 9,
      fontWeight: '900',
    },

    activeText: {
      color: colors.greenDark,
    },

    inactiveText: {
      color: colors.muted,
    },

    fieldLabel: {
      marginBottom: 5,
      fontSize: 10.5,
      fontWeight: '900',
      color: colors.text,
    },

    input: {
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      backgroundColor:
        colors.white,
    },

    multiline: {
      minHeight: 90,
      textAlignVertical: 'top',
    },

    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 10,
      marginBottom: 12,
    },

    chip: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 20,
      backgroundColor:
        colors.white,
    },

    chipOn: {
      borderColor: colors.green,
      backgroundColor:
        colors.greenSoft,
    },

    help: {
      marginTop: 9,
      marginBottom: 8,
      fontSize: 11,
      lineHeight: 17,
      color: colors.muted,
    },

    warning: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 17,
      fontWeight: '800',
      color: '#9A5B16',
    },

    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },

    memberBadges: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    memberBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor:
        colors.greenSoft,
    },

    memberBadgeText: {
      fontSize: 8.5,
      fontWeight: '900',
      color: colors.greenDark,
    },

    leaderBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor:
        '#FFF2D8',
    },

    leaderBadgeText: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#8A5A12',
    },

    removeButton: {
      paddingVertical: 7,
      paddingHorizontal: 9,
      borderWidth: 1,
      borderColor: '#D9BABA',
      borderRadius: 10,
      backgroundColor:
        '#FFF7F7',
    },

    removeButtonText: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#963D3D',
    },

    assignAction: {
      marginTop: 10,
      fontSize: 10,
      fontWeight: '900',
      color: colors.greenDark,
    },

    transferAction: {
      marginTop: 10,
      fontSize: 10,
      fontWeight: '900',
      color: '#9A5B16',
    },

    pendingTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: '#986219',
    },

    pendingText: {
      marginTop: 6,
      fontSize: 11,
      lineHeight: 17,
      color: '#765B35',
    },
  });