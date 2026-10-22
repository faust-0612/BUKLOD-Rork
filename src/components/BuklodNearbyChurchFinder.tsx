import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PermissionStatus } from 'expo-location';
import { router } from 'expo-router';

import {
  acceptChurchInvite,
  churchFinderCacheKey,
  formatChurchDistance,
  requestChurchMembership,
  searchAccountabilityScopes,
  type ChurchFinderPerson,
  type ChurchFinderRow,
} from '@/lib/buklodChurchFinder';
import {
  getBuklodForegroundLocation,
  getBuklodForegroundPermissionStatus,
  requestBuklodForegroundPermission,
  type BuklodCoordinates,
} from '@/lib/buklodLocation';
import {
  readOfflineCache,
  writeOfflineCache,
} from '@/lib/buklodOfflineSync';
import { FLATLIST_TUNING } from '@/lib/performanceInstrumentation';
import { visitMemberProfile } from '@/lib/buklodMemberProfile';
import { useNetwork } from '@/providers/NetworkProvider';

function peopleLine(
  label: string,
  people: ChurchFinderPerson[],
) {
  if (!people.length) return null;
  const names = people
    .map((person) => person.display_name)
    .filter(Boolean)
    .join(', ');
  if (!names) return null;
  return `${label}: ${names}`;
}

function joinTitle(item: ChurchFinderRow) {
  const state = String(item.membership_state ?? '').toUpperCase();
  if (state === 'ACTIVE') return 'OPEN';
  if (state === 'PENDING') return 'REQUEST PENDING';
  if (state === 'INVITED') return 'ACCEPT INVITATION';
  if (item.join_policy === 'INVITE') return 'INVITE ONLY';
  if (item.join_policy === 'OPEN') return 'JOIN';
  return 'REQUEST TO JOIN';
}

