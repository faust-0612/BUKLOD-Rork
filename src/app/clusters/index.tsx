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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Image,
  View,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
import {useBuklodScopePhoto} from '@/hooks/useBuklodScopePhoto';
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


/** Compact navigation card: title opens an ACTIVE workspace; management is a
 * separate action so tapping Manage cannot accidentally navigate twice. */
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
  const scopePhoto=useBuklodScopePhoto(item.scope_id);
  const canOpen = item.membership_status === 'ACTIVE' && Boolean(onOpen);
  const role = item.is_admin ? 'Admin' : 'Member';
  const status = item.membership_status === 'ACTIVE'
    ? role
    : item.membership_status === 'PENDING'
      ? 'Awaiting approval'
      : item.membership_status === 'INVITED'
        ? 'Invitation received'
        : null;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canOpen ? 'Open cluster ' + item.name : 'Cluster ' + item.name}
        accessibilityState={{ disabled: !canOpen }}
        disabled={!canOpen}
        onPress={() => onOpen?.(item.scope_id)}
        style={({ pressed }) => [styles.cardHeadPress, pressed && { opacity: 0.75 }]}
      >
        <View style={[styles.clusterIcon, { backgroundColor: accent.soft }]}>
          {scopePhoto?<Image source={{uri:scopePhoto}} style={styles.clusterIconPhoto} resizeMode="cover"/>:
            <MaterialCommunityIcons name="account-group-outline" size={23} color={accent.ink} />}
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>
            {item.category || 'Community Cluster'} · {Number(item.member_count || 0).toLocaleString()} members
          </Text>
        </View>
        <View style={styles.cardRight}>
          <StatusBadge text={item.visibility.replace('_', ' ')} />
          {canOpen ? <MaterialCommunityIcons name="chevron-right" size={21} color="#61756B" /> : null}
        </View>
      </Pressable>
      {item.description ? (
        <Text numberOfLines={1} style={styles.description}>{item.description}</Text>
      ) : null}
      {(status || children) ? (
        <View style={styles.cardBottom}>
          {status ? (
            <View style={styles.roleRow}>
              <View style={[
                styles.statusDot,
                { backgroundColor: item.membership_status === 'ACTIVE' ? '#269766' : '#D29443' },
              ]}/>
              <Text style={styles.membership}>{status}</Text>
            </View>
          ) : <View style={styles.roleRow}/>}
          {children ? <View style={styles.actions}>{children}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

function DashboardMetric({
  count,
  title,
  icon,
  onPress,
  selected,
}: {
  count: number;
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title + ': ' + count + ', open section'}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricTile,
        selected && styles.metricTileActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18}
        color={selected ? '#F0FFF6' : '#4A8169'} />
      <Text style={[styles.metricCount, selected && styles.metricTextActive]}>{count}</Text>
      <Text style={[styles.metricTitle, selected && styles.metricTextActive]}>{title}</Text>
    </Pressable>
  );
}

type ClusterDirectorySection = 'mine' | 'discover' | 'invitations' | 'pending';

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
  const [section, setSection] = useState<ClusterDirectorySection>('mine');
  const [myQuery, setMyQuery] = useState('');
  const [showAllMyClusters, setShowAllMyClusters] = useState(false);
  const [showAllSuggested, setShowAllSuggested] = useState(false);

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


  const filteredMyClusters = useMemo(() => {
    const search = myQuery.trim().toLocaleLowerCase();
    if (!search) return activeClusters;
    return activeClusters.filter(item =>
      (item.name + ' ' + (item.category || '') + ' ' + (item.description || ''))
        .toLocaleLowerCase().includes(search)
    );
  }, [activeClusters, myQuery]);

  const discoverableClusters = useMemo(() =>
    discover.filter(item =>
      !['ACTIVE','PENDING','INVITED'].includes(String(item.membership_status ?? ''))
    ), [discover]);
  const visibleSuggested = showAllSuggested || query.trim()
    ? discoverableClusters.slice(0, 20)
    : discoverableClusters.slice(0, 6);

  const sections: Array<{
    key: ClusterDirectorySection;
    label: string;
    count?: number;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  }> = [
    { key: 'mine', label: 'My Clusters', count: activeClusters.length, icon: 'view-grid-outline' },
    { key: 'discover', label: 'Explore', icon: 'compass-outline' },
    { key: 'invitations', label: 'Invites', count: invitations.length, icon: 'email-outline' },
    { key: 'pending', label: 'Requests', count: pending.length, icon: 'clock-outline' },
  ];

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
          onRefresh={() => void load(query, true)}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>BUKLOD · COMMUNITY</Text>
            <Text style={styles.title}>Your Clusters</Text>
            <Text style={styles.subtitle}>Your communities, together in one place.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create Cluster"
            onPress={() => router.push('/clusters/create' as any)}
            style={({ pressed }) => [styles.createClusterCompact, pressed && { opacity: 0.8 }]}
          >
            <MaterialCommunityIcons name="plus" size={19} color="#FFFFFF" />
            <Text style={styles.createClusterCompactText}>Create</Text>
          </Pressable>
        </View>
        <View style={styles.metricRow}>
          <DashboardMetric count={activeClusters.length} title="Joined" icon="account-check-outline"
            selected={section === 'mine'} onPress={() => setSection('mine')} />
          <DashboardMetric count={invitations.length} title="Invites" icon="email-outline"
            selected={section === 'invitations'} onPress={() => setSection('invitations')} />
          <DashboardMetric count={pending.length} title="Pending" icon="clock-outline"
            selected={section === 'pending'} onPress={() => setSection('pending')} />
        </View>
      </View>

      <BuklodFirstViewAd placement="cluster" placementId="cluster_directory_first_view" />

      {!online ? (
        <View style={styles.feedback}>
          <MaterialCommunityIcons name="cloud-off-outline" size={18} color="#956B30" />
          <Text style={styles.feedbackText}>Offline · saved memberships are available. Search and changes need internet.</Text>
        </View>
      ) : null}
      {Boolean(loadError) && online ? (
        <View style={styles.feedback}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#956B30" />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.feedbackText}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load(query, true)}>
              <Text style={styles.retryLink}>Retry loading</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionNavigation}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionNavigationInner}>
          {sections.map(tab => {
            const selected = section === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.label + (tab.count != null ? ' ' + tab.count : '')}
                accessibilityState={{ selected }}
                onPress={() => setSection(tab.key)}
                style={({ pressed }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  pressed && { opacity: 0.78 },
                ]}
              >
                <MaterialCommunityIcons name={tab.icon} size={17}
                  color={selected ? '#FFFFFF' : '#52695C'} />
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
                {tab.count != null && tab.count > 0 ? (
                  <View style={[styles.tabCountPill, selected && styles.tabCountPillSelected]}>
                    <Text style={[styles.tabCountText, selected && styles.tabTextSelected]}>{tab.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && visibleMyClusters.length === 0 && online ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#1C6B48" />
          <Text style={styles.muted}>Loading your communities…</Text>
        </View>
      ) : null}

      {section === 'mine' ? (
        <View style={styles.directorySection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>My Clusters</Text>
              <Text style={styles.sectionNote}>Tap a card to enter its dashboard.</Text>
            </View>
            <Text style={styles.sectionCount}>{activeClusters.length} joined</Text>
          </View>

          {activeClusters.length > 0 ? (
            <View style={styles.searchRow}>
              <MaterialCommunityIcons name="magnify" size={20} color="#809088" />
              <TextInput
                style={styles.search}
                placeholder="Find one of my clusters"
                placeholderTextColor="#87958C"
                accessibilityLabel="Search my clusters"
                value={myQuery}
                onChangeText={value => {
                  setMyQuery(value);
                  setShowAllMyClusters(false);
                }}
                returnKeyType="search"
              />
              {myQuery.length > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear my cluster search"
                  onPress={() => setMyQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={20} color="#809088" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {filteredMyClusters.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-group-outline" size={26} color="#68927B" />
              <Text style={styles.emptyTitle}>
                {myQuery.trim() ? 'No matching cluster' :
                  online && !loadError ? 'No active cluster yet' : 'No saved cluster membership'}
              </Text>
              <Text style={styles.muted}>
                {myQuery.trim() ? 'Try another name or category.' :
                  online && !loadError ? 'Create a cluster or explore communities.' :
                    'Connect once to retrieve your cluster list.'}
              </Text>
              {!myQuery.trim() && online ? (
                <ActionButton title="Explore clusters" onPress={() => setSection('discover')} />
              ) : null}
            </View>
          ) : (
            <>
              {(showAllMyClusters || myQuery.trim() ? filteredMyClusters : filteredMyClusters.slice(0, 8)).map(item => (
                <ClusterCard key={item.scope_id} item={item} onOpen={openCluster}>
                  <ActionButton title="Open"
                    onPress={() => openCluster(item.scope_id)} />
                  {item.is_admin ? (
                    <ActionButton title="Manage" outline tone={getStableBuklodCardTone(item.scope_id)}
                      onPress={() => router.push(clusterScopeManageRoute(item.scope_id, item.name) as any)} />
                  ) : null}
                </ClusterCard>
              ))}
              {!myQuery.trim() && filteredMyClusters.length > 8 ? (
                <Pressable accessibilityRole="button"
                  accessibilityLabel={showAllMyClusters ? 'Show fewer clusters' : 'Show all my clusters'}
                  onPress={() => setShowAllMyClusters(current => !current)}
                  style={styles.moreButton}>
                  <Text style={styles.moreButtonText}>
                    {showAllMyClusters ? 'Show fewer' : 'View all ' + filteredMyClusters.length + ' clusters'}
                  </Text>
                  <MaterialCommunityIcons name={showAllMyClusters ? 'chevron-up' : 'chevron-down'}
                    size={21} color="#1C6B48" />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {section === 'invitations' ? (
        <View style={styles.directorySection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Invitations</Text>
              <Text style={styles.sectionNote}>Choose which communities to join.</Text>
            </View>
            <Text style={styles.sectionCount}>{invitations.length} invites</Text>
          </View>
          {invitations.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="email-check-outline" size={26} color="#68927B" />
              <Text style={styles.emptyTitle}>No invitations right now</Text>
              <Text style={styles.muted}>New cluster invitations will appear here.</Text>
            </View>
          ) : invitations.map(item => (
            <ClusterCard key={item.scope_id} item={item}>
              <ActionButton title="Accept" disabled={busyId === item.scope_id}
                onPress={() => void respond(item, true)} />
              <ActionButton title="Decline" outline disabled={busyId === item.scope_id}
                onPress={() => void respond(item, false)} />
            </ClusterCard>
          ))}
        </View>
      ) : null}

      {section === 'pending' ? (
        <View style={styles.directorySection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Pending requests</Text>
              <Text style={styles.sectionNote}>Waiting for an admin to approve membership.</Text>
            </View>
            <Text style={styles.sectionCount}>{pending.length} pending</Text>
          </View>
          {pending.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="check-decagram-outline" size={26} color="#68927B" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.muted}>Membership requests awaiting approval appear here.</Text>
            </View>
          ) : pending.map(item => (
            <ClusterCard key={item.scope_id} item={item} />
          ))}
        </View>
      ) : null}

      {section === 'discover' ? (
        <View style={styles.directorySection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Explore clusters</Text>
              <Text style={styles.sectionNote}>Discover new communities to connect with.</Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color="#809088" />
            <TextInput
              style={styles.search}
              placeholder="Search cluster name or category"
              placeholderTextColor="#87958C"
              accessibilityLabel="Search discoverable clusters"
              value={query}
              onChangeText={value => {
                setQuery(value);
                setShowAllSuggested(false);
              }}
              returnKeyType="search"
              onSubmitEditing={() => void load(query, true)}
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear cluster discovery search"
                onPress={() => setQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#809088" />
              </Pressable>
            ) : null}
          </View>
          {searching ? (
            <Text style={styles.searchHint}>Searching clusters…</Text>
          ) : null}

          {discoverableClusters.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="compass-outline" size={26} color="#68927B" />
              <Text style={styles.emptyTitle}>{online && !loadError ? 'No clusters found' : 'Discovery unavailable offline'}</Text>
              <Text style={styles.muted}>Try a different search or return when connected.</Text>
            </View>
          ) : (
            <>
              {visibleSuggested.map(item => (
                <ClusterCard key={item.scope_id} item={item}>
                  <ActionButton title={item.visibility === 'PRIVATE' ? 'Request to join' : 'Join cluster'}
                    disabled={!online || busyId === item.scope_id}
                    onPress={() => void join(item)} />
                </ClusterCard>
              ))}
              {!query.trim() && discoverableClusters.length > 6 ? (
                <Pressable accessibilityRole="button"
                  onPress={() => setShowAllSuggested(current => !current)}
                  style={styles.moreButton}>
                  <Text style={styles.moreButtonText}>
                    {showAllSuggested ? 'Show fewer' : 'See more suggested clusters'}
                  </Text>
                  <MaterialCommunityIcons name={showAllSuggested ? 'chevron-up' : 'chevron-down'}
                    size={21} color="#1C6B48" />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      <View style={{ height: 12 }} />
    </BuklodPortalScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F6' },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32, gap: 12 },
  hero: {
    borderRadius: 22, borderWidth: 1, borderColor: '#DCE9E1',
    backgroundColor: '#FFFFFF', padding: 16, gap: 16,
  },
  heroHeading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#257A52' },
  title: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5, color: '#123A2B' },
  subtitle: { fontSize: 12, lineHeight: 17, color: '#718078' },
  createClusterCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#145B3B', borderRadius: 13,
    paddingHorizontal: 13, minHeight: 44, justifyContent: 'center',
  },
  createClusterCompactText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricTile: {
    flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    borderRadius: 14, backgroundColor: '#F2F7F3', borderWidth: 1,
    borderColor: '#E7EFE9',
  },
  metricTileActive: { backgroundColor: '#19633F', borderColor: '#19633F' },
  metricCount: { fontSize: 19, fontWeight: '900', color: '#1D4A33' },
  metricTitle: { fontSize: 10, fontWeight: '800', color: '#61766A' },
  metricTextActive: { color: '#FFFFFF' },
  sectionNavigation: {
    borderRadius: 16, borderWidth: 1, borderColor: '#E0E9E3',
    backgroundColor: '#FFFFFF', overflow: 'hidden',
  },
  sectionNavigationInner: { paddingHorizontal: 7, paddingVertical: 7, gap: 5, alignItems: 'center' },
  tab: {
    minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center',
  },
  tabSelected: { backgroundColor: '#145B3B' },
  tabText: { fontSize: 12, color: '#52695C', fontWeight: '800' },
  tabTextSelected: { color: '#FFFFFF' },
  tabCountPill: {
    borderRadius: 9, minWidth: 20, paddingHorizontal: 5, paddingVertical: 2,
    backgroundColor: '#E6F0E8', alignItems: 'center',
  },
  tabCountPillSelected: { backgroundColor: 'rgba(255,255,255,0.17)' },
  tabCountText: { fontSize: 10, fontWeight: '900', color: '#236042' },
  directorySection: { gap: 9 },
  sectionHeading: {
    paddingHorizontal: 2, paddingTop: 4, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#193C2D' },
  sectionNote: { fontSize: 11, lineHeight: 16, color: '#7C8B82', marginTop: 3 },
  sectionCount: { fontSize: 11, fontWeight: '800', color: '#2D7751' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E1E8E3',
    paddingHorizontal: 12, paddingVertical: 11, gap: 6,
  },
  cardHeadPress: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  clusterIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  clusterIconPhoto:{width:44,height:44,borderRadius:14},
  cardBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900', color: '#19392A' },
  cardMeta: { fontSize: 11, lineHeight: 15, color: '#73867C' },
  description: { color: '#61736A', fontSize: 11, paddingLeft: 54 },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 7, paddingLeft: 54,
  },
  roleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  membership: { fontSize: 11, fontWeight: '800', color: '#3A7960' },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: '900' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  actionButton: {
    minHeight: 34, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#206447', paddingHorizontal: 12, borderRadius: 10,
  },
  actionButtonOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B4D3BF' },
  actionButtonDanger: { backgroundColor: '#A84242' },
  actionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  actionTextOutline: { color: '#2D6A4F' },
  disabled: { opacity: 0.5 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 46, borderWidth: 1, borderColor: '#E0E8E2',
    borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 12,
  },
  search: { flex: 1, minHeight: 44, padding: 0, fontSize: 13, color: '#183E2D' },
  searchHint: { fontSize: 11, color: '#6C8274', paddingHorizontal: 3 },
  moreButton: {
    minHeight: 44, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 13, borderWidth: 1, borderColor: '#CDE2D4', backgroundColor: '#F1F7F3',
  },
  moreButtonText: { color: '#1D6745', fontSize: 12, fontWeight: '900' },
  feedback: {
    borderRadius: 13, borderWidth: 1, borderColor: '#F0E3CC',
    backgroundColor: '#FFF9ED', padding: 11,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  feedbackText: { flex: 1, color: '#7A633E', fontSize: 12, lineHeight: 17 },
  retryLink: { fontSize: 12, fontWeight: '900', color: '#155D3D' },
  empty: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E8E3',
    borderRadius: 16, alignItems: 'center', paddingVertical: 22,
    paddingHorizontal: 16, gap: 9,
  },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#234A35', textAlign: 'center' },
  muted: { color: '#798980', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  loading: { padding: 24, alignItems: 'center', gap: 10 },
});
