import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';

import {
  ClusterSummary,
  discoverClusters,
  getMyClusters,
  joinCluster,
  respondClusterInvite,
} from '@/lib/buklodClusters';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { getBuklodCardTone, getStableBuklodCardTone, type BuklodCardToneName } from '@/lib/buklodCardTones';

function messageOf(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error &&
      (error as { code?: unknown }).code === 'PGRST303') {
    return 'Temporary server authentication delay. Your Cluster information is safe. Please retry shortly.';
  }
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


function StatusBadge({
  text,
}: {
  text: string;
}) {
  const badgeTone = getBuklodCardTone(text.toUpperCase() === 'PRIVATE' ? 'lavender' : 'mint');
  return (
    <View style={[styles.badge, { backgroundColor: badgeTone.soft }]}>
      <Text style={[styles.badgeText, { color: badgeTone.ink }]}>
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
  tone,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  outline?: boolean;
  tone?: BuklodCardToneName;
}) {
  const accent = tone ? getBuklodCardTone(tone) : null;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        outline && styles.actionButtonOutline,
        outline && accent && { backgroundColor: accent.soft, borderColor: accent.action },
        !outline && accent && { backgroundColor: accent.action },
        danger && styles.actionButtonDanger,
        pressed && { opacity: 0.8 },
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          outline && styles.actionTextOutline,
          outline && accent && { color: accent.ink },
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
  onOpen,
}: {
  item: ClusterSummary;
  onOpen?: (id: string) => void;
  children?: React.ReactNode;
}) {
  const accent = getBuklodCardTone(getStableBuklodCardTone(item.scope_id));
  return (
    <Pressable
      onPress={() =>
        item.membership_status === 'ACTIVE'
          ? onOpen?.(item.scope_id)
          : undefined
      }
      style={[styles.card, { backgroundColor: accent.surface, borderColor: accent.border }]}
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
        <Text numberOfLines={2} style={styles.description}>
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

// Session-memory cache: never persist private membership across app restarts.
// A successful mutation invalidates it before any follow-up read.
const CLUSTER_CACHE_TTL_MS = 60_000;
type ClusterMemory = {
  owner: string;
  mine: ClusterSummary[] | null;
  found: ClusterSummary[] | null;
  query: string;
  at: number;
};

function emptyClusterMemory(owner: string): ClusterMemory {
  return { owner, mine: null, found: null, query: '', at: 0 };
}

let clusterMemory = emptyClusterMemory('');

export default function ClustersScreen() {
  const { user } = useAuth();
  const owner = user?.id ?? '';
  // Do not reset same-user data on token refresh or repeated SIGNED_IN.
  // Account change remounts screen and immediately discards prior-user cache.
  if (clusterMemory.owner !== owner) {
    clusterMemory = emptyClusterMemory(owner);
  }
  return <ClusterDirectory key={owner || 'signed-out'} owner={owner} />;
}

function ClusterDirectory({ owner }: { owner: string }) {
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/buklod' as any);
      return true;
    });
    return () => listener.remove();
  }, []));
  const { selectScope, scopes } = useBuklodScope();
  const { online } = useNetwork();
  const openCluster = useCallback((id: string) => {
    void enterScopedWorkspace(selectScope, id, { section: 'home', navigation: 'replace' }).catch((error) => {
      Alert.alert('Cluster Home', messageOf(error));
    });
  }, [selectScope]);
  // Profile and Cluster tab share this already account-isolated scope snapshot.
  // It is a display-only fallback; server authorization still controls actions.
  const savedScopeClusters = useMemo<ClusterSummary[]>(() => scopes
    .filter(scope => scope.scope_type === 'CLUSTER' && scope.membership_status === 'ACTIVE')
    .map(scope => ({
      scope_id: scope.scope_id,
      name: scope.name || 'Cluster',
      description: null,
      category: null,
      visibility: scope.visibility === 'PRIVATE' || scope.visibility === 'INVITE_ONLY'
        ? scope.visibility : 'PUBLIC',
      scope_status: scope.scope_status || 'ACTIVE',
      membership_status: 'ACTIVE',
      is_admin: Boolean(scope.is_admin),
      member_count: Number(scope.member_count ?? 0),
    })), [scopes]);

  const [myClusters, setMyClusters] =
    useState<ClusterSummary[]>(clusterMemory.mine ?? []);

  const [discover, setDiscover] =
    useState<ClusterSummary[]>(clusterMemory.query === '' ? clusterMemory.found ?? [] : []);

  const [query, setQuery] = useState('');

  const [loading, setLoading] =
    useState(clusterMemory.mine === null && clusterMemory.found === null);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [searching, setSearching] =
    useState(false);
  const [loadError, setLoadError] = useState('');

  const firstLoad = useRef(clusterMemory.mine === null && clusterMemory.found === null);
  const searchRequest = useRef(0);

  const load = useCallback(
    async (
      searchValue: string = query,
      refresh = false
    ) => {
      const requestId = searchRequest.current + 1;
      searchRequest.current = requestId;
      if (!owner || clusterMemory.owner !== owner) {
        setMyClusters([]);
        setDiscover([]);
        setLoading(false);
        setRefreshing(false);
        setSearching(false);
        return;
      }

      if (!online) {
        setLoading(false);
        setRefreshing(false);
        setSearching(false);
        return;
      }
      setLoadError('');
      if (refresh) {
        setRefreshing(true);
      } else if (firstLoad.current) {
        setLoading(true);
      } else {
        setSearching(true);
      }

      try {
        // A slow discovery request must not hide the user's own clusters.
        // Preserve the last successful results for either independent read.
        const [mine, found] = await Promise.allSettled([
          getMyClusters(),
          discoverClusters(searchValue),
        ]);

        if (requestId !== searchRequest.current || clusterMemory.owner !== owner) {
          return;
        }

        if (mine.status === 'fulfilled') {
          setMyClusters(mine.value);
          clusterMemory.mine = mine.value;
        }
        if (found.status === 'fulfilled') {
          setDiscover(found.value);
          if (!searchValue.trim()) {
            clusterMemory.found = found.value;
            clusterMemory.query = '';
          }
        }
        if (mine.status === 'fulfilled' && found.status === 'fulfilled' && !searchValue.trim()) {
          clusterMemory.at = Date.now();
        }
        if (mine.status === 'rejected' || found.status === 'rejected') {
          const failed = mine.status === 'rejected' ? mine.reason : found.status === 'rejected' ? found.reason : null;
          setLoadError('Some Cluster information could not load. Previous results are retained. ' + messageOf(failed));
        }
      } catch (error) {
        if (requestId !== searchRequest.current || clusterMemory.owner !== owner) {
          return;
        }

        setLoadError(messageOf(error));
      } finally {
        if (requestId === searchRequest.current && clusterMemory.owner === owner) {
          firstLoad.current = false;
          setLoading(false);
          setSearching(false);
          setRefreshing(false);
        }
      }
    },
    [query, owner, online]
  );

  useEffect(() => {
    const delay = query.trim() ? 180 : 0;
    const timer = setTimeout(() => {
      if (!owner || clusterMemory.owner !== owner) return;
      if (!query.trim() && clusterMemory.at && Date.now() - clusterMemory.at < CLUSTER_CACHE_TTL_MS) return;
      void load(query);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [load, query, owner]);

  const usingSavedClusters = !online || Boolean(loadError) || loading;
  const visibleMyClusters = useMemo(() => usingSavedClusters
    ? Array.from(new Map([...savedScopeClusters, ...myClusters]
        .map(item => [item.scope_id, item] as const)).values())
    : myClusters, [usingSavedClusters, savedScopeClusters, myClusters]);

  const activeClusters = useMemo(
    () =>
      visibleMyClusters.filter(
        (item) =>
          item.membership_status ===
          'ACTIVE'
      ),
    [visibleMyClusters]
  );

  const invitations = useMemo(
    () =>
      visibleMyClusters.filter(
        (item) =>
          item.membership_status ===
          'INVITED'
      ),
    [visibleMyClusters]
  );

  const pending = useMemo(
    () =>
      visibleMyClusters.filter(
        (item) =>
          item.membership_status ===
          'PENDING'
      ),
    [visibleMyClusters]
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
      clusterMemory.at = 0;

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
      clusterMemory.at = 0;

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

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/clusters/create' as any)}
          style={styles.createClusterCompact}
        >
          <Text style={styles.createClusterCompactText}>+ Create Cluster</Text>
        </Pressable>
      </View>

      <BuklodFirstViewAd placement="cluster" placementId="cluster_directory_first_view" />

      {!online && <View style={styles.empty}>
        <Text style={styles.muted}>Offline · showing saved memberships. Search, changes, and verification require internet.</Text>
      </View>}
      {!!loadError && online && (
        <View style={styles.empty}>
          <Text style={styles.muted}>{loadError}</Text>
          <ActionButton title="RETRY" onPress={() => void load(query, true)} />
        </View>
      )}

      {loading && visibleMyClusters.length === 0 && online ? (
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
                {online && !loadError ? 'No active Cluster yet' : 'No saved Cluster membership on this device'}
              </Text>

              <Text style={styles.muted}>
                {online && !loadError ? 'Create one or discover a community below.' : 'Connect once to download your Cluster list.'}
              </Text>
            </View>
          ) : (
            activeClusters.map((item) => (
              <ClusterCard
                key={item.scope_id}
                item={item}
                onOpen={openCluster}
              >
                {item.is_admin && (
                  <View style={styles.actions}>
                    <ActionButton
                      title="MANAGE"
                      outline
                      tone={getStableBuklodCardTone(item.scope_id)}
                      onPress={() =>
                        router.push(
                          clusterScopeManageRoute(
                            item.scope_id,
                            item.name
                          ) as any
                        )
                      }
                    />
                  </View>
                )}
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
                  onOpen={openCluster}
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
                {online && !loadError ? 'No Cluster found' : 'Cluster discovery requires internet'}
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
                  onOpen={openCluster}
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
    padding: 12,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 8,
  },

  createClusterCompact: {
    alignSelf: 'flex-start',
    backgroundColor: '#2D6A4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },

  createClusterCompactText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#2D6A4F',
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#19362A',
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#617068',
    marginBottom: 6,
  },

  sectionTitle: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#365347',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 5,
  },

  cardTitleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },

  cardTitle: {
    color: '#1A3329',
    fontSize: 16,
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
