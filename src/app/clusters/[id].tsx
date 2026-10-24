import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';

import { useBuklodScope } from '@/providers/BuklodScopeProvider';

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
    useLocalSearchParams<{
      id?: string;
      fromInvite?: string;
    }>();

  const scopeId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const fromInvite =
    params.fromInvite === '1' ||
    params.fromInvite === 'true';

  const { selectScope } =
    useBuklodScope();

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

  const [loadError, setLoadError] = useState('');
  const loadGeneration = useRef(0);

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

  const load = useCallback(async (refresh = false) => {
    const generation = ++loadGeneration.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!refresh) {
      setCluster(null);
      setMembers([]);
      setRequests([]);
      setCandidates([]);
      setName('');
      setCategory('');
      setDescription('');
    }
    setLoadError('');
    setLoading(!refresh);
    setRefreshing(refresh);
    try {
      if (!scopeId) throw new Error('Missing Cluster ID.');
      const info = await Promise.race([
        getClusterDetails(scopeId),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Connection timed out. Please retry.')), 10000);
        }),
      ]);
      if (generation !== loadGeneration.current) return;
      setCluster(info);
      if (info) {
        setName(info.name || '');
        setCategory(info.category || '');
        setDescription(info.description || '');
        setVisibility(info.visibility);
        setMembers([]);
        setRequests([]);
      }
    } catch (error) {
      if (generation === loadGeneration.current) setLoadError(messageOf(error));
    } finally {
      clearTimeout(timer);
      if (generation === loadGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current += 1; };
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

  const openClusterHome = async () => {
    await enterScopedWorkspace(
      selectScope,
      scopeId,
      {
        section: 'home',
        navigation: 'replace',
      }
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
          {loadError || 'Cluster unavailable'}
        </Text>

        <ActionButton title="RETRY" onPress={() => void load()} />
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
    <BuklodPortalScrollView
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
      {!!loadError && <View><Text style={styles.muted}>{loadError}</Text><ActionButton title="RETRY" onPress={() => void load(true)} /></View>}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {fromInvite
            ? 'CLUSTER INVITATION'
            : 'CLUSTER HOME'}
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
              <Text style={styles.statusText}>
                {membership}
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
                    return;
                  }

                  if (
                    result === 'ACTIVE'
                  ) {
                    await openClusterHome();
                  }
                })
              }
            />
          )}

        {!membership &&
          cluster.scope_status !==
            'ARCHIVED' &&
          cluster.visibility ===
            'INVITE_ONLY' && (
            <Text style={styles.inviteOnly}>
              This Cluster is invite-only.
              Ask a Cluster Admin to send
              you an invitation, then open
              this link again to accept.
            </Text>
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

                  await openClusterHome();
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

        {membership === 'ACTIVE' && (
          <View style={styles.actions}>
            <ActionButton
              title="OPEN CLUSTER HOME"
              disabled={busy}
              onPress={() =>
                void openClusterHome()
              }
            />

            <ActionButton
              title="CLUSTER PROGRESS REPORT"
              outline
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: '/clusters/progress' as any,
                  params: { id: scopeId },
                } as any)
              }
            />

            <ActionButton
              title="LEAVE CLUSTER"
              danger
              outline
              disabled={busy}
              onPress={confirmLeave}
            />
          </View>
        )}
      </View>

      <View style={{ height: 50 }} />
    </BuklodPortalScrollView>
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

  inviteOnly: {
    color: '#617068',
    lineHeight: 20,
    fontSize: 13,
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

