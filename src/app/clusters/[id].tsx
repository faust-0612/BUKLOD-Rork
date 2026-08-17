import React, {
  useCallback,
  useEffect,
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
  ClusterDetails,
  ClusterMember,
  ClusterPerson,
  ClusterRequest,
  ClusterVisibility,
  archiveCluster,
  getClusterDetails,
  getClusterMembers,
  getClusterRequests,
  inviteClusterMember,
  joinCluster,
  leaveCluster,
  removeClusterMember,
  respondClusterInvite,
  restoreCluster,
  reviewClusterRequest,
  searchClusterInviteCandidates,
  transferClusterAdmin,
  updateCluster,
} from '@/lib/buklodClusters';

function messageOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown })
        .message || 'Unknown error'
    );
  }

  return String(error || 'Unknown error');
}

function ActionButton({
  title,
  onPress,
  danger,
  outline,
  disabled,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        outline && styles.buttonOutline,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          outline && styles.buttonTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function ClusterDetailScreen() {
  const params =
    useLocalSearchParams<{ id?: string }>();

  const scopeId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [cluster, setCluster] =
    useState<ClusterDetails | null>(null);

  const [members, setMembers] =
    useState<ClusterMember[]>([]);

  const [requests, setRequests] =
    useState<ClusterRequest[]>([]);

  const [candidates, setCandidates] =
    useState<ClusterPerson[]>([]);

  const [inviteSearch, setInviteSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [name, setName] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [visibility, setVisibility] =
    useState<ClusterVisibility>('PUBLIC');

  const load = useCallback(
    async (refresh = false) => {
      if (!scopeId) {
        setLoading(false);
        return;
      }

      refresh
        ? setRefreshing(true)
        : setLoading(true);

      try {
        const info =
          await getClusterDetails(scopeId);

        setCluster(info);

        if (info) {
          setName(info.name || '');
          setCategory(info.category || '');
          setDescription(
            info.description || ''
          );
          setVisibility(info.visibility);

          if (info.is_admin) {
            const [memberRows, requestRows] =
              await Promise.all([
                getClusterMembers(scopeId),
                getClusterRequests(scopeId),
              ]);

            setMembers(memberRows);
            setRequests(requestRows);
          } else {
            setMembers([]);
            setRequests([]);
          }
        }
      } catch (error) {
        Alert.alert(
          'Cluster',
          messageOf(error)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scopeId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    work: () => Promise<void>
  ) => {
    if (busy) return;

    setBusy(true);

    try {
      await work();
      await load(true);
    } catch (error) {
      Alert.alert(
        'Cluster',
        messageOf(error)
      );
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () =>
    run(async () => {
      if (!name.trim()) {
        throw new Error(
          'Cluster name is required.'
        );
      }

      await updateCluster(scopeId, {
        name,
        description,
        category,
        visibility,
      });

      Alert.alert(
        'Cluster',
        'Cluster settings saved.'
      );
    });

  const searchPeople = async () => {
    try {
      const rows =
        await searchClusterInviteCandidates(
          scopeId,
          inviteSearch
        );

      setCandidates(rows);
    } catch (error) {
      Alert.alert(
        'Invite members',
        messageOf(error)
      );
    }
  };

  const confirmRemove = (
    member: ClusterMember
  ) => {
    Alert.alert(
      'Remove member',
      `Remove ${member.full_name} from this Cluster?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await removeClusterMember(
                scopeId,
                member.user_id
              );
            }),
        },
      ]
    );
  };

  const confirmTransfer = (
    member: ClusterMember
  ) => {
    Alert.alert(
      'Transfer Cluster Admin',
      `Make ${member.full_name} the Cluster Admin? You will remain a normal member.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Transfer',
          onPress: () =>
            void run(async () => {
              await transferClusterAdmin(
                scopeId,
                member.user_id
              );
            }),
        },
      ]
    );
  };

  const confirmArchive = () => {
    Alert.alert(
      'Archive Cluster',
      'The Cluster will stop accepting new activity until restored.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await archiveCluster(
                scopeId
              );
            }),
        },
      ]
    );
  };

  const confirmLeave = () => {
    Alert.alert(
      'Leave Cluster',
      'Leave this Cluster?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await leaveCluster(
                scopeId
              );

              router.replace(
                '/clusters' as any
              );
            }),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>
          Loading Cluster...
        </Text>
      </View>
    );
  }

  if (!cluster) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>
          Cluster unavailable
        </Text>

        <ActionButton
          title="BACK TO CLUSTERS"
          onPress={() =>
            router.replace(
              '/clusters' as any
            )
          }
        />
      </View>
    );
  }

  const membership =
    cluster.membership_status;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            void load(true)
          }
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          CLUSTER HOME
        </Text>

        <Text style={styles.title}>
          {cluster.name}
        </Text>

        <Text style={styles.meta}>
          {cluster.category ||
            'Community Cluster'}
          {'  |  '}
          {cluster.visibility.replace(
            '_',
            ' '
          )}
          {'  |  '}
          {Number(
            cluster.member_count || 0
          ).toLocaleString()}
          {' members'}
        </Text>

        {!!cluster.description && (
          <Text style={styles.description}>
            {cluster.description}
          </Text>
        )}

        <View style={styles.statusRow}>
          <View style={styles.status}>
            <Text style={styles.statusText}>
              {cluster.scope_status}
            </Text>
          </View>

          {!!membership && (
            <View style={styles.status}>
              <Text
                style={styles.statusText}
              >
                {membership}
              </Text>
            </View>
          )}

          {cluster.is_admin && (
            <View style={styles.adminStatus}>
              <Text
                style={
                  styles.adminStatusText
                }
              >
                ADMIN
              </Text>
            </View>
          )}
        </View>

        {!membership &&
          cluster.scope_status !==
            'ARCHIVED' &&
          cluster.visibility !==
            'INVITE_ONLY' && (
            <ActionButton
              title={
                cluster.visibility ===
                'PRIVATE'
                  ? 'REQUEST TO JOIN'
                  : 'JOIN CLUSTER'
              }
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const result =
                    await joinCluster(
                      scopeId
                    );

                  if (
                    result === 'PENDING'
                  ) {
                    Alert.alert(
                      'Request sent',
                      'Your request is waiting for Cluster Admin approval.'
                    );
                  }
                })
              }
            />
          )}

        {membership === 'INVITED' && (
          <View style={styles.actions}>
            <ActionButton
              title="ACCEPT INVITATION"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await respondClusterInvite(
                    scopeId,
                    true
                  );
                })
              }
            />

            <ActionButton
              title="DECLINE"
              outline
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await respondClusterInvite(
                    scopeId,
                    false
                  );

                  router.replace(
                    '/clusters' as any
                  );
                })
              }
            />
          </View>
        )}

        {membership === 'PENDING' && (
          <ActionButton
            title="CANCEL JOIN REQUEST"
            outline
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await leaveCluster(
                  scopeId
                );
              })
            }
          />
        )}

        {membership === 'ACTIVE' &&
          !cluster.is_admin && (
            <ActionButton
              title="LEAVE CLUSTER"
              danger
              disabled={busy}
              onPress={confirmLeave}
            />
          )}
      </View>

      {cluster.is_admin && (
        <>
          <Text style={styles.sectionTitle}>
            ADMIN SETTINGS
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>
              CLUSTER NAME
            </Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={120}
            />

            <Text style={styles.label}>
              CATEGORY
            </Text>

            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Association, Friends, School..."
              maxLength={80}
            />

            <Text style={styles.label}>
              DESCRIPTION
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.multiline,
              ]}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />

            <Text style={styles.label}>
              PRIVACY
            </Text>

            {(
              [
                'PUBLIC',
                'PRIVATE',
                'INVITE_ONLY',
              ] as ClusterVisibility[]
            ).map((option) => (
              <Pressable
                key={option}
                onPress={() =>
                  setVisibility(option)
                }
                style={[
                  styles.visibilityRow,
                  visibility === option &&
                    styles.visibilityActive,
                ]}
              >
                <Text
                  style={
                    styles.visibilityText
                  }
                >
                  {option.replace(
                    '_',
                    ' '
                  )}
                </Text>

                {visibility === option && (
                  <Text
                    style={
                      styles.checkText
                    }
                  >
                    SELECTED
                  </Text>
                )}
              </Pressable>
            ))}

            <ActionButton
              title="SAVE SETTINGS"
              disabled={busy}
              onPress={() =>
                void saveSettings()
              }
            />
          </View>

          <Text style={styles.sectionTitle}>
            JOIN REQUESTS
          </Text>

          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.muted}>
                No pending requests.
              </Text>
            </View>
          ) : (
            requests.map((request) => (
              <View
                key={request.user_id}
                style={styles.personCard}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.personName
                    }
                  >
                    {request.full_name}
                  </Text>

                  <Text
                    style={styles.muted}
                  >
                    Requesting membership
                  </Text>
                </View>

                <View
                  style={styles.actions}
                >
                  <ActionButton
                    title="APPROVE"
                    disabled={busy}
                    onPress={() =>
                      void run(
                        async () => {
                          await reviewClusterRequest(
                            scopeId,
                            request.user_id,
                            true
                          );
                        }
                      )
                    }
                  />

                  <ActionButton
                    title="REJECT"
                    outline
                    disabled={busy}
                    onPress={() =>
                      void run(
                        async () => {
                          await reviewClusterRequest(
                            scopeId,
                            request.user_id,
                            false
                          );
                        }
                      )
                    }
                  />
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>
            INVITE MEMBERS
          </Text>

          <View style={styles.card}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search member name..."
                value={inviteSearch}
                onChangeText={
                  setInviteSearch
                }
                returnKeyType="search"
                onSubmitEditing={() =>
                  void searchPeople()
                }
              />

              <ActionButton
                title="SEARCH"
                onPress={() =>
                  void searchPeople()
                }
              />
            </View>

            {candidates.map(
              (candidate) => (
                <View
                  key={
                    candidate.user_id
                  }
                  style={
                    styles.personCard
                  }
                >
                  <Text
                    style={[
                      styles.personName,
                      { flex: 1 },
                    ]}
                  >
                    {candidate.full_name}
                  </Text>

                  <ActionButton
                    title="INVITE"
                    disabled={busy}
                    onPress={() =>
                      void run(
                        async () => {
                          await inviteClusterMember(
                            scopeId,
                            candidate.user_id
                          );

                          setCandidates(
                            (current) =>
                              current.filter(
                                (item) =>
                                  item.user_id !==
                                  candidate.user_id
                              )
                          );
                        }
                      )
                    }
                  />
                </View>
              )
            )}
          </View>

          <Text style={styles.sectionTitle}>
            MEMBERS
          </Text>

          {members.map((member) => (
            <View
              key={member.user_id}
              style={styles.personCard}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={styles.personName}
                >
                  {member.full_name}
                </Text>

                <Text style={styles.muted}>
                  {member.is_admin
                    ? 'Cluster Admin'
                    : 'Member'}
                </Text>
              </View>

              {!member.is_admin && (
                <View
                  style={styles.actions}
                >
                  <ActionButton
                    title="MAKE ADMIN"
                    outline
                    disabled={busy}
                    onPress={() =>
                      confirmTransfer(
                        member
                      )
                    }
                  />

                  <ActionButton
                    title="REMOVE"
                    danger
                    disabled={busy}
                    onPress={() =>
                      confirmRemove(
                        member
                      )
                    }
                  />
                </View>
              )}
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            CLUSTER LIFECYCLE
          </Text>

          <View style={styles.card}>
            {cluster.scope_status ===
            'ARCHIVED' ? (
              <>
                <Text
                  style={styles.description}
                >
                  This Cluster is archived.
                  Restore it to resume normal
                  activity.
                </Text>

                <ActionButton
                  title="RESTORE CLUSTER"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await restoreCluster(
                        scopeId
                      );
                    })
                  }
                />
              </>
            ) : (
              <>
                <Text
                  style={styles.description}
                >
                  Archive the Cluster if it
                  is no longer active. It can
                  be restored later.
                </Text>

                <ActionButton
                  title="ARCHIVE CLUSTER"
                  danger
                  disabled={busy}
                  onPress={
                    confirmArchive
                  }
                />
              </>
            )}
          </View>
        </>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },

  content: {
    padding: 16,
    gap: 10,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#F5F7F6',
  },

  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    padding: 18,
    gap: 9,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#2D6A4F',
  },

  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    color: '#19362A',
  },

  meta: {
    color: '#748079',
    fontWeight: '700',
    fontSize: 12,
  },

  description: {
    color: '#526259',
    lineHeight: 20,
  },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  status: {
    backgroundColor: '#EDF3EF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusText: {
    color: '#436052',
    fontSize: 10,
    fontWeight: '900',
  },

  adminStatus: {
    backgroundColor: '#DFF2E7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  adminStatusText: {
    color: '#236043',
    fontSize: 10,
    fontWeight: '900',
  },

  sectionTitle: {
    marginTop: 14,
    fontSize: 13,
    color: '#365347',
    fontWeight: '900',
    letterSpacing: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 16,
    padding: 14,
    gap: 9,
  },

  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: '#496056',
    marginTop: 3,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    backgroundColor: '#FAFBFA',
    paddingHorizontal: 12,
    color: '#1C362B',
  },

  multiline: {
    minHeight: 110,
    paddingTop: 11,
  },

  visibilityRow: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFE6E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  visibilityActive: {
    borderColor: '#2D6A4F',
    backgroundColor: '#F0F7F3',
  },

  visibilityText: {
    flex: 1,
    fontWeight: '800',
    color: '#40544A',
  },

  checkText: {
    color: '#2D6A4F',
    fontWeight: '900',
    fontSize: 10,
  },

  personCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 13,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  personName: {
    color: '#243C31',
    fontWeight: '900',
  },

  muted: {
    color: '#748079',
    fontSize: 12,
  },

  notFound: {
    color: '#263F34',
    fontWeight: '900',
    fontSize: 20,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  button: {
    minHeight: 39,
    paddingHorizontal: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#2D6A4F',
  },

  buttonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
  },

  buttonDanger: {
    backgroundColor: '#9E2A2B',
  },

  buttonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  buttonTextOutline: {
    color: '#2D6A4F',
  },

  searchRow: {
    flexDirection: 'row',
    gap: 7,
  },

  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    paddingHorizontal: 11,
    color: '#1C362B',
  },

  empty: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 15,
  },

  disabled: {
    opacity: 0.45,
  },
});