export default function BuklodNearbyChurchFinder({
  header,
  onMembershipChange,
}: {
  header?: React.ReactNode;
  onMembershipChange?: () => void;
}) {
  const { online } = useNetwork();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ChurchFinderRow[]>([]);
  const [coords, setCoords] = useState<BuklodCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [permissionState, setPermissionState] = useState<
    'undetermined' | 'granted' | 'denied' | 'services_off' | 'timeout'
  >('undetermined');

  const loadRows = useCallback(
    async (nextQuery: string, nextCoords: BuklodCoordinates | null) => {
      const cacheKey = churchFinderCacheKey(nextQuery);

      try {
        const found = await searchAccountabilityScopes({
          query: nextQuery,
          coords: nextCoords,
          limit: 30,
          mode: 'nearby_churches',
        });
        setRows(found);
        setFromCache(false);
        await writeOfflineCache(cacheKey, found);
      } catch (error: unknown) {
        const cached = await readOfflineCache<ChurchFinderRow[]>(cacheKey);
        if (cached?.length) {
          setRows(cached);
          setFromCache(true);
        } else {
          Alert.alert(
            'Nearby Churches',
            error instanceof Error
              ? error.message
              : 'Could not load churches.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refreshPermission = useCallback(async () => {
    const permission = await getBuklodForegroundPermissionStatus();
    if (permission.status === PermissionStatus.GRANTED) {
      setPermissionState('granted');
      return 'granted' as const;
    }
    if (
      permission.status === PermissionStatus.DENIED &&
      permission.canAskAgain === false
    ) {
      setPermissionState('denied');
      return 'denied' as const;
    }
    setPermissionState('undetermined');
    return 'undetermined' as const;
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    const result = await getBuklodForegroundLocation();
    setLocating(false);

    if (result.ok) {
      setCoords(result.coords);
      setPermissionState('granted');
      return result.coords;
    }

    if (result.reason === 'services_off') {
      setPermissionState('services_off');
    } else if (result.reason === 'timeout') {
      setPermissionState('timeout');
    } else if (result.reason === 'permission_denied') {
      setPermissionState('denied');
    } else {
      setPermissionState('timeout');
    }

    return null;
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const status = await refreshPermission();
      let nextCoords: BuklodCoordinates | null = null;
      if (status === 'granted' && alive) {
        nextCoords = await locate();
      }
      if (alive) {
        await loadRows('', nextCoords);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadRows, locate, refreshPermission]);

  const allowLocation = useCallback(async () => {
    const requested = await requestBuklodForegroundPermission();
    if (requested.status !== PermissionStatus.GRANTED) {
      setPermissionState('denied');
      await loadRows(query, null);
      return;
    }

    const nextCoords = await locate();
    await loadRows(query, nextCoords);
  }, [loadRows, locate, query]);

  const searchNow = useCallback(() => {
    void loadRows(query, coords);
  }, [coords, loadRows, query]);

  const openChurch = useCallback((id: string) => {
    router.push({
      pathname: '/churches/[id]' as any,
      params: { id },
    } as any);
  }, []);

  const membershipAction = useCallback(
    async (item: ChurchFinderRow) => {
      const state = String(item.membership_state ?? '').toUpperCase();
      if (state === 'ACTIVE') {
        openChurch(item.scope_id);
        return;
      }
      if (state === 'PENDING' || item.join_policy === 'INVITE') {
        return;
      }
      if (!online) {
        Alert.alert(
          'Offline',
          'Join requests need an internet connection.',
        );
        return;
      }

      setBusyId(item.scope_id);
      try {
        if (state === 'INVITED') {
          await acceptChurchInvite(item.scope_id);
        } else {
          const status = await requestChurchMembership(item.scope_id);
          if (String(status).toUpperCase() === 'PENDING') {
            Alert.alert(
              'Church membership',
              'Your request was sent to the Church Admin.',
            );
          }
        }
        await loadRows(query, coords);
        onMembershipChange?.();
      } catch (error: unknown) {
        Alert.alert(
          'Church membership',
          error instanceof Error ? error.message : 'Could not update membership.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [coords, loadRows, onMembershipChange, online, openChurch, query],
  );

  const permissionCopy = (() => {
    if (permissionState === 'undetermined') {
      return {
        title: 'Nearby Churches',
        body: 'BUKLOD uses your location only to find nearby churches.',
        action: 'Allow Location',
        onPress: () => void allowLocation(),
      };
    }
    if (permissionState === 'denied') {
      return {
        title: 'Location permission is off.',
        body: 'You can still search churches by name or place.',
        action: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'web') {
            Alert.alert(
              'Location',
              'Allow location for this site in your browser settings, then search again.',
            );
            return;
          }
          void Linking.openSettings();
        },
      };
    }
    if (permissionState === 'services_off') {
      return {
        title: 'Turn on Location Services to see nearby churches.',
        body: 'You can still search churches by name or place.',
        action: 'Search Manually',
        onPress: searchNow,
      };
    }
    if (permissionState === 'timeout') {
      return {
        title: "We couldn't get your current location.",
        body: 'You can still search churches by name or place.',
        action: 'Search Manually',
        onPress: searchNow,
      };
    }
    return null;
  })();

  const renderItem = ({ item }: { item: ChurchFinderRow }) => {
    const distance = formatChurchDistance(item.distance_km);
    const pastorLine = peopleLine('Pastor', item.pastors);
    const mentorLine = peopleLine('Mentor', item.mentors);
    const joinLabel = joinTitle(item);
    const joinDisabled =
      busyId === item.scope_id ||
      String(item.membership_state ?? '').toUpperCase() === 'PENDING' ||
      (item.join_policy === 'INVITE' &&
        String(item.membership_state ?? '').toUpperCase() !== 'INVITED');

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.scope_name}</Text>
        <Text style={styles.meta}>
          Church
          {item.safe_location_label ? ` · ${item.safe_location_label}` : ''}
        </Text>
        {distance ? <Text style={styles.meta}>{distance}</Text> : null}
        {item.pastors.map((person) =>
          person.user_id ? (
            <Pressable
              key={`p-${person.user_id}`}
              onPress={() =>
                visitMemberProfile(person.user_id, person.display_name)
              }
            >
              <Text style={styles.link}>Pastor: {person.display_name}</Text>
            </Pressable>
          ) : (
            <Text key={`p-${person.display_name}`} style={styles.meta}>
              {pastorLine}
            </Text>
          ),
        )}
        {item.mentors.map((person) =>
          person.user_id ? (
            <Pressable
              key={`m-${person.user_id}`}
              onPress={() =>
                visitMemberProfile(person.user_id, person.display_name)
              }
            >
              <Text style={styles.link}>Mentor: {person.display_name}</Text>
            </Pressable>
          ) : (
            <Text key={`m-${person.display_name}`} style={styles.meta}>
              {mentorLine}
            </Text>
          ),
        )}
        {!item.pastors.length && !item.mentors.length ? (
          <Text style={styles.warn}>
            Accountability setup incomplete — assign a Pastor or Mentor.
          </Text>
        ) : item.accountability_ready ? (
          <Text style={styles.ready}>Accountability Ready</Text>
        ) : (
          <Text style={styles.warn}>
            Accountability setup incomplete — assign a Pastor or Mentor.
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={() => openChurch(item.scope_id)}
          >
            <Text style={styles.buttonText}>VIEW CHURCH</Text>
          </Pressable>
          <Pressable
            style={[styles.buttonOutline, joinDisabled && styles.disabled]}
            disabled={joinDisabled}
            onPress={() => void membershipAction(item)}
          >
            <Text style={styles.buttonTextOutline}>{joinLabel}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(item) => item.scope_id}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={FLATLIST_TUNING.publicCommunity.initialNumToRender}
      maxToRenderPerBatch={FLATLIST_TUNING.publicCommunity.maxToRenderPerBatch}
      updateCellsBatchingPeriod={
        FLATLIST_TUNING.publicCommunity.updateCellsBatchingPeriod
      }
      windowSize={FLATLIST_TUNING.publicCommunity.windowSize}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {header}
          <Text style={styles.section}>NEARBY CHURCHES</Text>
          {locating ? (
            <View style={styles.banner}>
              <ActivityIndicator color="#2D6A4F" />
              <Text style={styles.bannerBody}>Finding churches near you...</Text>
            </View>
          ) : null}
          {permissionCopy ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>{permissionCopy.title}</Text>
              <Text style={styles.bannerBody}>{permissionCopy.body}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.button} onPress={permissionCopy.onPress}>
                  <Text style={styles.buttonText}>{permissionCopy.action}</Text>
                </Pressable>
                {permissionState === 'denied' ? (
                  <Pressable style={styles.buttonOutline} onPress={searchNow}>
                    <Text style={styles.buttonTextOutline}>Search Manually</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
          {!online || fromCache ? (
            <Text style={styles.stale}>
              {!online
                ? 'You are offline. Church list may be out of date. Join is unavailable.'
                : 'Showing saved churches. Pull to refresh when online.'}
            </Text>
          ) : null}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Church, pastor, mentor, or place..."
              returnKeyType="search"
              onSubmitEditing={searchNow}
            />
            <Pressable style={styles.button} onPress={searchNow}>
              <Text style={styles.buttonText}>SEARCH</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#2D6A4F" />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {query.trim()
                ? 'No churches matched that search.'
                : 'No registered BUKLOD churches yet.'}
            </Text>
            <Text style={styles.muted}>
              {query.trim()
                ? 'Try another church name, pastor, mentor, or place.'
                : 'Nearby Churches lists churches that have completed setup and are publicly listed. Worship location uses a map pin and a public-safe place name, not a home address.'}
            </Text>
            {!query.trim() ? (
              <Pressable
                style={styles.button}
                onPress={() => router.push('/churches/create' as any)}
              >
                <Text style={styles.buttonText}>REGISTER A CHURCH</Text>
              </Pressable>
            ) : null}
          </View>
        )
      }
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },
  headerBlock: {
    padding: 16,
    gap: 10,
  },
  section: {
    marginTop: 8,
    color: '#365347',
    fontWeight: '900',
    letterSpacing: 1,
  },
  banner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  bannerTitle: {
    color: '#19362A',
    fontWeight: '900',
    fontSize: 16,
  },
  bannerBody: {
    color: '#66756D',
    lineHeight: 20,
  },
  stale: {
    color: '#67552F',
    backgroundColor: '#FFF8E8',
    padding: 10,
    borderRadius: 10,
    lineHeight: 18,
  },
  map: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 7,
  },
  search: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 16,
    padding: 15,
    gap: 6,
  },
  name: {
    fontWeight: '900',
    fontSize: 18,
    color: '#1A3329',
  },
  meta: {
    color: '#748079',
    fontSize: 12,
  },
  link: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  ready: {
    color: '#236043',
    fontWeight: '800',
    fontSize: 12,
  },
  warn: {
    color: '#8A5A12',
    fontWeight: '800',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 5,
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#2D6A4F',
  },
  buttonOutline: {
    minHeight: 40,
    paddingHorizontal: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  buttonTextOutline: {
    color: '#2D6A4F',
    fontWeight: '900',
    fontSize: 11,
  },
  disabled: {
    opacity: 0.45,
  },
  empty: {
    marginHorizontal: 16,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    gap: 10,
  },
  emptyTitle: {
    color: '#19362A',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 6,
  },
  muted: {
    color: '#748079',
    lineHeight: 20,
  },
  loading: {
    padding: 24,
  },
});

