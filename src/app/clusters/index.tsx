import React, {
  useCallback,
  useEffect,
  useMemo,
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

import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';

import {
  ClusterSummary,
  discoverClusters,
  getMyClusters,
  joinCluster,
  respondClusterInvite,
} from '@/lib/buklodClusters';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';

function messageOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        'Unknown error'
    );
  }

  return String(error || 'Unknown error');
}

function openCluster(id: string) {
  router.push({
    pathname: '/clusters/[id]' as any,
    params: { id },
  } as any);
}

function StatusBadge({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {text}
      </Text>
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  disabled,
  danger,
  outline,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  outline?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        outline && styles.actionButtonOutline,
        danger && styles.actionButtonDanger,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          outline && styles.actionTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ClusterCard({
  item,
  children,
}: {
  item: ClusterSummary;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() =>
        item.membership_status === 'ACTIVE'
          ? openCluster(item.scope_id)
          : undefined
      }
      style={styles.card}
    >
      <View style={styles.cardTitleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {item.name}
          </Text>

          <Text style={styles.cardMeta}>
            {item.category || 'Community Cluster'}
            {'  |  '}
            {Number(
              item.member_count || 0
            ).toLocaleString()}
            {' members'}
          </Text>
        </View>

        <StatusBadge
          text={item.visibility.replace(
            '_',
            ' '
          )}
        />
      </View>

      {!!item.description && (
        <Text style={styles.description}>
          {item.description}
        </Text>
      )}

      {!!item.membership_status && (
        <Text style={styles.membership}>
          Status: {item.membership_status}
          {item.is_admin ? '  |  ADMIN' : ''}
        </Text>
      )}

      {children}
    </Pressable>
  );
}

export default function ClustersScreen() {
  const [myClusters, setMyClusters] =
    useState<ClusterSummary[]>([]);

  const [discover, setDiscover] =
    useState<ClusterSummary[]>([]);

  const [query, setQuery] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [searching, setSearching] =
    useState(false);

  const firstLoad = useRef(true);
  const searchRequest = useRef(0);

  const load = useCallback(
    async (
      searchValue: string = query,
      refresh = false
    ) => {
      const requestId = searchRequest.current + 1;
      searchRequest.current = requestId;

      if (refresh) {
        setRefreshing(true);
      } else if (firstLoad.current) {
        setLoading(true);
      } else {
        setSearching(true);
      }

      try {
        const [mine, found] =
          await Promise.all([
            getMyClusters(),
            discoverClusters(searchValue),
          ]);

        if (requestId !== searchRequest.current) {
          return;
        }

        setMyClusters(mine);
        setDiscover(found);
      } catch (error) {
        if (requestId !== searchRequest.current) {
          return;
        }

        Alert.alert(
          'Clusters',
          messageOf(error)
        );
      } finally {
        if (requestId === searchRequest.current) {
          firstLoad.current = false;
          setLoading(false);
          setSearching(false);
          setRefreshing(false);
        }
      }
    },
    [query]
  );

  useEffect(() => {
    const delay = query.trim() ? 180 : 0;
    const timer = setTimeout(() => {
      void load(query);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [load, query]);

  const activeClusters = useMemo(
    () =>
      myClusters.filter(
        (item) =>
          item.membership_status ===
          'ACTIVE'
      ),
    [myClusters]
  );

  const invitations = useMemo(
    () =>
      myClusters.filter(
        (item) =>
          item.membership_status ===
          'INVITED'
      ),
    [myClusters]
  );

  const pending = useMemo(
    () =>
      myClusters.filter(
        (item) =>
          item.membership_status ===
          'PENDING'
      ),
    [myClusters]
  );

  const respond = async (
    item: ClusterSummary,
    accept: boolean
  ) => {
    setBusyId(item.scope_id);

    try {
      await respondClusterInvite(
        item.scope_id,
        accept
      );

      await load(query, true);
    } catch (error) {
      Alert.alert(
        'Cluster invitation',
        messageOf(error)
      );
    } finally {
      setBusyId(null);
    }
  };

  const join = async (
    item: ClusterSummary
  ) => {
    setBusyId(item.scope_id);

    try {
      const status =
        await joinCluster(item.scope_id);

      if (status === 'PENDING') {
        Alert.alert(
          'Request sent',
          'The Cluster Admin will review your request.'
        );
      }

      await load(query, true);

      if (status === 'ACTIVE') {
        openCluster(item.scope_id);
      }
    } catch (error) {
      Alert.alert(
        'Join Cluster',
        messageOf(error)
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            void load(query, true)
          }
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          BUKLOD
        </Text>

        <Text style={styles.title}>
          Clusters
        </Text>

        <Text style={styles.subtitle}>
          Create or join communities for
          organizations, associations,
          friends, ministries and other
          groups.
        </Text>

        <ActionButton
          title="CREATE A CLUSTER"
          onPress={() =>
            router.push(
              '/clusters/create' as any
            )
          }
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>
            Loading Clusters...
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            MY CLUSTERS
          </Text>

          {activeClusters.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No active Cluster yet
              </Text>

              <Text style={styles.muted}>
                Create one or discover a
                community below.
              </Text>
            </View>
          ) : (
            activeClusters.map((item) => (
              <ClusterCard
                key={item.scope_id}
                item={item}
              >
                <View style={styles.actions}>
                  <Text style={styles.muted}>Tap the cluster to open Home</Text>
                  {item.is_admin && (
                    <ActionButton
                      title="MANAGE"
                      outline
                      onPress={() =>
                        router.push(
                          clusterScopeManageRoute(
                            item.scope_id,
                            item.name
                          ) as any
                        )
                      }
                    />
                  )}
                </View>
              </ClusterCard>
            ))
          )}

          {invitations.length > 0 && (
            <>
              <Text
                style={styles.sectionTitle}
              >
                INVITATIONS
              </Text>

              {invitations.map((item) => (
                <ClusterCard
                  key={item.scope_id}
                  item={item}
                >
                  <View style={styles.actions}>
                    <ActionButton
                      title="ACCEPT"
                      disabled={
                        busyId ===
                        item.scope_id
                      }
                      onPress={() =>
                        void respond(
                          item,
                          true
                        )
                      }
                    />

                    <ActionButton
                      title="DECLINE"
                      outline
                      disabled={
                        busyId ===
                        item.scope_id
                      }
                      onPress={() =>
                        void respond(
                          item,
                          false
                        )
                      }
                    />
                  </View>
                </ClusterCard>
              ))}
            </>
          )}

          {pending.length > 0 && (
            <>
              <Text
                style={styles.sectionTitle}
              >
                PENDING REQUESTS
              </Text>

              {pending.map((item) => (
                <ClusterCard
                  key={item.scope_id}
                  item={item}
                />
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>
            {query.trim() ? 'SEARCH RESULTS' : 'SUGGESTED CLUSTERS'}
          </Text>
          {searching ? (
            <Text style={styles.muted}>
              Searching Clusters...
            </Text>
          ) : null}

          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              placeholder="Search Cluster or category..."
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() =>
                void load(query, true)
              }
            />

            <Pressable
              style={styles.searchButton}
              onPress={() =>
                void load(query, true)
              }
            >
              <Text
                style={
                  styles.searchButtonText
                }
              >
                SEARCH
              </Text>
            </Pressable>
          </View>

          {discover.filter((item) => item.membership_status !== 'ACTIVE' && item.membership_status !== 'PENDING' && item.membership_status !== 'INVITED').length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No Cluster found
              </Text>
            </View>
          ) : (
            discover.filter((item) => item.membership_status !== 'ACTIVE' && item.membership_status !== 'PENDING' && item.membership_status !== 'INVITED').slice(0, query.trim() ? 20 : 3).map((item) => {
              const current =
                item.membership_status;

              return (
                <ClusterCard
                  key={item.scope_id}
                  item={item}
                >
                  <View
                    style={styles.actions}
                  >
                    {current === 'ACTIVE' ? (
                      <ActionButton
                        title="OPEN"
                        onPress={() =>
                          openCluster(
                            item.scope_id
                          )
                        }
                      />
                    ) : current ===
                      'PENDING' ? (
                      <ActionButton
                        title="REQUESTED"
                        disabled
                        onPress={() => {}}
                      />
                    ) : current ===
                      'INVITED' ? (
                      <ActionButton
                        title="VIEW INVITATION"
                        onPress={() =>
                          void respond(
                            item,
                            true
                          )
                        }
                      />
                    ) : (
                      <ActionButton
                        title={
                          item.visibility ===
                          'PRIVATE'
                            ? 'REQUEST TO JOIN'
                            : 'JOIN CLUSTER'
                        }
                        disabled={
                          busyId ===
                          item.scope_id
                        }
                        onPress={() =>
                          void join(item)
                        }
                      />
                    )}
                  </View>
                </ClusterCard>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </>
      )}
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

  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 8,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#2D6A4F',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#19362A',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#617068',
    marginBottom: 6,
  },

  sectionTitle: {
    marginTop: 14,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#365347',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 8,
  },

  cardTitleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },

  cardTitle: {
    color: '#1A3329',
    fontSize: 18,
    fontWeight: '900',
  },

  cardMeta: {
    color: '#748079',
    marginTop: 3,
    fontSize: 12,
  },

  description: {
    color: '#47574F',
    lineHeight: 19,
  },

  membership: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D6A4F',
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#EDF5F0',
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2D6A4F',
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },

  actionButton: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  actionButtonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
  },

  actionButtonDanger: {
    backgroundColor: '#9E2A2B',
  },

  actionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  actionTextOutline: {
    color: '#2D6A4F',
  },

  disabled: {
    opacity: 0.45,
  },

  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },

  search: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2DD',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    color: '#1A3329',
  },

  searchButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#244F3D',
  },

  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  empty: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 16,
  },

  emptyTitle: {
    fontWeight: '900',
    color: '#2E4339',
    marginBottom: 3,
  },

  muted: {
    color: '#748079',
  },

  loading: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
});
