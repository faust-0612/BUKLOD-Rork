import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { colors } from '@/lib/theme';

export default function ApprovalsScreen() {
  const { hasRole } = useAuth();

  const isSystemAdmin =
    hasRole('system_admin');

  // PATCH_156B_DISTRIBUTED_REVIEW
  const canReviewLocalMembership =
    isSystemAdmin ||
    hasRole('pastor') ||
    hasRole('local_admin');

  const [requests, setRequests] =
    useState<any[]>([]);
  const [groups, setGroups] =
    useState<any[]>([]);
  const [selected, setSelected] =
    useState<
      Record<string, string>
    >({});
  const [notes, setNotes] =
    useState<
      Record<string, string>
    >({});
  const [
    newGroupNames,
    setNewGroupNames,
  ] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] =
    useState(true);

  const load =
    useCallback(async () => {
      if (!canReviewLocalMembership) {
        setLoading(false);
        return;
      }

      const [
        {
          data: requestData,
          error: requestError,
        },
        {
          data: groupData,
          error: groupError,
        },
      ] = await Promise.all([
        supabase
          .from(
            'church_join_requests'
          )
          .select(`
            id,
            user_id,
            church_id,
            requested_group_id,
            proposed_group_name,
            assigned_group_id,
            status,
            member_note,
            created_at,
            requester:user_id(
              full_name,
              first_name,
              middle_name,
              surname,
              suffix,
              mobile,
              username,
              login_method,
              login_identifier,
              is_verified
            ),
            church:church_id(name),
            requested_group:requested_group_id(name)
          `)
          .eq(
            'status',
            'pending'
          )
          .order('created_at', {
            ascending: true,
          }),

        supabase
          .from('buklod_groups')
          .select(
            'id,name,code,church_id,leader_id'
          )
          .eq('is_active', true)
          .order('name'),
      ]);

      if (requestError) {
        Alert.alert(
          'Local Membership Requests',
          requestError.message
        );
      }

      if (groupError) {
        Alert.alert(
          'BUKLOD Clusters',
          groupError.message
        );
      }

      setRequests(
        requestData ?? []
      );
      setGroups(
        groupData ?? []
      );
      setLoading(false);
    }, [canReviewLocalMembership]);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (
    request: any,
    mode:
      | 'no_group'
      | 'existing'
      | 'new_group'
  ) => {
    // PATCH_156B_NEW_GROUP_GUARD
    if (mode === 'new_group' && !isSystemAdmin) {
      return Alert.alert(
        'System Admin Required',
        'Only System Admin can create a new BUKLOD Group during Local membership review.'
      );
    }

    const selectedGroupId =
      selected[request.id] ||
      request.requested_group_id ||
      '';

    if (
      mode === 'existing' &&
      !selectedGroupId
    ) {
      return Alert.alert(
        'Select Group',
        'Select the final BUKLOD Cluster first.'
      );
    }

    const newGroupName =
      (
        newGroupNames[
          request.id
        ] ??
        request.proposed_group_name ??
        ''
      ).trim();

    if (
      mode === 'new_group' &&
      newGroupName.length < 2
    ) {
      return Alert.alert(
        'New Group',
        'Enter the new BUKLOD Cluster name.'
      );
    }

    const group =
      groups.find(
        (item) =>
          item.id ===
          selectedGroupId
      );

    const actionText =
      mode === 'no_group'
        ? 'verify this account without assigning a BUKLOD Cluster'
        : mode === 'existing'
        ? `approve this Local membership and assign ${group?.name || 'the selected group'}`
        : `create "${newGroupName}" and approve this Local membership`;

    Alert.alert(
      'Local Membership Review',
      `Confirm that you want to ${actionText}?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'CONFIRM',
          onPress: async () => {
            const { error } =
              await supabase.rpc(
                'review_local_membership_request_v5',
                {
                  p_request_id:
                    request.id,
                  p_group_id:
                    mode ===
                    'existing'
                      ? selectedGroupId
                      : null,
                  p_create_new_group:
                    mode ===
                    'new_group',
                  p_new_group_name:
                    mode ===
                    'new_group'
                      ? newGroupName
                      : null,
                  p_reviewer_note:
                    notes[
                      request.id
                    ] || null,
                }
              );

            if (error) {
              return Alert.alert(
                'Verification failed',
                error.message
              );
            }

            Alert.alert(
              'Verified',
              mode ===
              'no_group'
                ? 'Account is verified. The member may now navigate BUKLOD even without a group assignment.'
                : 'Account is verified and the group assignment is active.'
            );

            await load();
          },
        },
      ]
    );
  };

  const reject =
    async (request: any) => {
      Alert.alert(
        'Needs Further Review',
        'Keep this account unverified and mark the request for further review?',
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'CONFIRM',
            onPress: async () => {
              const { error } =
                await supabase.rpc(
                  'reject_local_membership_request_v5',
                  {
                    p_request_id:
                      request.id,
                    p_reviewer_note:
                      notes[
                        request.id
                      ] ||
                      'Please coordinate with the System Admin.',
                  }
                );

              if (error) {
                return Alert.alert(
                  'Could not update request',
                  error.message
                );
              }

              await load();
            },
          },
        ]
      );
    };

  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          {
            justifyContent:
              'center',
          },
        ]}
      >
        <ActivityIndicator
          color={colors.green}
        />
      </View>
    );
  }

  if (!canReviewLocalMembership) {
    return (
      <View
        style={[
          shared.screen,
          shared.content,
        ]}
      >
        <Text style={shared.h1}>
          Local Membership Requests
        </Text>

        <Card>
          <Text>
            Pastor and Local Admin may review requests within their authorized Local Church. System Admin may review all Local membership requests.
          </Text>
        </Card>

        <Button
          title="BACK"
          onPress={() =>
            router.back()
          }
        />
      </View>
    );
  }

  return (
    <View style={shared.screen}>
      <FlatList
        contentContainerStyle={
          shared.content
        }
        data={requests}
        keyExtractor={(item) =>
          item.id
        }
        ListHeaderComponent={
          <View>
            <Text
              style={shared.h1}
            >
              Local Membership Requests
            </Text>

            <Text
              style={shared.muted}
            >
              Every new account can log in, but only System Admin verification unlocks BUKLOD navigation. Group assignment is optional.
            </Text>

            <SectionTitle>
              WAITING FOR VERIFICATION
            </SectionTitle>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Text
              style={shared.muted}
            >
              No accounts are waiting for verification.
            </Text>
          </Card>
        }
        renderItem={({
          item,
        }) => {
          const available =
            groups.filter(
              (group) =>
                group.church_id ===
                item.church_id
            );

          const finalGroupId =
            selected[item.id] ||
            item.requested_group_id ||
            '';

          const defaultNewName =
            newGroupNames[
              item.id
            ] ??
            item.proposed_group_name ??
            '';

          return (
            <Card>
              <Text
                style={shared.h2}
              >
                {item.requester
                  ?.full_name ||
                  'New Account'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                First Name:{' '}
                {item.requester
                  ?.first_name ||
                  '-'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                Middle Name:{' '}
                {item.requester
                  ?.middle_name ||
                  '-'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                Surname:{' '}
                {item.requester
                  ?.surname ||
                  '-'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                Suffix:{' '}
                {item.requester
                  ?.suffix ||
                  '-'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                Login:{' '}
                {item.requester
                  ?.login_method ||
                  'legacy'}
                {' | '}
                {item.requester
                  ?.login_identifier ||
                  item.requester
                    ?.username ||
                  item.requester
                    ?.mobile ||
                  '-'}
              </Text>

              <Text
                style={
                  styles.identity
                }
              >
                Local Church:{' '}
                {item.church
                  ?.name ||
                  '-'}
              </Text>

              {!!item.member_note && (
                <View
                  style={
                    styles.noteBox
                  }
                >
                  <Text
                    style={
                      styles.noteLabel
                    }
                  >
                    MEMBER NOTE
                  </Text>

                  <Text
                    style={
                      styles.noteText
                    }
                  >
                    {
                      item.member_note
                    }
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.preferenceBox
                }
              >
                <Text
                  style={
                    styles.preferenceLabel
                  }
                >
                  GROUP PREFERENCE
                </Text>

                <Text
                  style={
                    styles.preferenceName
                  }
                >
                  {item
                    .requested_group
                    ?.name ||
                  item
                    .proposed_group_name ||
                  'No group requested'}
                </Text>
              </View>

              <Button
                title="APPROVE LOCAL - ASSIGN CLUSTER LATER"
                onPress={() =>
                  verify(
                    item,
                    'no_group'
                  )
                }
              />

              {!!available.length && (
                <>
                  <Text
                    style={[
                      shared.h2,
                      {
                        marginTop: 14,
                      },
                    ]}
                  >
                    Assign Existing Group
                  </Text>

                  <View
                    style={
                      styles.wrap
                    }
                  >
                    {available.map(
                      (group) => (
                        <Pressable
                          key={
                            group.id
                          }
                          onPress={() =>
                            setSelected(
                              (
                                current
                              ) => ({
                                ...current,
                                [item.id]:
                                  group.id,
                              })
                            )
                          }
                          style={[
                            styles.chip,
                            finalGroupId ===
                              group.id &&
                              styles.chipOn,
                          ]}
                        >
                          <Text
                            style={{
                              fontWeight:
                                '800',
                            }}
                          >
                            {
                              group.name
                            }
                            {group.id ===
                            item.requested_group_id
                              ? ' | REQUESTED'
                              : ''}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>

                  <Button
                    title="APPROVE LOCAL & ASSIGN GROUP"
                    outline
                    onPress={() =>
                      verify(
                        item,
                        'existing'
                      )
                    }
                  />
                </>
              )}

              <Text
                style={[
                  shared.h2,
                  {
                    marginTop: 14,
                  },
                ]}
              >
                Create New Group
              </Text>

              <Text
                style={styles.help}
              >
                System Admin only. Use the proposed name or enter the final BUKLOD Group name.
              </Text>

              <TextInput
                value={
                  defaultNewName
                }
                onChangeText={(
                  value
                ) =>
                  setNewGroupNames(
                    (
                      current
                    ) => ({
                      ...current,
                      [item.id]:
                        value,
                    })
                  )
                }
                placeholder="New BUKLOD Cluster name"
                style={styles.input}
              />

              <Button
                title="CREATE GROUP & APPROVE LOCAL"
                outline
                onPress={() =>
                  verify(
                    item,
                    'new_group'
                  )
                }
              />

              <TextInput
                value={
                  notes[item.id] ||
                  ''
                }
                onChangeText={(
                  value
                ) =>
                  setNotes(
                    (
                      current
                    ) => ({
                      ...current,
                      [item.id]:
                        value,
                    })
                  )
                }
                placeholder="Optional reviewer note"
                style={styles.input}
              />

              <Button
                title="NEEDS FURTHER REVIEW"
                outline
                onPress={() =>
                  reject(item)
                }
              />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    identity: {
      marginTop: 4,
      fontSize: 12,
      color: colors.muted,
    },
    noteBox: {
      marginTop: 12,
      padding: 11,
      borderRadius: 10,
      backgroundColor: '#F7F7F7',
    },
    noteLabel: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.muted,
    },
    noteText: {
      marginTop: 4,
      color: colors.text,
    },
    preferenceBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#F2F6F3',
      borderWidth: 1,
      borderColor: colors.line,
    },
    preferenceLabel: {
      fontSize: 9.5,
      fontWeight: '900',
      letterSpacing: 0.5,
      color: colors.muted,
    },
    preferenceName: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: '900',
      color: colors.greenDark,
    },
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginVertical: 9,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 11,
      backgroundColor:
        colors.white,
    },
    chipOn: {
      backgroundColor:
        colors.greenSoft,
      borderColor: colors.green,
    },
    help: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 17,
      color: colors.muted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      backgroundColor:
        colors.white,
    },
  });
